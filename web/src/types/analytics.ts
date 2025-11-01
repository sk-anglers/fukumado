/**
 * イベントトラッキング用の型定義（フロントエンド用）
 */

export type EventType =
  | 'page_view'
  | 'layout_change'
  | 'button_click'
  | 'feature_use'
  | 'stream_action'
  | 'auth_action'
  | 'session_start'
  | 'session_end';

export type LayoutPreset = 'twoByTwo' | 'oneByTwo' | 'focus';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Platform = 'youtube' | 'twitch' | 'niconico';

export type ButtonType =
  | 'sync_start'
  | 'sync_stop'
  | 'mute_all'
  | 'fullscreen'
  | 'layout_preset'
  | 'slot_add'
  | 'slot_remove'
  | 'stream_search'
  | 'auth_youtube'
  | 'auth_twitch'
  | 'logout';

export type FeatureType =
  | 'chat'
  | 'emote'
  | 'search'
  | 'sync'
  | 'quality_change';

export type StreamActionType =
  | 'assign'
  | 'clear'
  | 'mute'
  | 'unmute'
  | 'volume_change'
  | 'quality_change'
  | 'swap';

export interface BaseEventData {
  sessionId?: string;
  userId?: string;
  timestamp: string;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  deviceType?: DeviceType;
}

export interface LayoutChangeEvent extends BaseEventData {
  type: 'layout_change';
  data: {
    slotsCount: number;
    preset: LayoutPreset;
    previousSlotsCount?: number;
    previousPreset?: LayoutPreset;
  };
}

export interface ButtonClickEvent extends BaseEventData {
  type: 'button_click';
  data: {
    buttonType: ButtonType;
    location?: string;
  };
}

export interface FeatureUseEvent extends BaseEventData {
  type: 'feature_use';
  data: {
    featureType: FeatureType;
    platform?: Platform;
    duration?: number;
  };
}

export interface StreamActionEvent extends BaseEventData {
  type: 'stream_action';
  data: {
    actionType: StreamActionType;
    platform: Platform;
    slotId?: string;
    value?: number;
  };
}

export interface AuthActionEvent extends BaseEventData {
  type: 'auth_action';
  data: {
    platform: Platform;
    action: 'login' | 'logout';
    success: boolean;
  };
}

export interface SessionStartEvent extends BaseEventData {
  type: 'session_start';
  data: {
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
}

export interface SessionEndEvent extends BaseEventData {
  type: 'session_end';
  data: {
    duration: number;
    pageViews: number;
  };
}

export type AnalyticsEvent =
  | LayoutChangeEvent
  | ButtonClickEvent
  | FeatureUseEvent
  | StreamActionEvent
  | AuthActionEvent
  | SessionStartEvent
  | SessionEndEvent;
