import {
  ApiResponse,
  SystemMetrics,
  TwitchRateLimit,
  YouTubeQuota,
  SecurityMetrics,
  MaintenanceStatus,
  MainServiceSecurityStats,
  MainServiceHealthCheck,
  AnomalyAlertsResponse,
  SessionStats,
  WebSocketStats,
  SecuritySummary,
  StreamDetails,
  SessionListResponse,
  UserStats,
  UserSearchResult,
  ServicesStatusResponse,
  AccessLogEntry,
  ErrorLogEntry,
  SecurityLogEntry,
  LogListResponse,
  LogSummary,
  EventSubStatsResponse,
  EventSubSubscriptionsResponse,
  EventSubEventsResponse,
  StreamsResponse,
  CacheInfoResponse,
  CacheKeysResponse,
  CacheKeyValueResponse,
  PVStats,
  AnalyticsStats,
  ThresholdInfo,
  BlockedIPsResponse,
  WhitelistedIPsResponse,
  HelpArticle,
  Announcement
} from '../types';

/**
 * API基本設定
 * 本番環境では環境変数VITE_ADMIN_API_URLを使用
 */
const API_BASE_URL = import.meta.env.VITE_ADMIN_API_URL
  ? `${import.meta.env.VITE_ADMIN_API_URL}/admin/api`
  : '/admin/api';

/**
 * Basic認証のクレデンシャル
 * 本番環境では環境変数から取得することを推奨
 */
let authCredentials: { username: string; password: string } | null = null;

export const setAuthCredentials = (username: string, password: string) => {
  authCredentials = { username, password };
};

/**
 * Basic認証ヘッダーを生成
 */
const getAuthHeader = (): string => {
  if (!authCredentials) {
    throw new Error('Authentication credentials not set');
  }

  const { username, password } = authCredentials;
  const encoded = btoa(`${username}:${password}`);
  return `Basic ${encoded}`;
};

/**
 * HTTP リクエストヘルパー
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  };

  // ルート直下の/healthエンドポイント以外はBasic認証を付与
  if (endpoint !== '/health') {
    headers['Authorization'] = getAuthHeader();
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401) {
      // 認証エラーイベントを発火してログアウトを促す
      window.dispatchEvent(new Event('auth-error'));
      throw new Error('Authentication failed');
    }
    if (response.status === 403) {
      throw new Error('Access forbidden');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }

  return data.data as T;
}

/**
 * ヘルスチェック
 */
export const getHealth = async (): Promise<{
  status: string;
  timestamp: string;
  uptime: number;
  redis: string;
}> => {
  return fetchAPI('/health');
};

/**
 * システムメトリクス取得（/system/metricsから取得）
 */
export const getSystemMetrics = async (): Promise<SystemMetrics> => {
  return fetchAPI<SystemMetrics>('/system/metrics');
};

/**
 * Twitch APIレート制限情報取得
 */
export const getTwitchRateLimit = async (): Promise<TwitchRateLimit> => {
  return fetchAPI<TwitchRateLimit>('/api-tracking/rate-limit');
};

/**
 * YouTube APIクォータ情報取得
 */
export const getYouTubeQuota = async (): Promise<YouTubeQuota> => {
  return fetchAPI<YouTubeQuota>('/api-tracking/youtube-quota');
};

/**
 * セキュリティメトリクス取得
 */
export const getSecurityMetrics = async (): Promise<SecurityMetrics> => {
  console.warn('[API] getSecurityMetrics is not implemented yet');
  return {} as SecurityMetrics;
};

/**
 * IPをブロック
 */
export const blockIP = async (
  ip: string,
  permanent: boolean = false,
  reason?: string
): Promise<void> => {
  await fetchAPI('/security/block-ip', {
    method: 'POST',
    body: JSON.stringify({ ip, permanent, reason })
  });
};

/**
 * IPブロック解除
 */
export const unblockIP = async (ip: string): Promise<void> => {
  await fetchAPI('/security/unblock-ip', {
    method: 'POST',
    body: JSON.stringify({ ip })
  });
};

/**
 * IPをホワイトリストに追加
 */
export const whitelistIP = async (ip: string): Promise<void> => {
  await fetchAPI('/security/whitelist-ip', {
    method: 'POST',
    body: JSON.stringify({ ip })
  });
};

/**
 * メンテナンスモード状態取得
 */
export const getMaintenanceStatus = async (): Promise<MaintenanceStatus> => {
  return fetchAPI<MaintenanceStatus>('/maintenance/status');
};

/**
 * メンテナンスモード有効化
 */
export const enableMaintenance = async (
  message: string,
  generateBypass: boolean = false,
  duration: number = 0
): Promise<MaintenanceStatus> => {
  return fetchAPI<MaintenanceStatus>('/maintenance/enable', {
    method: 'POST',
    body: JSON.stringify({ message, generateBypass, duration })
  });
};

/**
 * メンテナンスモード無効化
 */
export const disableMaintenance = async (): Promise<void> => {
  await fetchAPI('/maintenance/disable', {
    method: 'POST'
  });
};

// ========================================
// 本サービスのセキュリティAPI
// ========================================

/**
 * 本サービスのセキュリティ統計取得（未実装のため空データを返す）
 */
export const getMainServiceStats = async (): Promise<MainServiceSecurityStats> => {
  // TODO: サーバー側で実装後に有効化
  console.warn('[API] getMainServiceStats is not implemented yet');
  return {} as MainServiceSecurityStats;
};

/**
 * 本サービスのセキュリティヘルスチェック（未実装のため空データを返す）
 */
export const getMainServiceHealth = async (): Promise<MainServiceHealthCheck> => {
  // TODO: サーバー側で実装後に有効化
  console.warn('[API] getMainServiceHealth is not implemented yet');
  return {} as MainServiceHealthCheck;
};

/**
 * 本サービスの異常検知アラート取得（未実装のため空配列を返す）
 */
export const getMainServiceAlerts = async (limit: number = 50): Promise<AnomalyAlertsResponse> => {
  // TODO: サーバー側で実装後に有効化
  console.warn('[API] getMainServiceAlerts is not implemented yet');
  return { alerts: [], total: 0 };
};

/**
 * 本サービスのセッション統計取得（未実装のため空データを返す）
 */
export const getMainServiceSessions = async (): Promise<SessionStats> => {
  // TODO: サーバー側で実装後に有効化
  console.warn('[API] getMainServiceSessions is not implemented yet');
  return {} as SessionStats;
};

/**
 * 本サービスのWebSocket統計取得（WebSocketエンドポイントから取得）
 */
export const getMainServiceWebSocket = async (): Promise<WebSocketStats> => {
  return fetchAPI<WebSocketStats>('/websocket/stats');
};

/**
 * 本サービスのセキュリティサマリー取得（未実装のため空データを返す）
 */
export const getMainServiceSummary = async (): Promise<SecuritySummary> => {
  // TODO: サーバー側で実装後に有効化
  console.warn('[API] getMainServiceSummary is not implemented yet');
  return {} as SecuritySummary;
};

// ========================================
// 配信管理API
// ========================================

/**
 * 配信詳細情報取得（/streams/を使用）
 */
export const getStreamDetails = async (): Promise<StreamDetails> => {
  return fetchAPI<StreamDetails>('/streams');
};

/**
 * 手動同期をトリガー
 */
export const triggerStreamSync = async (): Promise<void> => {
  await fetchAPI('/streams/sync', {
    method: 'POST'
  });
};

// ========================================
// ユーザー/セッション管理API
// ========================================

/**
 * ユーザー統計取得
 */
export const getUserStats = async (): Promise<UserStats> => {
  return fetchAPI<UserStats>('/users/stats');
};

/**
 * ユーザー検索
 */
export const searchUsers = async (query: string): Promise<UserSearchResult[]> => {
  return fetchAPI<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(query)}`);
};

/**
 * ユーザー削除
 */
export const deleteUser = async (userId: string): Promise<void> => {
  await fetchAPI(`/users/${userId}`, {
    method: 'DELETE'
  });
};

// ========================================
// サービス監視API
// ========================================

/**
 * サービス状態取得
 */
export const getServicesStatus = async (): Promise<ServicesStatusResponse> => {
  console.warn('[API] getServicesStatus is not implemented yet');
  return {} as ServicesStatusResponse;
};

// ========================================
// ログ閲覧API
// ========================================

/**
 * アクセスログ取得
 */
export const getAccessLogs = async (options: {
  limit?: number;
  offset?: number;
  method?: string;
  statusCode?: number;
  searchPath?: string;
  startDate?: string;
  endDate?: string;
}): Promise<LogListResponse<AccessLogEntry>> => {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());
  if (options.method) params.set('method', options.method);
  if (options.statusCode) params.set('statusCode', options.statusCode.toString());
  if (options.searchPath) params.set('searchPath', options.searchPath);
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);

  return fetchAPI<LogListResponse<AccessLogEntry>>(`/logs/access?${params.toString()}`);
};

/**
 * エラーログ取得
 */
export const getErrorLogs = async (options: {
  limit?: number;
  offset?: number;
  level?: 'error' | 'warn';
  searchMessage?: string;
}): Promise<LogListResponse<ErrorLogEntry>> => {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());
  if (options.level) params.set('level', options.level);
  if (options.searchMessage) params.set('searchMessage', options.searchMessage);

  return fetchAPI<LogListResponse<ErrorLogEntry>>(`/logs/error?${params.toString()}`);
};

/**
 * セキュリティログ取得
 */
export const getSecurityLogs = async (options: {
  limit?: number;
  offset?: number;
  type?: SecurityLogEntry['type'];
  searchIp?: string;
}): Promise<LogListResponse<SecurityLogEntry>> => {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());
  if (options.type) params.set('type', options.type);
  if (options.searchIp) params.set('searchIp', options.searchIp);

  return fetchAPI<LogListResponse<SecurityLogEntry>>(`/logs/security?${params.toString()}`);
};

/**
 * ログサマリー取得
 */
export const getLogSummary = async (): Promise<LogSummary> => {
  return fetchAPI<LogSummary>('/logs/summary');
};

/**
 * ログクリア
 */
export const clearLogs = async (type: 'access' | 'error' | 'security' | 'all'): Promise<void> => {
  await fetchAPI(`/logs/${type}`, {
    method: 'DELETE'
  });
};

// ========================================
// EventSub管理API
// ========================================

/**
 * EventSub統計取得
 */
export const getEventSubStats = async (): Promise<EventSubStatsResponse> => {
  return fetchAPI<EventSubStatsResponse>('/eventsub/stats');
};

/**
 * EventSub購読一覧取得
 */
export const getEventSubSubscriptions = async (): Promise<EventSubSubscriptionsResponse> => {
  return fetchAPI<EventSubSubscriptionsResponse>('/eventsub/subscriptions');
};

/**
 * EventSub購読解除
 */
export const unsubscribeEventSub = async (userId: string): Promise<void> => {
  await fetchAPI(`/eventsub/subscriptions/${userId}`, {
    method: 'DELETE'
  });
};

/**
 * EventSub再接続
 */
export const reconnectEventSub = async (): Promise<void> => {
  await fetchAPI('/eventsub/reconnect', {
    method: 'POST'
  });
};

/**
 * 動的閾値情報を取得
 */
export const getThresholdInfo = async (): Promise<ThresholdInfo> => {
  return fetchAPI<ThresholdInfo>('/threshold/info');
};

// ========================================
// キャッシュ/DB管理API
// ========================================

/**
 * キャッシュ情報取得
 */
export const getCacheInfo = async (): Promise<CacheInfoResponse> => {
  return fetchAPI<CacheInfoResponse>('/cache/info');
};

/**
 * キャッシュキー一覧取得
 */
export const getCacheKeys = async (pattern = '*', limit = 100): Promise<CacheKeysResponse> => {
  const params = new URLSearchParams();
  params.set('pattern', pattern);
  params.set('limit', limit.toString());

  return fetchAPI<CacheKeysResponse>(`/cache/keys?${params.toString()}`);
};

/**
 * キャッシュキー値取得
 */
export const getCacheKeyValue = async (key: string): Promise<CacheKeyValueResponse> => {
  return fetchAPI<CacheKeyValueResponse>(`/cache/key/${encodeURIComponent(key)}`);
};

/**
 * キャッシュキー削除
 */
export const deleteCacheKey = async (key: string): Promise<void> => {
  await fetchAPI(`/cache/key/${encodeURIComponent(key)}`, {
    method: 'DELETE'
  });
};

/**
 * パターンに一致するキャッシュを一括削除
 */
export const deleteCachePattern = async (pattern: string): Promise<void> => {
  await fetchAPI('/cache/pattern', {
    method: 'DELETE',
    body: JSON.stringify({ pattern })
  });
};

/**
 * 全キャッシュをフラッシュ
 */
export const flushCache = async (): Promise<void> => {
  await fetchAPI('/cache/flush', {
    method: 'POST'
  });
};

// ========================================
// EventSubイベント履歴API
// ========================================

/**
 * EventSubイベント履歴を取得
 */
export const getEventSubEvents = async (limit = 50): Promise<EventSubEventsResponse> => {
  return await fetchAPI(`/eventsub/events?limit=${limit}`);
};

// ========================================
// 配信情報API
// ========================================

/**
 * 配信情報を取得
 */
export const getStreams = async (): Promise<StreamsResponse> => {
  return await fetchAPI('/streams');
};

// ========================================
// API監視API
// ========================================

/**
 * API呼び出しログを取得
 */
export const getApiLogs = async (options: {
  limit?: number;
  offset?: number;
  service?: 'twitch' | 'youtube' | 'other';
  endpoint?: string;
  method?: string;
  statusCode?: number;
  startDate?: string;
  endDate?: string;
}): Promise<any> => {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());
  if (options.service) params.set('service', options.service);
  if (options.endpoint) params.set('endpoint', options.endpoint);
  if (options.method) params.set('method', options.method);
  if (options.statusCode) params.set('statusCode', options.statusCode.toString());
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);

  return fetchAPI(`/api-monitor/logs?${params.toString()}`);
};

/**
 * API統計情報を取得
 */
export const getApiStats = async (service?: 'twitch' | 'youtube' | 'other'): Promise<any> => {
  const params = new URLSearchParams();
  if (service) params.set('service', service);

  return fetchAPI(`/api-monitor/stats?${params.toString()}`);
};

/**
 * Twitchレート制限情報を取得
 */
export const getApiRateLimit = async (): Promise<any> => {
  return fetchAPI('/api-tracking/rate-limit');
};

/**
 * YouTubeクォータ使用量を取得
 */
export const getApiYouTubeQuota = async (): Promise<any> => {
  return fetchAPI('/api-tracking/youtube-quota');
};

/**
 * 直近N分間のAPI呼び出し数を取得
 */
export const getApiRecentCalls = async (
  service: 'twitch' | 'youtube' | 'other',
  minutes: number = 60
): Promise<any> => {
  console.warn('[API] getApiRecentCalls is not implemented yet');
  return { calls: [] };
};

/**
 * APIログをクリア
 */
export const clearApiLogs = async (service?: 'twitch' | 'youtube' | 'other'): Promise<void> => {
  const params = new URLSearchParams();
  if (service) params.set('service', service);

  await fetchAPI(`/api-monitor/logs?${params.toString()}`, {
    method: 'DELETE'
  });
};

// ========================================
// PV統計API
// ========================================

/**
 * PV統計を取得
 */
export const getPVStats = async (): Promise<PVStats | null> => {
  try {
    const response = await fetchAPI<PVStats>('/pv/stats');
    return response || null;
  } catch (error) {
    console.error('[API] Failed to fetch PV stats:', error);
    return null;
  }
};

/**
 * PV統計をエクスポート（ダウンロード）
 */
export const exportPVStats = async (format: 'json' | 'csv' = 'json'): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/pv/export?format=${format}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    // ファイルをダウンロード
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `pv-stats-${date}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('[API] Failed to export PV stats:', error);
    throw error;
  }
};

/**
 * PV統計を手動でバックアップ
 */
export const backupPVStats = async (): Promise<void> => {
  await fetchAPI('/pv/backup', {
    method: 'POST'
  });
};

// ========================================
// アナリティクス統計API
// ========================================

/**
 * アナリティクス統計を取得
 * @param days 取得する日数（デフォルト: 30日）
 */
export const getAnalyticsStats = async (days: number = 30): Promise<AnalyticsStats | null> => {
  try {
    const response = await fetchAPI<AnalyticsStats>(`/analytics/stats?days=${days}`);
    return response || null;
  } catch (error) {
    console.error('[API] Failed to fetch analytics stats:', error);
    return null;
  }
};

/**
 * アナリティクス統計をエクスポート
 * @param format エクスポート形式（json | csv）
 * @param days 取得する日数（デフォルト: 30日）
 */
export const exportAnalyticsStats = async (format: 'json' | 'csv', days: number = 30): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analytics/export?format=${format}&days=${days}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    // ファイルとしてダウンロード
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-stats-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('[API] Failed to export analytics stats:', error);
    throw error;
  }
};

// ========================================
// IPブロック管理API
// ========================================

/**
 * ブロックされているIPリストを取得
 */
export const getBlockedIPs = async (): Promise<BlockedIPsResponse> => {
  return fetchAPI<BlockedIPsResponse>('/security/blocked-ips');
};

/**
 * すべてのIPブロックを解除
 */
export const clearAllBlocks = async (): Promise<void> => {
  await fetchAPI('/security/clear-all-blocks', {
    method: 'POST',
    body: JSON.stringify({})
  });
};

/**
 * ホワイトリストに登録されているIPリストを取得
 */
export const getWhitelistedIPs = async (): Promise<WhitelistedIPsResponse> => {
  return fetchAPI<WhitelistedIPsResponse>('/security/whitelisted-ips');
};

/**
 * IPをホワイトリストに追加
 */
export const addToWhitelist = async (ip: string): Promise<void> => {
  await fetchAPI('/security/whitelist-ip', {
    method: 'POST',
    body: JSON.stringify({ ip })
  });
};

/**
 * IPをホワイトリストから削除
 */
export const removeFromWhitelist = async (ip: string): Promise<void> => {
  await fetchAPI('/security/remove-from-whitelist', {
    method: 'POST',
    body: JSON.stringify({ ip })
  });
};

// ========================================
// データベース管理API
// ========================================

/**
 * security_logs の severity 制約を修正（warn を許可）
 */
export const migrateSeverity = async (): Promise<void> => {
  await fetchAPI('/maintenance/migrate-severity', {
    method: 'POST'
  });
};

// ========================================
// 監査ログAPI
// ========================================

/**
 * 監査ログ一覧を取得
 */
export const getAuditLogs = async (options: {
  limit?: number;
  offset?: number;
  action?: string;
  actor?: string;
  actorIp?: string;
  targetType?: string;
  status?: 'success' | 'failure';
  startDate?: string;
  endDate?: string;
}): Promise<any> => {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());
  if (options.action) params.set('action', options.action);
  if (options.actor) params.set('actor', options.actor);
  if (options.actorIp) params.set('actorIp', options.actorIp);
  if (options.targetType) params.set('targetType', options.targetType);
  if (options.status) params.set('status', options.status);
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);

  return fetchAPI(`/audit-logs?${params.toString()}`);
};

/**
 * 監査ログサマリーを取得
 */
export const getAuditLogSummary = async (days: number = 7): Promise<any> => {
  return fetchAPI(`/audit-logs/summary?days=${days}`);
};

/**
 * 古い監査ログをクリーンアップ
 */
export const cleanupAuditLogs = async (days: number = 90): Promise<void> => {
  await fetchAPI('/audit-logs/cleanup', {
    method: 'POST',
    body: JSON.stringify({ days })
  });
};

/**
 * audit_logs テーブルを作成
 */
export const migrateAuditLogsTable = async (): Promise<void> => {
  await fetchAPI('/maintenance/migrate-audit-logs', {
    method: 'POST'
  });
};

// ========================================
// アラート・通知API
// ========================================

/**
 * アラート一覧を取得
 */
export const getAlerts = async (options: {
  limit?: number;
  offset?: number;
  type?: string;
  severity?: string;
  acknowledged?: boolean;
  resolved?: boolean;
}): Promise<any> => {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());
  if (options.type) params.set('type', options.type);
  if (options.severity) params.set('severity', options.severity);
  if (options.acknowledged !== undefined) params.set('acknowledged', options.acknowledged.toString());
  if (options.resolved !== undefined) params.set('resolved', options.resolved.toString());

  return fetchAPI(`/alerts?${params.toString()}`);
};

/**
 * 未読アラート数を取得
 */
export const getUnreadAlertCount = async (): Promise<number> => {
  const result = await fetchAPI<{ count: number }>('/alerts/unread-count');
  return result.count;
};

/**
 * アラートを確認済みにする
 */
export const acknowledgeAlert = async (id: string, acknowledgedBy: string): Promise<void> => {
  await fetchAPI(`/alerts/${id}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ acknowledgedBy })
  });
};

/**
 * アラートを解決済みにする
 */
export const resolveAlert = async (id: string): Promise<void> => {
  await fetchAPI(`/alerts/${id}/resolve`, {
    method: 'POST'
  });
};

/**
 * アラート設定を取得
 */
export const getAlertSettings = async (): Promise<any[]> => {
  return fetchAPI('/alert-settings/settings');
};

/**
 * アラート設定を更新
 */
export const updateAlertSetting = async (type: string, data: {
  enabled?: boolean;
  threshold?: number;
  notifyEmail?: boolean;
  notifySlack?: boolean;
  notifyWebhook?: boolean;
}): Promise<void> => {
  await fetchAPI(`/alert-settings/settings/${type}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

/**
 * alerts と alert_settings テーブルを作成
 */
export const migrateAlertsTable = async (): Promise<void> => {
  await fetchAPI('/maintenance/migrate-alerts', {
    method: 'POST'
  });
};

// ========================================
// エラーテストモードAPI
// ========================================

/**
 * エラーテストモード状態を取得
 */
export const getErrorTestStatus = async (): Promise<{ enabled: boolean }> => {
  return fetchAPI<{ enabled: boolean }>('/test/error/status');
};

/**
 * エラーテストモードを有効化
 */
export const enableErrorTest = async (): Promise<{ enabled: boolean; message: string }> => {
  return fetchAPI<{ enabled: boolean; message: string }>('/test/error/enable', {
    method: 'POST'
  });
};

/**
 * エラーテストモードを無効化
 */
export const disableErrorTest = async (): Promise<{ enabled: boolean }> => {
  return fetchAPI<{ enabled: boolean }>('/test/error/disable', {
    method: 'POST'
  });
};

// ============================================
// Help Articles API
// ============================================

/**
 * ヘルプ記事一覧取得
 */
export const getHelpArticles = async (category?: string): Promise<HelpArticle[]> => {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return fetchAPI<HelpArticle[]>(`/help/articles${query}`);
};

/**
 * ヘルプ記事詳細取得
 */
export const getHelpArticle = async (id: string): Promise<HelpArticle> => {
  return fetchAPI<HelpArticle>(`/help/articles/${id}`);
};

/**
 * ヘルプ記事作成
 */
export const createHelpArticle = async (data: {
  category: string;
  title: string;
  content: string;
  order?: number;
  isPublished?: boolean;
}): Promise<HelpArticle> => {
  return fetchAPI<HelpArticle>('/help/articles', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

/**
 * ヘルプ記事更新
 */
export const updateHelpArticle = async (id: string, data: {
  category: string;
  title: string;
  content: string;
  order?: number;
  isPublished?: boolean;
}): Promise<HelpArticle> => {
  return fetchAPI<HelpArticle>(`/help/articles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

/**
 * ヘルプ記事削除
 */
export const deleteHelpArticle = async (id: string): Promise<void> => {
  return fetchAPI<void>(`/help/articles/${id}`, {
    method: 'DELETE'
  });
};

/**
 * ヘルプ記事公開/非公開切替
 */
export const toggleHelpArticlePublish = async (id: string, isPublished: boolean): Promise<HelpArticle> => {
  return fetchAPI<HelpArticle>(`/help/articles/${id}/publish`, {
    method: 'PUT',
    body: JSON.stringify({ isPublished })
  });
};

// ============================================
// Announcements API
// ============================================

/**
 * お知らせ一覧取得
 */
export const getAnnouncements = async (): Promise<Announcement[]> => {
  return fetchAPI<Announcement[]>('/announcements');
};

/**
 * お知らせ詳細取得
 */
export const getAnnouncement = async (id: string): Promise<Announcement> => {
  return fetchAPI<Announcement>(`/announcements/${id}`);
};

/**
 * お知らせ作成
 */
export const createAnnouncement = async (data: {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  content: string;
  link?: string | null;
  linkText?: string | null;
  priority?: number;
  isActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}): Promise<Announcement> => {
  return fetchAPI<Announcement>('/announcements', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

/**
 * お知らせ更新
 */
export const updateAnnouncement = async (id: string, data: {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  content: string;
  link?: string | null;
  linkText?: string | null;
  priority?: number;
  isActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}): Promise<Announcement> => {
  return fetchAPI<Announcement>(`/announcements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

/**
 * お知らせ削除
 */
export const deleteAnnouncement = async (id: string): Promise<void> => {
  return fetchAPI<void>(`/announcements/${id}`, {
    method: 'DELETE'
  });
};

/**
 * お知らせ有効/無効切替
 */
export const toggleAnnouncementActive = async (id: string, isActive: boolean): Promise<Announcement> => {
  return fetchAPI<Announcement>(`/announcements/${id}/toggle`, {
    method: 'PUT',
    body: JSON.stringify({ isActive })
  });
};
