import { fetchLiveStreams as fetchYouTubeLiveStreams, type YouTubeLiveStream } from './youtubeService';
import { fetchLiveStreams as fetchTwitchLiveStreams, type TwitchLiveStreamInfo } from './twitchService';
import { cacheService } from './cacheService';
import { priorityManager } from './priorityManager';
import type { ChannelClassification } from '../types/priority';

// キャッシュTTL（秒）
// 同期間隔（90秒）より少し長めに設定し、次回同期まで有効なキャッシュを保持
const CACHE_TTL = 100; // 100秒

// 同期間隔（ミリ秒）
const SYNC_INTERVAL = 90000; // 1.5分（API消費を削減）

// プラットフォーム別の配信情報
export interface PlatformStreams {
  youtube: YouTubeLiveStream[];
  twitch: TwitchLiveStreamInfo[];
}

// 配信変更イベント
export interface StreamUpdateEvent {
  type: 'stream_list_updated';
  platform: 'youtube' | 'twitch';
  streams: YouTubeLiveStream[] | TwitchLiveStreamInfo[];
  changes: {
    added: string[]; // 新規配信のID
    removed: string[]; // 終了配信のID
  };
}

// ユーザーセッション情報
interface UserSession {
  userId: string;
  youtubeChannels: string[];
  twitchChannels: string[];
  youtubeAccessToken?: string;
  twitchAccessToken?: string;
}

class StreamSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private userSessions: Map<string, UserSession> = new Map();

  // 前回の配信リスト（差分検出用）
  private previousYouTubeStreams: Map<string, YouTubeLiveStream> = new Map();
  private previousTwitchStreams: Map<string, TwitchLiveStreamInfo> = new Map();

  // イベントリスナー
  private eventListeners: ((event: StreamUpdateEvent) => void)[] = [];

  /**
   * ユーザーセッションを登録
   */
  registerUser(
    userId: string,
    channels: { youtube: string[], twitch: string[] },
    tokens?: { youtube?: string, twitch?: string }
  ): void {
    this.userSessions.set(userId, {
      userId,
      youtubeChannels: channels.youtube,
      twitchChannels: channels.twitch,
      youtubeAccessToken: tokens?.youtube,
      twitchAccessToken: tokens?.twitch
    });
    console.log(`[StreamSync] User registered: ${userId}, YouTube: ${channels.youtube.length}, Twitch: ${channels.twitch.length}`);

    // PriorityManagerにも登録（重複度計算のため）
    priorityManager.registerUser(userId, channels);
  }

  /**
   * ユーザーセッションを削除
   */
  unregisterUser(userId: string): void {
    this.userSessions.delete(userId);
    console.log(`[StreamSync] User unregistered: ${userId}`);

    // PriorityManagerからも削除
    priorityManager.unregisterUser(userId);
  }

  /**
   * イベントリスナーを登録
   */
  onStreamUpdate(listener: (event: StreamUpdateEvent) => void): () => void {
    this.eventListeners.push(listener);
    // クリーンアップ関数を返す
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * 全ユーザーのフォローチャンネルを集約
   */
  private getAllChannels(): { youtube: string[], twitch: string[] } {
    const youtubeSet = new Set<string>();
    const twitchSet = new Set<string>();

    for (const session of this.userSessions.values()) {
      session.youtubeChannels.forEach(ch => youtubeSet.add(ch));
      session.twitchChannels.forEach(ch => twitchSet.add(ch));
    }

    return {
      youtube: Array.from(youtubeSet),
      twitch: Array.from(twitchSet)
    };
  }

  /**
   * アクセストークンを取得（いずれかのユーザーから）
   */
  private getAccessTokens(): { youtube?: string, twitch?: string } {
    for (const session of this.userSessions.values()) {
      if (session.youtubeAccessToken || session.twitchAccessToken) {
        return {
          youtube: session.youtubeAccessToken,
          twitch: session.twitchAccessToken
        };
      }
    }
    return {};
  }

  /**
   * YouTube配信の同期を実行
   */
  private async syncYouTubeStreams(channelIds: string[], forceNotify = false): Promise<void> {
    if (channelIds.length === 0) {
      console.log('[StreamSync] No YouTube channels to sync');
      return;
    }

    try {
      console.log(`[StreamSync] Syncing YouTube streams for ${channelIds.length} channels`);

      const streams = await fetchYouTubeLiveStreams({
        channelIds,
        maxResults: 50
      });

      console.log(`[StreamSync] Found ${streams.length} YouTube live streams`);

      // 差分検出
      const currentStreamMap = new Map(streams.map(s => [s.id, s]));
      const previousStreamMap = this.previousYouTubeStreams;

      const added: string[] = [];
      const removed: string[] = [];

      // 新規配信を検出
      for (const [id, stream] of currentStreamMap) {
        if (!previousStreamMap.has(id)) {
          added.push(id);
          console.log(`[StreamSync] New YouTube stream: ${stream.channelTitle} - ${stream.title}`);
        }
      }

      // 終了配信を検出
      for (const [id] of previousStreamMap) {
        if (!currentStreamMap.has(id)) {
          removed.push(id);
          console.log(`[StreamSync] Ended YouTube stream: ${id}`);
        }
      }

      // 前回の配信リストを更新
      this.previousYouTubeStreams = currentStreamMap;

      // 変更があればイベントを送信、または強制通知モードの場合は常に送信
      if (added.length > 0 || removed.length > 0 || forceNotify) {
        if (forceNotify && added.length === 0 && removed.length === 0) {
          console.log('[StreamSync] Force notify mode: sending current stream list');
        } else {
          console.log(`[StreamSync] YouTube changes - Added: ${added.length}, Removed: ${removed.length}`);
        }
        this.notifyStreamUpdate({
          type: 'stream_list_updated',
          platform: 'youtube',
          streams,
          changes: { added, removed }
        });
      }

      // Redisにキャッシュ
      if (cacheService.isConnected()) {
        await cacheService.set('streams:youtube:all', streams, CACHE_TTL);
      }
    } catch (error) {
      console.error('[StreamSync] Error syncing YouTube streams:', error);
    }
  }

  /**
   * Twitch配信の同期を実行
   */
  private async syncTwitchStreams(channelIds: string[], accessToken?: string, forceNotify = false): Promise<void> {
    if (channelIds.length === 0) {
      console.log('[StreamSync] No Twitch channels to sync');
      return;
    }

    if (!accessToken) {
      console.log('[StreamSync] No Twitch access token available');
      return;
    }

    try {
      console.log(`[StreamSync] Syncing Twitch streams for ${channelIds.length} channels`);

      const streams = await fetchTwitchLiveStreams(accessToken, channelIds);

      console.log(`[StreamSync] Found ${streams.length} Twitch live streams`);

      // 差分検出
      const currentStreamMap = new Map(streams.map(s => [s.id, s]));
      const previousStreamMap = this.previousTwitchStreams;

      const added: string[] = [];
      const removed: string[] = [];

      // 新規配信を検出
      for (const [id, stream] of currentStreamMap) {
        if (!previousStreamMap.has(id)) {
          added.push(id);
          console.log(`[StreamSync] New Twitch stream: ${stream.displayName} - ${stream.title}`);
        }
      }

      // 終了配信を検出
      for (const [id] of previousStreamMap) {
        if (!currentStreamMap.has(id)) {
          removed.push(id);
          console.log(`[StreamSync] Ended Twitch stream: ${id}`);
        }
      }

      // 前回の配信リストを更新
      this.previousTwitchStreams = currentStreamMap;

      // 変更があればイベントを送信、または強制通知モードの場合は常に送信
      if (added.length > 0 || removed.length > 0 || forceNotify) {
        if (forceNotify && added.length === 0 && removed.length === 0) {
          console.log('[StreamSync] Force notify mode: sending current stream list');
        } else {
          console.log(`[StreamSync] Twitch changes - Added: ${added.length}, Removed: ${removed.length}`);
        }
        this.notifyStreamUpdate({
          type: 'stream_list_updated',
          platform: 'twitch',
          streams,
          changes: { added, removed }
        });
      }

      // Redisにキャッシュ
      if (cacheService.isConnected()) {
        await cacheService.set('streams:twitch:all', streams, CACHE_TTL);
      }
    } catch (error) {
      console.error('[StreamSync] Error syncing Twitch streams:', error);
    }
  }

  /**
   * 全プラットフォームの配信を同期
   */
  private async syncAllStreams(forceNotify = false): Promise<void> {
    const channels = this.getAllChannels();
    const tokens = this.getAccessTokens();

    // YouTube と Twitch を並列で同期
    await Promise.all([
      this.syncYouTubeStreams(channels.youtube, forceNotify),
      this.syncTwitchStreams(channels.twitch, tokens.twitch, forceNotify)
    ]);
  }

  /**
   * イベントリスナーに通知
   */
  private notifyStreamUpdate(event: StreamUpdateEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[StreamSync] Error in event listener:', error);
      }
    }
  }

  /**
   * 定期同期を開始
   */
  start(): void {
    if (this.isRunning) {
      console.log('[StreamSync] Already running');
      return;
    }

    console.log('[StreamSync] Starting stream sync service...');
    console.log(`[StreamSync] Sync interval: ${SYNC_INTERVAL / 1000}s`);

    this.isRunning = true;

    // 即座に1回実行
    this.syncAllStreams().catch(err => {
      console.error('[StreamSync] Initial sync failed:', err);
    });

    // 定期実行を設定
    this.intervalId = setInterval(() => {
      this.syncAllStreams().catch(err => {
        console.error('[StreamSync] Periodic sync failed:', err);
      });
    }, SYNC_INTERVAL);

    console.log('[StreamSync] Service started');
  }

  /**
   * 定期同期を停止
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[StreamSync] Service stopped');
  }

  /**
   * キャッシュされた配信リストを取得
   */
  async getCachedStreams(): Promise<PlatformStreams | null> {
    if (!cacheService.isConnected()) {
      console.warn('[StreamSync] Redis not connected');
      return null;
    }

    const [youtube, twitch] = await Promise.all([
      cacheService.get<YouTubeLiveStream[]>('streams:youtube:all'),
      cacheService.get<TwitchLiveStreamInfo[]>('streams:twitch:all')
    ]);

    return {
      youtube: youtube || [],
      twitch: twitch || []
    };
  }

  /**
   * キャッシュされたYouTube配信リストを取得（後方互換性）
   */
  async getCachedYouTubeStreams(): Promise<YouTubeLiveStream[] | null> {
    if (!cacheService.isConnected()) {
      return null;
    }
    return await cacheService.get<YouTubeLiveStream[]>('streams:youtube:all');
  }

  /**
   * 手動で同期を実行（常に現在の配信リストを送信）
   */
  async manualSync(): Promise<void> {
    console.log('[StreamSync] Manual sync triggered');
    await this.syncAllStreams(true); // forceNotify = true
  }

  /**
   * 優先度別にチャンネルを分類
   */
  getChannelClassification(): ChannelClassification {
    return priorityManager.classifyChannels();
  }

  /**
   * 遅延許容チャンネルのみを取得（ポーリング対象）
   */
  getDelayedChannels(): { youtube: string[], twitch: string[] } {
    const classification = this.getChannelClassification();
    return classification.delayed;
  }

  /**
   * リアルタイムチャンネルのみを取得（EventSub対象）
   */
  getRealtimeChannels(): { youtube: string[], twitch: string[] } {
    const classification = this.getChannelClassification();
    return classification.realtime;
  }

  /**
   * 現在の統計情報を取得
   */
  getStats(): {
    isRunning: boolean;
    userCount: number;
    youtubeStreamCount: number;
    twitchStreamCount: number;
  } {
    return {
      isRunning: this.isRunning,
      userCount: this.userSessions.size,
      youtubeStreamCount: this.previousYouTubeStreams.size,
      twitchStreamCount: this.previousTwitchStreams.size
    };
  }
}

// グローバルなトークンストレージ（セッションID → トークン）
class TokenStorage {
  private tokens: Map<string, { youtube?: string; twitch?: string }> = new Map();

  setToken(sessionId: string, platform: 'youtube' | 'twitch', token: string): void {
    const existing = this.tokens.get(sessionId) || {};
    existing[platform] = token;
    this.tokens.set(sessionId, existing);
    console.log(`[TokenStorage] Saved ${platform} token for session: ${sessionId}`);
  }

  getTokens(sessionId: string): { youtube?: string; twitch?: string } {
    return this.tokens.get(sessionId) || {};
  }

  deleteSession(sessionId: string): void {
    this.tokens.delete(sessionId);
    console.log(`[TokenStorage] Deleted tokens for session: ${sessionId}`);
  }
}

// シングルトンインスタンス
export const streamSyncService = new StreamSyncService();
export const tokenStorage = new TokenStorage();
