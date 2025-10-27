import type {
  ChannelPriority,
  ChannelStats,
  PriorityStats,
  PriorityLevel,
  UserChannels,
  PriorityChangeEvent,
  ChannelClassification
} from '../types/priority';

/**
 * チャンネル優先度管理クラス
 *
 * 重複度ベースの優先度判定を行う
 * - 2人以上が視聴: realtime（EventSub使用）
 * - 1人のみが視聴: delayed（60秒ポーリング使用）
 */
export class PriorityManager {
  // プラットフォーム別のチャンネル視聴者マップ
  // Map<channelId, Set<userId>>
  private youtubeChannelViewers: Map<string, Set<string>> = new Map();
  private twitchChannelViewers: Map<string, Set<string>> = new Map();

  // ユーザー別のチャンネルリスト
  // Map<userId, UserChannels>
  private userChannelsMap: Map<string, UserChannels> = new Map();

  // 前回の優先度（変更検出用）
  private previousPriorities: Map<string, PriorityLevel> = new Map();

  // 優先度変更イベントハンドラー
  private changeHandlers: Set<(event: PriorityChangeEvent) => void> = new Set();

  constructor() {
    console.log('[PriorityManager] Initialized');
  }

  /**
   * ユーザーのチャンネルリストを登録
   */
  public registerUser(userId: string, channels: { youtube: string[], twitch: string[] }): void {
    console.log(`[PriorityManager] Registering user: ${userId}, YouTube: ${channels.youtube.length}, Twitch: ${channels.twitch.length}`);

    // 既存の登録を削除
    this.unregisterUser(userId);

    // 新しいチャンネルリストを保存
    this.userChannelsMap.set(userId, {
      userId,
      youtubeChannels: channels.youtube,
      twitchChannels: channels.twitch
    });

    // YouTubeチャンネルを登録
    for (const channelId of channels.youtube) {
      if (!this.youtubeChannelViewers.has(channelId)) {
        this.youtubeChannelViewers.set(channelId, new Set());
      }
      this.youtubeChannelViewers.get(channelId)!.add(userId);
    }

    // Twitchチャンネルを登録
    for (const channelId of channels.twitch) {
      if (!this.twitchChannelViewers.has(channelId)) {
        this.twitchChannelViewers.set(channelId, new Set());
      }
      this.twitchChannelViewers.get(channelId)!.add(userId);
    }

    // 優先度を再計算して変更を検出
    this.detectAndNotifyChanges();
  }

  /**
   * ユーザーの登録を解除
   */
  public unregisterUser(userId: string): void {
    const userChannels = this.userChannelsMap.get(userId);
    if (!userChannels) {
      console.log(`[PriorityManager] User not found: ${userId}`);
      return;
    }

    console.log(`[PriorityManager] Unregistering user: ${userId}`);

    // YouTubeチャンネルから削除
    for (const channelId of userChannels.youtubeChannels) {
      const viewers = this.youtubeChannelViewers.get(channelId);
      if (viewers) {
        viewers.delete(userId);
        if (viewers.size === 0) {
          this.youtubeChannelViewers.delete(channelId);
        }
      }
    }

    // Twitchチャンネルから削除
    for (const channelId of userChannels.twitchChannels) {
      const viewers = this.twitchChannelViewers.get(channelId);
      if (viewers) {
        viewers.delete(userId);
        if (viewers.size === 0) {
          this.twitchChannelViewers.delete(channelId);
        }
      }
    }

    this.userChannelsMap.delete(userId);

    // 優先度を再計算して変更を検出
    this.detectAndNotifyChanges();
  }

  /**
   * 優先度を計算
   */
  private calculatePriority(viewerCount: number): PriorityLevel {
    // 2人以上が視聴 → リアルタイム
    // 1人のみが視聴 → 遅延許容
    return viewerCount >= 2 ? 'realtime' : 'delayed';
  }

  /**
   * 全チャンネルの優先度を計算
   */
  public calculatePriorities(): ChannelPriority[] {
    const priorities: ChannelPriority[] = [];

    // YouTubeチャンネルの優先度
    Array.from(this.youtubeChannelViewers.entries()).forEach(([channelId, viewers]) => {
      const userCount = viewers.size;
      const priority = this.calculatePriority(userCount);

      priorities.push({
        channelId,
        userCount,
        priority,
        userIds: Array.from(viewers),
        platform: 'youtube'
      });
    });

    // Twitchチャンネルの優先度
    Array.from(this.twitchChannelViewers.entries()).forEach(([channelId, viewers]) => {
      const userCount = viewers.size;
      const priority = this.calculatePriority(userCount);

      priorities.push({
        channelId,
        userCount,
        priority,
        userIds: Array.from(viewers),
        platform: 'twitch'
      });
    });

    // 視聴者数の降順でソート
    return priorities.sort((a, b) => b.userCount - a.userCount);
  }

  /**
   * 優先度の変更を検出して通知
   */
  private detectAndNotifyChanges(): void {
    const currentPriorities = this.calculatePriorities();
    const currentPriorityMap = new Map<string, PriorityLevel>();

    // 現在の優先度をマップに変換
    for (const { channelId, priority, platform } of currentPriorities) {
      const key = `${platform}:${channelId}`;
      currentPriorityMap.set(key, priority);
    }

    // 変更を検出
    const toRealtime: string[] = [];
    const toDelayed: string[] = [];

    // 新しい優先度と前回の優先度を比較
    Array.from(currentPriorityMap.entries()).forEach(([key, currentPriority]) => {
      const previousPriority = this.previousPriorities.get(key);

      if (previousPriority && previousPriority !== currentPriority) {
        if (currentPriority === 'realtime') {
          toRealtime.push(key);
          console.log(`[PriorityManager] Priority changed to REALTIME: ${key}`);
        } else {
          toDelayed.push(key);
          console.log(`[PriorityManager] Priority changed to DELAYED: ${key}`);
        }
      }
    });

    // 削除されたチャンネルを検出
    Array.from(this.previousPriorities.keys()).forEach((key) => {
      if (!currentPriorityMap.has(key)) {
        console.log(`[PriorityManager] Channel removed: ${key}`);
      }
    });

    // 前回の優先度を更新
    this.previousPriorities = currentPriorityMap;

    // 変更があればイベントを通知
    if (toRealtime.length > 0 || toDelayed.length > 0) {
      const event: PriorityChangeEvent = {
        type: 'priority_changed',
        changes: { toRealtime, toDelayed },
        timestamp: new Date().toISOString()
      };

      this.notifyChange(event);
    }
  }

  /**
   * チャンネルを優先度別に分類
   */
  public classifyChannels(): ChannelClassification {
    const priorities = this.calculatePriorities();

    const classification: ChannelClassification = {
      realtime: { youtube: [], twitch: [] },
      delayed: { youtube: [], twitch: [] }
    };

    for (const { channelId, priority, platform } of priorities) {
      if (priority === 'realtime') {
        classification.realtime[platform].push(channelId);
      } else {
        classification.delayed[platform].push(channelId);
      }
    }

    return classification;
  }

  /**
   * 統計情報を取得
   */
  public getStats(): PriorityStats {
    const priorities = this.calculatePriorities();

    const realtimeChannels: ChannelStats[] = [];
    const delayedChannels: ChannelStats[] = [];

    for (const { channelId, userCount, priority, platform } of priorities) {
      const stats: ChannelStats = {
        channelId,
        platform,
        viewerCount: userCount,
        priority
      };

      if (priority === 'realtime') {
        realtimeChannels.push(stats);
      } else {
        delayedChannels.push(stats);
      }
    }

    // 視聴者数上位10チャンネル
    const topChannels = [...priorities]
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 10)
      .map(p => ({
        channelId: p.channelId,
        platform: p.platform,
        viewerCount: p.userCount,
        priority: p.priority
      }));

    return {
      totalChannels: priorities.length,
      realtimeChannels: realtimeChannels.length,
      delayedChannels: delayedChannels.length,
      totalUsers: this.userChannelsMap.size,
      channelsByPriority: {
        realtime: realtimeChannels,
        delayed: delayedChannels
      },
      topChannels
    };
  }

  /**
   * 優先度変更イベントハンドラーを登録
   */
  public onChange(handler: (event: PriorityChangeEvent) => void): () => void {
    this.changeHandlers.add(handler);
    console.log(`[PriorityManager] Change handler added. Total handlers: ${this.changeHandlers.size}`);

    return () => {
      this.changeHandlers.delete(handler);
      console.log(`[PriorityManager] Change handler removed. Total handlers: ${this.changeHandlers.size}`);
    };
  }

  /**
   * 変更を通知
   */
  private notifyChange(event: PriorityChangeEvent): void {
    console.log(`[PriorityManager] Priority changes detected - To Realtime: ${event.changes.toRealtime.length}, To Delayed: ${event.changes.toDelayed.length}`);

    this.changeHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('[PriorityManager] Error in change handler:', error);
      }
    });
  }

  /**
   * 特定のチャンネルの優先度を取得
   */
  public getChannelPriority(channelId: string, platform: 'youtube' | 'twitch'): PriorityLevel | null {
    const viewers = platform === 'youtube'
      ? this.youtubeChannelViewers.get(channelId)
      : this.twitchChannelViewers.get(channelId);

    if (!viewers) {
      return null;
    }

    return this.calculatePriority(viewers.size);
  }

  /**
   * 登録されている全ユーザーIDを取得
   */
  public getUserIds(): string[] {
    return Array.from(this.userChannelsMap.keys());
  }

  /**
   * リアルタイム優先度のチャンネル数を取得
   */
  public getRealtimeChannelCount(): number {
    const classification = this.classifyChannels();
    return classification.realtime.youtube.length + classification.realtime.twitch.length;
  }

  /**
   * 遅延許容のチャンネル数を取得
   */
  public getDelayedChannelCount(): number {
    const classification = this.classifyChannels();
    return classification.delayed.youtube.length + classification.delayed.twitch.length;
  }
}

// シングルトンインスタンス
export const priorityManager = new PriorityManager();
