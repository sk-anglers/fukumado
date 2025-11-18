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
  | 'session_end'
  | 'login_button_clicked'
  | 'stream_selected'
  | 'stream_playback_started'
  | 'first_stream_playback'
  | 'multi_stream_active'
  | 'auth_completed'
  | 'stream_removed'
  | 'error_occurred'
  | 'engagement_time'
  | 'stream_swap'
  | 'quality_change'
  | 'search_performed'
  | 'volume_change'
  | 'chat_opened'
  | 'help_opened';

export type LayoutPreset = 'twoByTwo' | 'oneByTwo' | 'focus';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Platform = 'youtube' | 'twitch' | 'niconico';
export type UserType = 'new' | 'returning' | 'guest';
export type ReferrerType = 'organic' | 'paid' | 'direct' | 'social' | 'email' | 'referral' | 'unknown';

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
  // 分析強化用カスタムディメンション
  userType?: UserType;           // 新規/既存/ゲスト
  referrerType?: ReferrerType;   // 流入元タイプ
  deviceCategory?: DeviceType;   // デバイスカテゴリ（deviceTypeと同じだが明示的に）
  engagementScore?: number;      // エンゲージメントスコア（0-100）
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

// ファネル分析用イベント
export interface PageViewEvent extends BaseEventData {
  type: 'page_view';
  data: {
    pageLocation: string;      // 現在のURL状態（例: '/stream-grid-4slots'）
    pageTitle: string;          // ページタイトル（例: '4配信同時視聴中'）
    screenName: string;         // 画面名（例: 'stream_grid', 'welcome'）
    referrer?: string;          // リファラー
    engagementTimeMsec?: number; // 前の画面での滞在時間（ミリ秒）
    previousScreen?: string;    // 前の画面名
  };
}

export interface LoginButtonClickedEvent extends BaseEventData {
  type: 'login_button_clicked';
  data: {
    platform: Platform;         // youtube | twitch
    location: string;           // ボタンの配置場所（例: 'account_menu', 'header'）
  };
}

export interface StreamSelectedEvent extends BaseEventData {
  type: 'stream_selected';
  data: {
    platform: Platform;         // youtube | twitch | niconico
    streamId: string;           // 配信ID
    streamTitle: string;        // 配信タイトル
    channelName: string;        // チャンネル名
    channelId: string;          // チャンネルID
    slotId: string;             // 割り当てスロットID
    viewerCount?: number;       // 視聴者数（取得可能な場合）
  };
}

export interface StreamPlaybackStartedEvent extends BaseEventData {
  type: 'stream_playback_started';
  data: {
    platform: Platform;         // youtube | twitch | niconico
    streamId: string;           // 配信ID
    streamTitle: string;        // 配信タイトル
    channelName: string;        // チャンネル名
    channelId: string;          // チャンネルID
    slotId: string;             // 再生スロットID
    quality: string;            // 再生画質（例: '1080p', '720p', 'auto'）
    activeStreamsCount: number; // 同時視聴配信数
  };
}

// コンバージョンイベント
export interface FirstStreamPlaybackEvent extends BaseEventData {
  type: 'first_stream_playback';
  data: {
    platform: Platform;         // 初回視聴プラットフォーム
    streamId: string;           // 配信ID
    channelName: string;        // チャンネル名
    timeSincePageLoad: number;  // ページ読み込みから視聴開始までの時間（秒）
  };
}

export interface MultiStreamActiveEvent extends BaseEventData {
  type: 'multi_stream_active';
  data: {
    streamsCount: number;       // 同時視聴配信数
    platforms: Platform[];      // 視聴中のプラットフォーム一覧
    timeSinceFirstPlay: number; // 初回視聴から複数視聴開始までの時間（秒）
  };
}

export interface AuthCompletedEvent extends BaseEventData {
  type: 'auth_completed';
  data: {
    platform: Platform;         // 認証完了プラットフォーム
    timeSincePageLoad: number;  // ページ読み込みから認証完了までの時間（秒）
    hadPreviousAuth: boolean;   // 以前に認証済みだったか
  };
}

// 配信削除イベント
export interface StreamRemovedEvent extends BaseEventData {
  type: 'stream_removed';
  data: {
    platform: Platform;
    streamId: string;
    channelName: string;
    slotId: string;
    watchDuration?: number;        // 視聴時間（秒）
  };
}

// エラー発生イベント
export interface ErrorOccurredEvent extends BaseEventData {
  type: 'error_occurred';
  data: {
    errorType: string;              // 'player_load_error', 'api_error', 'network_error'等
    errorMessage: string;           // エラーメッセージ
    errorStack?: string;            // スタックトレース
    platform?: Platform;            // エラー発生プラットフォーム
    streamId?: string;              // 関連する配信ID
    componentName?: string;         // エラー発生コンポーネント
  };
}

// 画面別滞在時間イベント
export interface EngagementTimeEvent extends BaseEventData {
  type: 'engagement_time';
  data: {
    screenName: string;             // 画面名
    engagementTimeMsec: number;     // 滞在時間（ミリ秒）
    activeStreamsCount?: number;    // 視聴中配信数
  };
}

// 配信スワップイベント
export interface StreamSwapEvent extends BaseEventData {
  type: 'stream_swap';
  data: {
    fromSlotId: string;
    toSlotId: string;
    platform: Platform;
    streamId: string;
  };
}

// 画質変更イベント
export interface QualityChangeEvent extends BaseEventData {
  type: 'quality_change';
  data: {
    platform: Platform;
    streamId: string;
    slotId: string;
    previousQuality: string;
    newQuality: string;
  };
}

// 検索実行イベント
export interface SearchPerformedEvent extends BaseEventData {
  type: 'search_performed';
  data: {
    platform: Platform;
    query: string;
    resultsCount: number;
  };
}

// 音量変更イベント
export interface VolumeChangeEvent extends BaseEventData {
  type: 'volume_change';
  data: {
    platform: Platform;
    streamId: string;
    slotId: string;
    action: 'mute' | 'unmute' | 'volume_adjust';
    previousVolume?: number;
    newVolume?: number;
  };
}

// チャット表示イベント
export interface ChatOpenedEvent extends BaseEventData {
  type: 'chat_opened';
  data: {
    platform: Platform;
    channelId: string;
    channelName: string;
  };
}

// ヘルプ表示イベント
export interface HelpOpenedEvent extends BaseEventData {
  type: 'help_opened';
  data: {
    location: string;               // 'header', 'account_menu'等
  };
}

export type AnalyticsEvent =
  | LayoutChangeEvent
  | ButtonClickEvent
  | FeatureUseEvent
  | StreamActionEvent
  | AuthActionEvent
  | SessionStartEvent
  | SessionEndEvent
  | PageViewEvent
  | LoginButtonClickedEvent
  | StreamSelectedEvent
  | StreamPlaybackStartedEvent
  | FirstStreamPlaybackEvent
  | MultiStreamActiveEvent
  | AuthCompletedEvent
  | StreamRemovedEvent
  | ErrorOccurredEvent
  | EngagementTimeEvent
  | StreamSwapEvent
  | QualityChangeEvent
  | SearchPerformedEvent
  | VolumeChangeEvent
  | ChatOpenedEvent
  | HelpOpenedEvent;
