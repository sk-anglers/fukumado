import React, { useState, useEffect } from 'react';
import { Card, Button, Loader } from '../common';
import {
  getApiLogs,
  getApiStats,
  getApiRateLimit,
  getApiYouTubeQuota,
  clearApiLogs
} from '../../services/apiClient';
import styles from './ApiMonitor.module.css';

interface ApiLog {
  id: string;
  timestamp: string;
  service: 'twitch' | 'youtube' | 'other';
  endpoint: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestQuery?: Record<string, string>;
  requestBody?: any;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody?: any;
  responseTime: number;
  error?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  quotaCost?: number;
}

type ServiceType = 'all' | 'twitch' | 'youtube' | 'other';

export const ApiMonitor: React.FC = () => {
  const [selectedService, setSelectedService] = useState<ServiceType>('all');
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [rateLimit, setRateLimit] = useState<any>(null);
  const [quota, setQuota] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [logLimit, setLogLimit] = useState(50);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);

  const fetchData = async (isInitialLoad = false) => {
    // 初回読み込み時のみローディング表示
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const serviceParam = selectedService === 'all' ? undefined : selectedService;

      // 統計情報
      console.log('[ApiMonitor] Fetching stats for service:', serviceParam);
      const statsData = await getApiStats(serviceParam);
      console.log('[ApiMonitor] Stats data received:', statsData);
      setStats(statsData);

      // ログ
      console.log('[ApiMonitor] Fetching logs with params:', { limit: logLimit, service: serviceParam, statusCode: statusFilter });
      const logsData = await getApiLogs({
        limit: logLimit,
        service: serviceParam,
        statusCode: statusFilter === 'all' ? undefined : parseInt(statusFilter)
      });
      console.log('[ApiMonitor] Logs data received:', logsData);
      setLogs(logsData.logs || []);

      // Twitchレート制限
      if (selectedService === 'twitch' || selectedService === 'all') {
        try {
          const rateLimitData = await getApiRateLimit();
          console.log('[ApiMonitor] Rate limit data:', rateLimitData);
          setRateLimit(rateLimitData);
        } catch (e) {
          console.error('[ApiMonitor] Failed to fetch rate limit:', e);
        }
      }

      // YouTubeクォータ
      if (selectedService === 'youtube' || selectedService === 'all') {
        try {
          const quotaData = await getApiYouTubeQuota();
          console.log('[ApiMonitor] Quota data:', quotaData);
          setQuota(quotaData);
        } catch (e) {
          console.error('[ApiMonitor] Failed to fetch quota:', e);
        }
      }
    } catch (error) {
      console.error('[ApiMonitor] Failed to fetch API monitoring data:', error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('本当にAPIログをクリアしますか？')) return;

    try {
      const serviceParam = selectedService === 'all' ? undefined : selectedService;
      await clearApiLogs(serviceParam);
      await fetchData();
    } catch (error) {
      console.error('Failed to clear logs:', error);
      alert('ログのクリアに失敗しました');
    }
  };

  const handleExportCSV = () => {
    const csvData = logs.map(log => ({
      時刻: new Date(log.timestamp).toLocaleString('ja-JP'),
      サービス: log.service,
      エンドポイント: log.endpoint,
      メソッド: log.method,
      ステータス: log.responseStatus,
      応答時間ms: log.responseTime,
      エラー: log.error || ''
    }));

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `api-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  useEffect(() => {
    fetchData(true); // 初回読み込み
  }, [selectedService, logLimit, statusFilter]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData(false); // バックグラウンド更新
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, selectedService, logLimit, statusFilter]);

  const successRate = stats && stats.totalCalls > 0
    ? ((stats.successfulCalls / stats.totalCalls) * 100).toFixed(2)
    : '0';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>API監視</h1>
          <p className={styles.subtitle}>外部API呼び出しをリアルタイムで監視します</p>
        </div>
        <div className={styles.actions}>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
            className={styles.select}
          >
            <option value="10">10秒</option>
            <option value="30">30秒</option>
            <option value="60">60秒</option>
          </select>
          <Button
            variant={autoRefresh ? 'primary' : 'secondary'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '自動更新中' : '自動更新'}
          </Button>
          <Button onClick={fetchData} disabled={loading}>
            {loading ? '更新中...' : '更新'}
          </Button>
        </div>
      </div>

      {/* タブ */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${selectedService === 'all' ? styles.active : ''}`}
          onClick={() => setSelectedService('all')}
        >
          すべて
        </button>
        <button
          className={`${styles.tab} ${selectedService === 'twitch' ? styles.active : ''}`}
          onClick={() => setSelectedService('twitch')}
        >
          Twitch
        </button>
        <button
          className={`${styles.tab} ${selectedService === 'youtube' ? styles.active : ''}`}
          onClick={() => setSelectedService('youtube')}
        >
          YouTube
        </button>
        <button
          className={`${styles.tab} ${selectedService === 'other' ? styles.active : ''}`}
          onClick={() => setSelectedService('other')}
        >
          その他
        </button>
      </div>

      {loading && !stats ? (
        <Loader text="データを読み込んでいます..." />
      ) : (
        <div className={styles.content}>
          {/* 統計情報 */}
          {stats && (
            <div className={styles.statsGrid}>
              <Card title="総呼び出し数">
                <div className={styles.statValue}>{stats.totalCalls.toLocaleString()}</div>
                <div className={styles.statLabel}>
                  {selectedService === 'all' ? 'すべてのサービス' : selectedService.toUpperCase()}
                </div>
              </Card>
              <Card title="成功">
                <div className={`${styles.statValue} ${styles.success}`}>
                  {stats.successfulCalls.toLocaleString()}
                </div>
                <div className={styles.statLabel}>成功率 {successRate}%</div>
              </Card>
              <Card title="失敗">
                <div className={`${styles.statValue} ${styles.error}`}>
                  {stats.failedCalls.toLocaleString()}
                </div>
                <div className={styles.statLabel}>
                  エラー率 {(100 - parseFloat(successRate)).toFixed(2)}%
                </div>
              </Card>
              <Card title="平均応答時間">
                <div className={styles.statValue}>{stats.averageResponseTime.toFixed(0)}ms</div>
                <div className={styles.statLabel}>レスポンス時間</div>
              </Card>
            </div>
          )}

          {/* レート制限とクォータ */}
          <div className={styles.limitsGrid}>
            {rateLimit && (selectedService === 'twitch' || selectedService === 'all') && (
              <Card title="Twitch APIレート制限">
                <div className={styles.limitInfo}>
                  <div className={styles.limitBar}>
                    <div
                      className={styles.limitProgress}
                      style={{
                        width: `${((rateLimit.limit - rateLimit.remaining) / rateLimit.limit) * 100}%`
                      }}
                    />
                  </div>
                  <div className={styles.limitText}>
                    {rateLimit.remaining} / {rateLimit.limit} 残り
                  </div>
                  <div className={styles.limitReset}>
                    リセット: {new Date(rateLimit.resetAt).toLocaleTimeString('ja-JP')}
                  </div>
                </div>
              </Card>
            )}
            {quota && (selectedService === 'youtube' || selectedService === 'all') && (
              <Card title="YouTube APIクォータ">
                <div className={styles.limitInfo}>
                  <div className={styles.limitBar}>
                    <div
                      className={styles.limitProgress}
                      style={{ width: `${quota.usagePercent}%` }}
                    />
                  </div>
                  <div className={styles.limitText}>
                    {quota.used.toLocaleString()} / {quota.limit.toLocaleString()} units
                  </div>
                  <div className={styles.limitReset}>
                    残り: {quota.remaining.toLocaleString()} units
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* ログテーブル */}
          <Card
            title="API呼び出しログ"
            actions={
              <div className={styles.tableActions}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={styles.select}
                >
                  <option value="all">すべて</option>
                  <option value="200">200 OK</option>
                  <option value="400">400 エラー</option>
                  <option value="500">500 エラー</option>
                  <option value="0">ネットワークエラー</option>
                </select>
                <select
                  value={logLimit}
                  onChange={(e) => setLogLimit(parseInt(e.target.value))}
                  className={styles.select}
                >
                  <option value="10">10件</option>
                  <option value="50">50件</option>
                  <option value="100">100件</option>
                  <option value="500">500件</option>
                </select>
                <Button size="small" onClick={handleExportCSV} disabled={logs.length === 0}>
                  CSV
                </Button>
                <Button size="small" variant="danger" onClick={handleClearLogs}>
                  クリア
                </Button>
              </div>
            }
          >
            {logs.length === 0 ? (
              <div className={styles.noData}>APIログがありません</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>時刻</th>
                      <th>サービス</th>
                      <th>エンドポイント</th>
                      <th>メソッド</th>
                      <th>ステータス</th>
                      <th>応答時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr
                          className={styles.logRow}
                          onClick={() => toggleRow(log.id)}
                        >
                          <td className={styles.expandIcon}>
                            {expandedRows.has(log.id) ? '▼' : '▶'}
                          </td>
                          <td className={styles.timestamp}>
                            {new Date(log.timestamp).toLocaleString('ja-JP', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td>
                            <span className={`${styles.badge} ${styles[log.service]}`}>
                              {log.service.toUpperCase()}
                            </span>
                          </td>
                          <td className={styles.endpoint}>{log.endpoint}</td>
                          <td>
                            <span className={styles.method}>{log.method}</span>
                          </td>
                          <td>
                            <span
                              className={`${styles.status} ${
                                log.responseStatus >= 200 && log.responseStatus < 300
                                  ? styles.statusSuccess
                                  : log.responseStatus >= 400
                                  ? styles.statusError
                                  : ''
                              }`}
                            >
                              {log.responseStatus === 0 ? 'ERROR' : log.responseStatus}
                            </span>
                          </td>
                          <td
                            className={
                              log.responseTime > 1000
                                ? styles.slow
                                : log.responseTime > 500
                                ? styles.medium
                                : ''
                            }
                          >
                            {log.responseTime}ms
                          </td>
                        </tr>
                        {expandedRows.has(log.id) && (
                          <tr className={styles.detailRow}>
                            <td colSpan={7}>
                              <div className={styles.detail}>
                                <div className={styles.detailSection}>
                                  <h4>リクエスト</h4>
                                  <div className={styles.detailUrl}>{log.url}</div>
                                  {log.requestQuery && (
                                    <pre className={styles.detailCode}>
                                      {JSON.stringify(log.requestQuery, null, 2)}
                                    </pre>
                                  )}
                                </div>
                                {log.error && (
                                  <div className={`${styles.detailSection} ${styles.errorSection}`}>
                                    <h4>エラー</h4>
                                    <p>{log.error}</p>
                                  </div>
                                )}
                                {log.rateLimit && (
                                  <div className={styles.detailSection}>
                                    <h4>レート制限</h4>
                                    <p>
                                      {log.rateLimit.remaining} / {log.rateLimit.limit} 残り
                                    </p>
                                  </div>
                                )}
                                {log.quotaCost && (
                                  <div className={styles.detailSection}>
                                    <h4>クォータコスト</h4>
                                    <p>{log.quotaCost} units</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
