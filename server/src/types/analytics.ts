/**
 * イベントトラッキング用の型定義
 */

/**
 * イベントタイプ
 */
export type EventType =
  | 'page_view'           // ページビュー
  | 'layout_change'       // レイアウト変更
  | 'button_click'        // ボタンクリック
  | 'feature_use'         // 機能使用
  | 'stream_action'       // 配信操作
  | 'auth_action'         // 認証操作
  | 'session_start'       // セッション開始
  | 'session_end';        // セッション終了

/**
 * レイアウトプリセット
 */
export type LayoutPreset = 'twoByTwo' | 'oneByTwo' | 'focus';

/**
 * デバイスタイプ
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * プラットフォーム
 */
export type Platform = 'youtube' | 'twitch' | 'niconico';

/**
 * ボタンタイプ
 */
export type ButtonType =
  | 'sync_start'          // 同期開始
  | 'sync_stop'           // 同期停止
  | 'mute_all'            // 全ミュート
  | 'fullscreen'          // フルスクリーン
  | 'layout_preset'       // レイアウトプリセット選択
  | 'slot_add'            // スロット追加
  | 'slot_remove'         // スロット削除
  | 'stream_search'       // 配信検索
  | 'auth_youtube'        // YouTube認証
  | 'auth_twitch'         // Twitch認証
  | 'logout';             // ログアウト

/**
 * 機能タイプ
 */
export type FeatureType =
  | 'chat'                // チャット機能
  | 'emote'               // エモート機能
  | 'search'              // 検索機能
  | 'sync'                // 同期機能
  | 'quality_change';     // 画質変更

/**
 * 配信アクションタイプ
 */
export type StreamActionType =
  | 'assign'              // 配信割り当て
  | 'clear'               // 配信削除
  | 'mute'                // ミュート
  | 'unmute'              // ミュート解除
  | 'volume_change'       // 音量変更
  | 'quality_change'      // 画質変更
  | 'swap';               // スロット入れ替え

/**
 * イベントデータの共通フィールド
 */
export interface BaseEventData {
  sessionId?: string;     // セッションID
  userId?: string;        // ユーザーID（認証済みの場合）
  timestamp: string;      // タイムスタンプ
  userAgent?: string;     // User-Agent
  screenWidth?: number;   // 画面幅
  screenHeight?: number;  // 画面高さ
  deviceType?: DeviceType; // デバイスタイプ
}

/**
 * レイアウト変更イベント
 */
export interface LayoutChangeEvent extends BaseEventData {
  type: 'layout_change';
  data: {
    slotsCount: number;      // 分割数
    preset: LayoutPreset;    // レイアウトプリセット
    previousSlotsCount?: number;  // 変更前の分割数
    previousPreset?: LayoutPreset; // 変更前のプリセット
  };
}

/**
 * ボタンクリックイベント
 */
export interface ButtonClickEvent extends BaseEventData {
  type: 'button_click';
  data: {
    buttonType: ButtonType;  // ボタンタイプ
    location?: string;        // ボタンの位置（header, sidebar など）
  };
}

/**
 * 機能使用イベント
 */
export interface FeatureUseEvent extends BaseEventData {
  type: 'feature_use';
  data: {
    featureType: FeatureType;  // 機能タイプ
    platform?: Platform;        // プラットフォーム（該当する場合）
    duration?: number;          // 使用時間（ミリ秒）
  };
}

/**
 * 配信操作イベント
 */
export interface StreamActionEvent extends BaseEventData {
  type: 'stream_action';
  data: {
    actionType: StreamActionType;  // アクションタイプ
    platform: Platform;             // プラットフォーム
    slotId?: string;                // スロットID
    value?: number;                 // 値（音量など）
  };
}

/**
 * 認証操作イベント
 */
export interface AuthActionEvent extends BaseEventData {
  type: 'auth_action';
  data: {
    platform: Platform;      // プラットフォーム
    action: 'login' | 'logout';  // アクション
    success: boolean;        // 成功/失敗
  };
}

/**
 * セッション開始イベント
 */
export interface SessionStartEvent extends BaseEventData {
  type: 'session_start';
  data: {
    referrer?: string;       // リファラー
    utmSource?: string;      // UTMソース
    utmMedium?: string;      // UTMメディア
    utmCampaign?: string;    // UTMキャンペーン
  };
}

/**
 * セッション終了イベント
 */
export interface SessionEndEvent extends BaseEventData {
  type: 'session_end';
  data: {
    duration: number;        // セッション時間（ミリ秒）
    pageViews: number;       // ページビュー数
  };
}

/**
 * イベントの統合型
 */
export type AnalyticsEvent =
  | LayoutChangeEvent
  | ButtonClickEvent
  | FeatureUseEvent
  | StreamActionEvent
  | AuthActionEvent
  | SessionStartEvent
  | SessionEndEvent;

/**
 * 統計データ型
 */
export interface AnalyticsStats {
  // 全体統計
  total: {
    events: number;
    sessions: number;
    uniqueUsers: number;
  };

  // レイアウト統計
  layout: {
    slotsDistribution: Record<number, number>;  // 分割数別の使用回数
    presetDistribution: Record<LayoutPreset, number>;  // プリセット別の使用回数
  };

  // デバイス統計
  device: {
    distribution: Record<DeviceType, number>;  // デバイス別の使用回数
    screenSizes: Array<{ width: number; height: number; count: number }>;
  };

  // ボタン統計
  buttons: {
    clicks: Record<ButtonType, number>;  // ボタン別のクリック数
  };

  // 機能統計
  features: {
    usage: Record<FeatureType, number>;  // 機能別の使用回数
    platformUsage: Record<Platform, number>;  // プラットフォーム別の使用回数
  };

  // 配信操作統計
  streams: {
    actions: Record<StreamActionType, number>;  // アクション別の実行回数
    platformActions: Record<Platform, number>;  // プラットフォーム別の操作回数
  };

  // 認証統計
  auth: {
    logins: Record<Platform, number>;   // プラットフォーム別のログイン回数
    logouts: Record<Platform, number>;  // プラットフォーム別のログアウト回数
  };

  // セッション統計
  sessions: {
    averageDuration: number;  // 平均セッション時間（ミリ秒）
    averagePageViews: number; // 平均ページビュー数
  };

  // 時系列データ
  timeline: {
    daily: Array<{
      date: string;
      events: number;
      sessions: number;
      uniqueUsers: number;
    }>;
  };
}
