/**
 * チャンネル優先度管理関連の型定義
 */

/**
 * 優先度レベル
 * - realtime: リアルタイム通知が必要（EventSub使用）
 * - delayed: 遅延許容（60秒ポーリング使用）
 */
export type PriorityLevel = 'realtime' | 'delayed';

/**
 * チャンネル優先度情報
 */
export interface ChannelPriority {
  channelId: string;
  userCount: number; // このチャンネルを視聴しているユーザー数（重複度）
  priority: PriorityLevel;
  userIds: string[]; // 視聴しているユーザーIDのリスト
  platform: 'youtube' | 'twitch';
}

/**
 * チャンネル統計情報
 */
export interface ChannelStats {
  channelId: string;
  platform: 'youtube' | 'twitch';
  viewerCount: number;
  priority: PriorityLevel;
}

/**
 * 優先度マネージャーの統計情報
 */
export interface PriorityStats {
  totalChannels: number;
  realtimeChannels: number; // 2人以上が視聴
  delayedChannels: number; // 1人のみが視聴
  totalUsers: number;
  channelsByPriority: {
    realtime: ChannelStats[];
    delayed: ChannelStats[];
  };
  topChannels: ChannelStats[]; // 視聴者数上位10チャンネル
}

/**
 * ユーザーのチャンネルリスト
 */
export interface UserChannels {
  userId: string;
  youtubeChannels: string[];
  twitchChannels: string[];
}

/**
 * 優先度変更イベント
 */
export interface PriorityChangeEvent {
  type: 'priority_changed';
  changes: {
    toRealtime: string[]; // 遅延許容 → リアルタイムに変更されたチャンネル
    toDelayed: string[]; // リアルタイム → 遅延許容に変更されたチャンネル
  };
  timestamp: string;
}

/**
 * チャンネル分類結果
 */
export interface ChannelClassification {
  realtime: {
    youtube: string[];
    twitch: string[];
  };
  delayed: {
    youtube: string[];
    twitch: string[];
  };
}
