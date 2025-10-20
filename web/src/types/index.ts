export type Platform = 'youtube' | 'twitch' | 'niconico';

export interface Streamer {
  id: string;
  displayName: string;
  platform: Platform;
  title: string;
  gameTitle: string;
  liveSince: string;
  viewerCount: number;
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
