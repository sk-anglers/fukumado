export type Platform = 'youtube' | 'twitch' | 'niconico';

export type VideoQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';

export interface QualityBandwidth {
  quality: VideoQuality;
  label: string;
  mbps: number;
}

export interface Streamer {
  id: string;
  platform: Platform;
  title: string;
  displayName: string;
  channelId?: string;
  channelLogin?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  liveSince?: string;
  viewerCount?: number;
  gameTitle?: string;
  description?: string;
  embedUrl?: string;
}

export interface StreamSlot {
  id: string;
  assignedStream?: Streamer;
  muted: boolean;
  volume: number;
  quality: VideoQuality;
}

export interface ChatMessage {
  id: string;
  platform: Platform | 'system';
  author: string;
  message: string;
  timestamp: string;
  avatarColor: string;
  highlight?: boolean;
  channelName?: string;
}

export type LayoutPreset = 'twoByTwo' | 'oneByTwo' | 'focus';

export interface ChannelSearchResult {
  id: string;
  platform: 'youtube' | 'twitch';
  title: string;
  description: string;
  thumbnailUrl: string;
  customUrl?: string;
  login?: string;
}

export type NotificationType = 'stream_started';

export interface Notification {
  id: string;
  type: NotificationType;
  platform: Platform;
  channelId: string;
  channelName: string;
  streamId: string;
  streamTitle: string;
  thumbnailUrl?: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  youtube: boolean;
  twitch: boolean;
  sound: boolean;
}

export type SyncInterval = 30000 | 60000 | 180000 | 300000; // 30秒、1分、3分、5分（ミリ秒）

export interface SyncSettings {
  enabled: boolean;
  interval: SyncInterval;
  lastSyncTime?: number;
}

export interface SyncStatus {
  syncing: boolean;
  lastSyncTime?: number;
}
