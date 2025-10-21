import { fetchLiveStreams, type YouTubeLiveStream } from './youtubeService';
import { cacheService } from './cacheService';

// キャッシュキー
const YOUTUBE_CACHE_KEY = 'streams:youtube:default';

// キャッシュTTL（秒）
const CACHE_TTL = 300; // 5分

// 同期間隔（ミリ秒）
const SYNC_INTERVAL = 300000; // 5分

// デフォルトのフォールバッククエリ
const DEFAULT_QUERIES = [
  'Apex Legends',
  'Valorant',
  'League of Legends',
  'Minecraft'
];

class StreamSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * YouTube配信リストの同期を実行
   */
  private async syncYouTubeStreams(): Promise<void> {
    try {
      console.log('[StreamSync] Starting YouTube streams sync...');

      const allStreams: YouTubeLiveStream[] = [];

      // 各クエリで配信を取得
      for (const query of DEFAULT_QUERIES) {
        try {
          console.log(`[StreamSync] Fetching YouTube streams for query: "${query}"`);
          const streams = await fetchLiveStreams({
            query,
            maxResults: 10
          });

          console.log(`[StreamSync] Found ${streams.length} streams for "${query}"`);
          allStreams.push(...streams);
        } catch (error) {
          console.error(`[StreamSync] Failed to fetch streams for query "${query}":`, error);
        }
      }

      // 重複を除去（同じvideoIdの配信）
      const uniqueStreams = Array.from(
        new Map(allStreams.map(stream => [stream.id, stream])).values()
      );

      console.log(`[StreamSync] Total unique YouTube streams: ${uniqueStreams.length}`);

      // Redisにキャッシュ
      if (cacheService.isConnected()) {
        await cacheService.set(YOUTUBE_CACHE_KEY, uniqueStreams, CACHE_TTL);
        console.log(`[StreamSync] Cached ${uniqueStreams.length} YouTube streams (TTL: ${CACHE_TTL}s)`);
      } else {
        console.warn('[StreamSync] Redis not connected, skipping cache');
      }
    } catch (error) {
      console.error('[StreamSync] Error syncing YouTube streams:', error);
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
    this.syncYouTubeStreams().catch(err => {
      console.error('[StreamSync] Initial sync failed:', err);
    });

    // 定期実行を設定
    this.intervalId = setInterval(() => {
      this.syncYouTubeStreams().catch(err => {
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
   * キャッシュされたYouTube配信リストを取得
   */
  async getCachedYouTubeStreams(): Promise<YouTubeLiveStream[] | null> {
    if (!cacheService.isConnected()) {
      console.warn('[StreamSync] Redis not connected');
      return null;
    }

    const cached = await cacheService.get<YouTubeLiveStream[]>(YOUTUBE_CACHE_KEY);
    if (cached) {
      console.log(`[StreamSync] Retrieved ${cached.length} cached YouTube streams`);
    } else {
      console.log('[StreamSync] No cached YouTube streams found');
    }
    return cached;
  }

  /**
   * 手動で同期を実行
   */
  async manualSync(): Promise<void> {
    console.log('[StreamSync] Manual sync triggered');
    await this.syncYouTubeStreams();
  }
}

// シングルトンインスタンス
export const streamSyncService = new StreamSyncService();
