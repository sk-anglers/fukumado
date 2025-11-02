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
  WhitelistedIPsResponse
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
 * システムメトリクス取得
 */
export const getSystemMetrics = async (): Promise<SystemMetrics> => {
  return fetchAPI<SystemMetrics>('/metrics/system');
};

/**
 * Twitch APIレート制限情報取得
 */
export const getTwitchRateLimit = async (): Promise<TwitchRateLimit> => {
  return fetchAPI<TwitchRateLimit>('/metrics/api/twitch');
};

/**
 * YouTube APIクォータ情報取得
 */
export const getYouTubeQuota = async (): Promise<YouTubeQuota> => {
  return fetchAPI<YouTubeQuota>('/metrics/api/youtube');
};

/**
 * セキュリティメトリクス取得
 */
export const getSecurityMetrics = async (): Promise<SecurityMetrics> => {
  return fetchAPI<SecurityMetrics>('/security/metrics');
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
 * 本サービスのセキュリティ統計取得
 */
export const getMainServiceStats = async (): Promise<MainServiceSecurityStats> => {
  return fetchAPI<MainServiceSecurityStats>('/security/main-service/stats');
};

/**
 * 本サービスのセキュリティヘルスチェック
 */
export const getMainServiceHealth = async (): Promise<MainServiceHealthCheck> => {
  return fetchAPI<MainServiceHealthCheck>('/security/main-service/health');
};

/**
 * 本サービスの異常検知アラート取得
 */
export const getMainServiceAlerts = async (limit: number = 50): Promise<AnomalyAlertsResponse> => {
  return fetchAPI<AnomalyAlertsResponse>(`/security/main-service/alerts?limit=${limit}`);
};

/**
 * 本サービスのセッション統計取得
 */
export const getMainServiceSessions = async (): Promise<SessionStats> => {
  return fetchAPI<SessionStats>('/security/main-service/sessions');
};

/**
 * 本サービスのWebSocket統計取得
 */
export const getMainServiceWebSocket = async (): Promise<WebSocketStats> => {
  return fetchAPI<WebSocketStats>('/security/main-service/websocket');
};

/**
 * 本サービスのセキュリティサマリー取得
 */
export const getMainServiceSummary = async (): Promise<SecuritySummary> => {
  return fetchAPI<SecuritySummary>('/security/main-service/summary');
};

// ========================================
// 配信管理API
// ========================================

/**
 * 配信詳細情報取得
 */
export const getStreamDetails = async (): Promise<StreamDetails> => {
  return fetchAPI<StreamDetails>('/streams/details');
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
 * セッション一覧取得
 */
export const getUserSessions = async (): Promise<SessionListResponse> => {
  return fetchAPI<SessionListResponse>('/users/sessions');
};

/**
 * セッション強制終了
 */
export const destroySession = async (sessionId: string): Promise<void> => {
  await fetchAPI(`/users/sessions/${sessionId}`, {
    method: 'DELETE'
  });
};

/**
 * ユーザー統計取得
 */
export const getUserStats = async (): Promise<UserStats> => {
  return fetchAPI<UserStats>('/users/stats');
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
  return fetchAPI<ThresholdInfo>('/eventsub/threshold/info');
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
  return fetchAPI('/api-monitor/rate-limit');
};

/**
 * YouTubeクォータ使用量を取得
 */
export const getApiYouTubeQuota = async (): Promise<any> => {
  return fetchAPI('/api-monitor/youtube-quota');
};

/**
 * 直近N分間のAPI呼び出し数を取得
 */
export const getApiRecentCalls = async (
  service: 'twitch' | 'youtube' | 'other',
  minutes: number = 60
): Promise<any> => {
  const params = new URLSearchParams();
  params.set('service', service);
  params.set('minutes', minutes.toString());

  return fetchAPI(`/api-monitor/recent-calls?${params.toString()}`);
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
