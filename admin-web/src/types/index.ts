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
 * EventSubManager統計
 */
export interface EventSubManagerStats {
  totalConnections: number;
  activeConnections: number;
  totalSubscriptions: number;
  subscribedChannelCount: number;
  connections: EventSubConnectionStats[];
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
