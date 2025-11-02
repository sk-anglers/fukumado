/**
 * API レスポンス型
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * システムメトリクス
 */
export interface SystemMetrics {
  cpu: number;                   // CPU使用率（%）
  memory: number;                // メモリ使用量（MB）
  uptime: number;                // 稼働時間（秒）
  wsConnections: number;         // WebSocket総接続数
  activeWsConnections?: number;  // WebSocketアクティブ接続数（オプション）
  streamSyncCount: number;       // 配信同期数
  timestamp: string;             // ISO 8601形式
}

/**
 * Twitch APIレート制限情報
 */
export interface TwitchRateLimit {
  remaining: number;        // 残りリクエスト数
  limit: number;            // 制限値
  resetAt: string;          // リセット時刻（ISO 8601形式）
  usagePercent: number;     // 使用率（%）
}

/**
 * YouTube APIクォータ情報
 */
export interface YouTubeQuota {
  used: number;             // 使用済みクォータ
  limit: number;            // クォータ制限
  remaining: number;        // 残りクォータ
  usagePercent: number;     // 使用率（%）
  resetAt: string;          // リセット時刻（ISO 8601形式）
}

/**
 * セキュリティメトリクス（管理ダッシュボード用）
 */
export interface SecurityMetrics {
  totalUniqueIPs: number;   // 総ユニークIP数（過去1時間）
  blockedIPs: number;       // ブロック中IP数
  suspiciousIPs: number;    // 疑わしいIP数（スコア50以上）
  whitelistIPs: number;     // ホワイトリストIP数
  recentAlerts: Alert[];    // 最近のアラート
  topIPs: IPInfo[];         // アクセス上位IP
}

/**
 * IPアクセス情報
 */
export interface IPInfo {
  ip: string;
  requestCount: number;     // リクエスト数
  lastAccess: string;       // 最終アクセス時刻
  suspicionScore: number;   // 疑わしさスコア（0-100）
  blocked: boolean;         // ブロック状態
  whitelisted: boolean;     // ホワイトリスト状態
  country?: string;         // 国（オプション）
}

/**
 * アラート
 */
export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;        // ISO 8601形式
  details?: Record<string, any>;
  read?: boolean;           // 既読フラグ
}

/**
 * メンテナンスモード状態
 */
export interface MaintenanceStatus {
  enabled: boolean;
  message?: string;
  enabledAt?: string;       // ISO 8601形式
  bypassToken?: string;     // バイパストークン
  expiresAt?: string;       // バイパストークンの有効期限（ISO 8601形式）
  duration?: number;        // メンテナンス時間（分単位、0=無期限）
  scheduledEndAt?: string;  // 終了予定時刻（ISO 8601形式）
}

/**
 * YouTube配信情報
 */
export interface YouTubeLiveStream {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
}

/**
 * Twitch配信情報
 */
export interface TwitchLiveStream {
  id: string;
  userId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string;
  startedAt: string;
}

/**
 * 配信統計
 */
export interface StreamStats {
  isRunning: boolean;
  userCount: number;
  youtubeStreamCount: number;
  twitchStreamCount: number;
  totalStreamCount: number;
}

/**
 * 配信詳細情報
 */
export interface StreamDetails {
  stats: StreamStats;
  streams: {
    youtube: YouTubeLiveStream[];
    twitch: TwitchLiveStream[];
  };
  timestamp: string;
}

/**
 * WebSocketメッセージ型
 */
export interface WebSocketMessage {
  type: 'metrics_update' | 'security_alert' | 'connection_status';
  data: any;
  timestamp: string;
}

/**
 * ナビゲーションアイテム
 */
export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
}

/**
 * ユーザー設定
 */
export interface UserSettings {
  theme: 'light' | 'dark';
  refreshInterval: number;  // メトリクス更新間隔（ミリ秒）
  enableNotifications: boolean;
  enableSounds: boolean;
}

// ========================================
// 本サービスのセキュリティ統計型定義
// ========================================

/**
 * IPブロックリスト統計
 */
export interface IPBlocklistStats {
  blockedCount: number;
  violationCount: number;
}

/**
 * WebSocket統計
 */
export interface WebSocketStats {
  totalConnections: number;
  connectionsPerIP: Record<string, number>;
  maxConnectionsPerIP: number;
}

/**
 * 異常検知統計
 */
export interface AnomalyDetectionStats {
  totalAlerts: number;
  recentAlerts: number;
  alertsBySeverity: Record<string, number>;
  alertsByType: Record<string, number>;
}

/**
 * アクセスログ統計
 */
export interface AccessLogStats {
  totalRequests: number;
  uniqueIPs: number;
  topPaths: Array<{ path: string; count: number }>;
  topIPs: Array<{ ip: string; count: number }>;
  errorBreakdown: Array<{ statusCode: number; count: number }>;
  uptime: number;
}

/**
 * 本サービスのセキュリティ統計（全体）
 */
export interface MainServiceSecurityStats {
  timestamp: string;
  ipBlocklist: IPBlocklistStats;
  websocket: WebSocketStats;
  anomalyDetection: AnomalyDetectionStats;
  accessLog: AccessLogStats;
  system: {
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
  };
}

/**
 * 異常検知アラート
 */
export interface AnomalyAlert {
  id: string;
  timestamp: string;
  type: 'traffic_spike' | 'suspicious_pattern' | 'failed_auth' | 'error_spike' | 'unusual_endpoint';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip: string;
  description: string;
  metadata: Record<string, any>;
}

/**
 * 異常検知アラート一覧レスポンス
 */
export interface AnomalyAlertsResponse {
  total: number;
  limit: number;
  alerts: AnomalyAlert[];
}

/**
 * セッション統計
 */
export interface SessionStats {
  totalActiveSessions: number;
  oldestSessionAge: number; // 分単位
  averageSessionAge: number; // 分単位
}

/**
 * ヘルスチェック
 */
export interface HealthCheck {
  status: string;
  message?: string;
}

/**
 * 本サービスのヘルスチェック
 */
export interface MainServiceHealthCheck {
  status: 'healthy' | 'warning' | 'critical' | 'error';
  timestamp: string;
  checks: {
    anomalyDetection: {
      status: string;
      criticalAlerts: number;
      highAlerts: number;
      recentAlerts: number;
    };
    websocket: {
      status: string;
      totalConnections: number;
      maxPerIP: number;
    };
    ipBlocklist: {
      status: string;
      blockedIPs: number;
      violationRecords: number;
    };
    system: {
      status: string;
      uptime: number;
      memoryUsage: number;
    };
  };
}

/**
 * セキュリティサマリー
 */
export interface SecuritySummary {
  period: string;
  totalRequests: number;
  blockedRequests: number;
  suspiciousIPs: number;
  topThreats: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
  recommendations: string[];
}

// ========================================
// ユーザー/セッション管理型定義
// ========================================

/**
 * Googleユーザー情報
 */
export interface GoogleUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Twitchユーザー情報
 */
export interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
}

/**
 * セッション情報
 */
export interface SessionInfo {
  sessionId: string;
  authenticated: boolean;
  twitchAuthenticated: boolean;
  googleUser: GoogleUser | null;
  twitchUser: TwitchUser | null;
  createdAt: string | null;
  lastActivity: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * セッション統計情報
 */
export interface SessionStatsInfo {
  totalSessions: number;
  authenticatedSessions: number;
  youtubeAuthSessions: number;
  twitchAuthSessions: number;
}

/**
 * セッション一覧レスポンス
 */
export interface SessionListResponse {
  sessions: SessionInfo[];
  stats: SessionStatsInfo;
}

/**
 * 最近のログイン情報
 */
export interface RecentLogin {
  googleUser: GoogleUser | null;
  twitchUser: TwitchUser | null;
  createdAt: string | null;
}

/**
 * ユーザー統計情報
 */
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  youtubeUsers: number;
  twitchUsers: number;
  recentLogins: RecentLogin[];
}

// ========================================
// ログ閲覧型定義
// ========================================

/**
 * アクセスログエントリ
 */
export interface AccessLogEntry {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  userAgent: string;
  sessionId?: string;
}

/**
 * エラーログエントリ
 */
export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

/**
 * セキュリティログエントリ
 */
export interface SecurityLogEntry {
  id: string;
  timestamp: string;
  type: 'block' | 'rate_limit' | 'anomaly' | 'auth_failed' | 'websocket';
  ip: string;
  path?: string;
  reason: string;
  metadata?: Record<string, any>;
}

/**
 * ログ一覧レスポンス
 */
export interface LogListResponse<T> {
  logs: T[];
  total: number;
}

/**
 * ログサマリー
 */
export interface LogSummary {
  totalAccessLogs: number;
  totalErrorLogs: number;
  totalSecurityLogs: number;
  recentErrors: number;
  recentSecurityEvents: number;
}

// ========================================
// EventSub管理型定義
// ========================================

/**
 * 接続ステータス
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * EventSub接続統計
 */
export interface EventSubConnectionStats {
  index: number;
  status: ConnectionStatus;
  sessionId: string | null;
  subscriptionCount: number;
  subscribedUserIds: string[];
  connectedAt: string | null;
}

/**
 * Conduits統計情報
 */
export interface ConduitStats {
  conduitId: string | null;
  totalShards: number;
  enabledShards: number;
  disabledShards: number;
  totalSubscriptions: number;
  usagePercentage: number;
}

/**
 * EventSubManager統計
 */
export interface EventSubManagerStats {
  mode: 'websocket' | 'conduit';
  totalConnections: number;
  activeConnections: number;
  totalSubscriptions: number;
  subscribedChannelCount: number;
  connections: EventSubConnectionStats[];
  conduitStats?: ConduitStats;
}

/**
 * EventSub容量情報
 */
export interface EventSubCapacity {
  used: number;
  total: number;
  available: number;
  percentage: number;
}

/**
 * EventSub統計レスポンス
 */
export interface EventSubStatsResponse {
  stats: EventSubManagerStats;
  capacity: EventSubCapacity;
}

/**
 * EventSub購読情報
 */
export interface EventSubSubscription {
  connectionIndex: number;
  status: ConnectionStatus;
  sessionId: string | null;
  subscriptionCount: number;
  subscribedUserIds: string[];
}

/**
 * チャンネル情報
 */
export interface ChannelInfo {
  channelId: string;
  channelLogin?: string;
  channelDisplayName?: string;
  userCount: number;
  priority: 'realtime' | 'delayed';
  method: 'eventsub' | 'polling' | 'webhook';
}

/**
 * EventSub購読一覧レスポンス
 */
export interface EventSubSubscriptionsResponse {
  totalChannels: number;
  channelIds: string[];
  subscriptions: EventSubSubscription[];
  allChannels?: {
    total: number;
    realtime: ChannelInfo[];
    delayed: ChannelInfo[];
  };
  priorityStats?: {
    totalUsers: number;
    totalChannels: number;
    realtimeChannels: number;
    delayedChannels: number;
  };
}

// ========================================
// キャッシュ/DB管理の型定義
// ========================================

/**
 * Redisメモリ情報
 */
export interface RedisMemoryInfo {
  used: string;
  usedHuman: string;
  max: string;
  maxHuman: string;
}

/**
 * Redis統計情報
 */
export interface RedisStatsInfo {
  totalConnectionsReceived: number;
  totalCommandsProcessed: number;
  uptimeSeconds: number;
}

/**
 * Redis情報
 */
export interface RedisInfo {
  dbSize: number;
  memory: RedisMemoryInfo;
  stats: RedisStatsInfo;
}

/**
 * キャッシュ情報レスポンス
 */
export interface CacheInfoResponse {
  connected: boolean;
  info: RedisInfo | null;
}

/**
 * キャッシュキー情報
 */
export interface CacheKey {
  key: string;
  ttl: number | null;  // null = 永続キー
  type: string;
  size: number | null;
}

/**
 * キャッシュキー一覧レスポンス
 */
export interface CacheKeysResponse {
  keys: CacheKey[];
  total: number;
  pattern: string;
  limit: number;
}

/**
 * キャッシュキー値レスポンス
 */
export interface CacheKeyValueResponse {
  key: string;
  value: any;
  ttl: number | null;
  type: string;
}

// ========================================
// EventSubイベント履歴型定義
// ========================================

/**
 * EventSubイベントタイプ
 */
export type EventSubEventType = 'online' | 'offline';

/**
 * EventSubイベント履歴アイテム
 */
export interface EventSubHistoryItem {
  id: string;
  timestamp: string;
  type: EventSubEventType;
  broadcasterId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  startedAt?: string;
}

/**
 * EventSubイベント履歴レスポンス
 */
export interface EventSubEventsResponse {
  events: EventSubHistoryItem[];
  totalEvents: number;
}

/**
 * EventSub使用状況
 */
export interface EventSubUsage {
  total: number;
  totalCost: number;
  maxTotalCost: number;
  usageRate: number;
}

/**
 * ポーリングチャンネル統計
 */
export interface PollingChannels {
  total: number;
  youtube: number;
  twitch: number;
  limit: number;
  usagePercent: number;
}

/**
 * 動的閾値情報
 */
export interface ThresholdInfo {
  currentThreshold: number;
  eventSubUsage: EventSubUsage;
  lastUpdated: string;
  thresholdReason: string;
  pollingChannels?: PollingChannels;
}

// ========================================
// 配信情報型定義
// ========================================

/**
 * 配信情報レスポンス
 */
export interface StreamsResponse {
  youtube: YouTubeLiveStream[];
  twitch: TwitchLiveStream[];
  stats: {
    isRunning: boolean;
    userCount: number;
    youtubeStreamCount: number;
    twitchStreamCount: number;
    cacheAvailable: boolean;
  };
}

// ========================================
// PV統計型定義
// ========================================

/**
 * PV統計（日次）
 */
export interface PVDailyStats {
  date: string;            // YYYY-MM-DD
  pv: number;             // ページビュー数
  uniqueUsers: number;    // ユニークユーザー数
}

/**
 * PV統計（月次）
 */
export interface PVMonthlyStats {
  month: string;          // YYYY-MM
  pv: number;             // ページビュー数
  uniqueUsers: number;    // ユニークユーザー数
}

/**
 * PV統計（全体）
 */
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

// ========================================
// アナリティクス統計型定義
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
 * アナリティクス統計
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
