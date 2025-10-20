export type Platform = 'youtube' | 'twitch' | 'niconico';

export interface Streamer {
  id: string;
  platform: Platform;
  title: string;
  displayName: string;
  channelId?: string;
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
}

export interface ChatMessage {
  id: string;
  platform: Platform | 'system';
  author: string;
  message: string;
  timestamp: string;
  avatarColor: string;
  highlight?: boolean;
}

export type LayoutPreset = 'twoByTwo' | 'oneByTwo' | 'focus';
