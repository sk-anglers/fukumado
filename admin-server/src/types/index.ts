// システムメトリクス
export interface SystemMetrics {
  cpu: number;                   // CPU使用率（%）
  memory: number;                // メモリ使用量（MB）
  uptime: number;                // 稼働時間（秒）
  wsConnections: number;         // WebSocket総接続数
  activeWsConnections?: number;  // WebSocketアクティブ接続数（オプション）
  streamSyncCount: number;       // 配信同期数
  timestamp: string;             // ISO 8601形式
}

// PV統計（日次/月次）
export interface PVDailyStats {
  date: string;            // YYYY-MM-DD
  pv: number;             // ページビュー数
  uniqueUsers: number;    // ユニークユーザー数
}

export interface PVMonthlyStats {
  month: string;          // YYYY-MM
  pv: number;             // ページビュー数
  uniqueUsers: number;    // ユニークユーザー数
}

// PV統計（全体）
export interface PVStats {
  today: {
    pv: number;
    uniqueUsers: number;
  };
  month: {
    pv: number;
    uniqueUsers: number;
  };
  total: number;          // 累計PV
  daily: PVDailyStats[];  // 過去30日分
  monthly: PVMonthlyStats[]; // 過去12ヶ月分
  timestamp: string;      // ISO 8601形式
}

// APIレート制限（Twitch）
export interface TwitchRateLimit {
  remaining: number;        // 残りリクエスト数
  limit: number;            // 制限値（800/分）
  resetAt: string;          // リセット時刻（ISO 8601）
  usagePercent: number;     // 使用率（%）
}

// YouTubeクォータ
export interface YouTubeQuota {
  used: number;             // 使用量（ユニット）
  limit: number;            // 制限値（10,000/日）
  remaining: number;        // 残量
  usagePercent: number;     // 使用率（%）
  resetAt: string;          // リセット時刻
}

// エンドポイント統計
export interface EndpointStats {
  endpoint: string;         // エンドポイント名
  method: string;           // HTTPメソッド
  totalRequests: number;    // 総リクエスト数
  avgResponseTime: number;  // 平均応答時間（ms）
  errorRate: number;        // エラー率（%）
  lastAccess: string;       // 最終アクセス時刻
}

// セキュリティメトリクス
export interface SecurityMetrics {
  totalUniqueIPs: number;   // 総ユニークIP数（過去1時間）
  blockedIPs: number;       // ブロック中IP数
  suspiciousIPs: number;    // 疑わしいIP数（スコア50以上）
  whitelistIPs: number;     // ホワイトリストIP数
  recentAlerts: Alert[];    // 最近のアラート
  topIPs: IPInfo[];         // アクセス上位IP
}

// IPアクセス情報
export interface IPInfo {
  ip: string;
  requestCount: number;     // リクエスト数
  lastAccess: string;       // 最終アクセス時刻
  suspicionScore: number;   // 疑わしさスコア（0-100）
  blocked: boolean;         // ブロック状態
  whitelisted: boolean;     // ホワイトリスト状態
  country?: string;         // 国（オプション）
}

// アラート
export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

// EventSub接続状態
export interface EventSubStatus {
  status: 'connected' | 'disconnected' | 'reconnecting';
  connectedAt: string | null;
  reconnectCount: number;
  totalEvents: number;
  subscriptionCount: number;
}

// メンテナンスモード
export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  enabledAt?: string;
  bypassToken?: string;
  expiresAt?: string;
  duration?: number; // メンテナンス時間（分単位、0=無期限）
  scheduledEndAt?: string; // 終了予定時刻
}

// WebSocketメッセージ型
export interface WebSocketMessage {
  type: 'metrics_update' | 'alert' | 'security_event';
  data: any;
  timestamp: string;
}

// API応答型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Redis キー定数
export const REDIS_KEYS = {
  // メトリクス
  METRICS_SYSTEM_LATEST: 'admin:metrics:system:latest',
  METRICS_SYSTEM_CPU: 'admin:metrics:system:cpu',
  METRICS_SYSTEM_MEMORY: 'admin:metrics:system:memory',
  METRICS_SYSTEM_UPTIME: 'admin:metrics:system:uptime',
  METRICS_WS_CONNECTIONS: 'admin:metrics:ws:connections',
  METRICS_API_TWITCH_RATELIMIT: 'admin:metrics:api:twitch:ratelimit',
  METRICS_API_YOUTUBE_QUOTA: 'admin:metrics:api:youtube:quota',

  // セキュリティ
  SECURITY_ACCESS_LOG: (ip: string, timestamp: number) =>
    `admin:security:access_log:${ip}:${timestamp}`,
  SECURITY_BLOCKED_PERMANENT: (ip: string) =>
    `admin:security:blocked:permanent:${ip}`,
  SECURITY_BLOCKED_TEMP: (ip: string) =>
    `admin:security:blocked:temp:${ip}`,
  SECURITY_WHITELIST: (ip: string) =>
    `admin:security:whitelist:${ip}`,
  SECURITY_SUSPICIOUS: (ip: string) =>
    `admin:security:suspicious:${ip}`,
  SECURITY_ALERTS: 'admin:security:alerts',

  // メンテナンス
  MAINTENANCE_ENABLED: 'admin:maintenance:enabled',
  MAINTENANCE_MESSAGE: 'admin:maintenance:message',
  MAINTENANCE_BYPASS: (token: string) =>
    `admin:maintenance:bypass:${token}`,

  // EventSub
  EVENTSUB_STATUS: 'admin:eventsub:ws:status',
  EVENTSUB_EVENTS_COUNT: 'admin:eventsub:events:count',
  EVENTSUB_SUBSCRIPTIONS: 'admin:eventsub:subscriptions',
} as const;

// TTL定数（秒）
export const TTL = {
  METRICS_SHORT: 60,        // 1分（システムメトリクス）
  METRICS_MEDIUM: 300,      // 5分（APIレート制限）
  METRICS_LONG: 3600,       // 1時間（エンドポイント統計）
  SECURITY_LOG: 86400,      // 24時間（アクセスログ）
  SECURITY_TEMP_BLOCK: 3600, // 1時間（一時ブロック）
  MAINTENANCE_BYPASS: 3600,  // 1時間（Bypass URL）
} as const;

// ========================================
// アナリティクス関連の型定義
// ========================================

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

/**
 * 機能タイプ
 */
export type FeatureType =
  | 'chat'
  | 'emote'
  | 'search'
  | 'sync'
  | 'quality_change';

/**
 * 配信アクションタイプ
 */
export type StreamActionType =
  | 'assign'
  | 'clear'
  | 'mute'
  | 'unmute'
  | 'volume_change'
  | 'quality_change'
  | 'swap';

/**
 * アナリティクス統計データ
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
    slotsDistribution: Record<number, number>;
    presetDistribution: Record<LayoutPreset, number>;
  };

  // デバイス統計
  device: {
    distribution: Record<DeviceType, number>;
    screenSizes: Array<{ width: number; height: number; count: number }>;
  };

  // ボタン統計
  buttons: {
    clicks: Record<ButtonType, number>;
  };

  // 機能統計
  features: {
    usage: Record<FeatureType, number>;
    platformUsage: Record<Platform, number>;
  };

  // 配信操作統計
  streams: {
    actions: Record<StreamActionType, number>;
    platformActions: Record<Platform, number>;
  };

  // 認証統計
  auth: {
    logins: Record<Platform, number>;
    logouts: Record<Platform, number>;
  };

  // セッション統計
  sessions: {
    averageDuration: number;
    averagePageViews: number;
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
