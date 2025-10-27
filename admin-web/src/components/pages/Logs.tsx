import React, { useEffect, useState } from 'react';
import {
  getAccessLogs,
  getErrorLogs,
  getSecurityLogs,
  getLogSummary,
  clearLogs
} from '../../services/apiClient';
import {
  AccessLogEntry,
  ErrorLogEntry,
  SecurityLogEntry,
  LogSummary as LogSummaryType
} from '../../types';
import styles from './Logs.module.css';

type TabType = 'access' | 'error' | 'security';

export const Logs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('access');
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLogEntry[]>([]);
  const [summary, setSummary] = useState<LogSummaryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルター
  const [methodFilter, setMethodFilter] = useState('');
  const [statusCodeFilter, setStatusCodeFilter] = useState('');
  const [pathSearch, setPathSearch] = useState('');
  const [errorLevelFilter, setErrorLevelFilter] = useState<'error' | 'warn' | ''>('');
  const [messageSearch, setMessageSearch] = useState('');
  const [securityTypeFilter, setSecurityTypeFilter] = useState('');
  const [ipSearch, setIpSearch] = useState('');

  // ページネーション
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const loadSummary = async () => {
    try {
      const data = await getLogSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load log summary:', err);
    }
  };

  const loadAccessLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAccessLogs({
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        method: methodFilter || undefined,
        statusCode: statusCodeFilter ? parseInt(statusCodeFilter) : undefined,
        searchPath: pathSearch || undefined
      });
      setAccessLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load access logs:', err);
      setError('アクセスログの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadErrorLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getErrorLogs({
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        level: errorLevelFilter || undefined,
        searchMessage: messageSearch || undefined
      });
      setErrorLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load error logs:', err);
      setError('エラーログの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSecurityLogs({
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        type: securityTypeFilter as any || undefined,
        searchIp: ipSearch || undefined
      });
      setSecurityLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load security logs:', err);
      setError('セキュリティログの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm(`${activeTab}ログをすべてクリアしますか?`)) {
      return;
    }

    try {
      await clearLogs(activeTab);
      loadData();
      loadSummary();
    } catch (err) {
      console.error('Failed to clear logs:', err);
      alert('ログのクリアに失敗しました');
    }
  };

  const loadData = () => {
    switch (activeTab) {
      case 'access':
        loadAccessLogs();
        break;
      case 'error':
        loadErrorLogs();
        break;
      case 'security':
        loadSecurityLogs();
        break;
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeTab, methodFilter, statusCodeFilter, pathSearch, errorLevelFilter, messageSearch, securityTypeFilter, ipSearch]);

  useEffect(() => {
    loadData();
  }, [activeTab, page, methodFilter, statusCodeFilter, pathSearch, errorLevelFilter, messageSearch, securityTypeFilter, ipSearch]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('ja-JP');
    } catch {
      return dateStr;
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>ログ閲覧</h1>
        <button onClick={loadData} className={styles.refreshButton}>
          🔄 更新
        </button>
      </header>

      {/* サマリーカード */}
      {summary && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>アクセスログ</div>
            <div className={styles.summaryValue}>{summary.totalAccessLogs}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>エラーログ</div>
            <div className={styles.summaryValue}>{summary.totalErrorLogs}</div>
            <div className={styles.summarySubtext}>
              直近1時間: {summary.recentErrors}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>セキュリティログ</div>
            <div className={styles.summaryValue}>{summary.totalSecurityLogs}</div>
            <div className={styles.summarySubtext}>
              直近1時間: {summary.recentSecurityEvents}
            </div>
          </div>
        </div>
      )}

      {/* タブ */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'access' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('access')}
        >
          アクセスログ
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'error' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('error')}
        >
          エラーログ
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'security' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('security')}
        >
          セキュリティログ
        </button>
      </div>

      {/* フィルター */}
      <div className={styles.filters}>
        {activeTab === 'access' && (
          <>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="">全メソッド</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
            <input
              type="text"
              placeholder="ステータスコード (例: 404)"
              value={statusCodeFilter}
              onChange={(e) => setStatusCodeFilter(e.target.value)}
            />
            <input
              type="text"
              placeholder="パス検索"
              value={pathSearch}
              onChange={(e) => setPathSearch(e.target.value)}
            />
          </>
        )}

        {activeTab === 'error' && (
          <>
            <select value={errorLevelFilter} onChange={(e) => setErrorLevelFilter(e.target.value as any)}>
              <option value="">全レベル</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
            </select>
            <input
              type="text"
              placeholder="メッセージ検索"
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
            />
          </>
        )}

        {activeTab === 'security' && (
          <>
            <select value={securityTypeFilter} onChange={(e) => setSecurityTypeFilter(e.target.value)}>
              <option value="">全タイプ</option>
              <option value="block">ブロック</option>
              <option value="rate_limit">レート制限</option>
              <option value="anomaly">異常検知</option>
              <option value="auth_failed">認証失敗</option>
            </select>
            <input
              type="text"
              placeholder="IP検索"
              value={ipSearch}
              onChange={(e) => setIpSearch(e.target.value)}
            />
          </>
        )}

        <button onClick={handleClearLogs} className={styles.clearButton}>
          🗑️ ログクリア
        </button>
      </div>

      {/* ログ表示 */}
      <div className={styles.logsSection}>
        {loading && <div className={styles.loading}>読み込み中...</div>}
        {error && <div className={styles.error}>{error}</div>}

        {!loading && !error && (
          <>
            {/* アクセスログ */}
            {activeTab === 'access' && (
              <div className={styles.tableContainer}>
                {accessLogs.length === 0 ? (
                  <div className={styles.noData}>ログがありません</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>時刻</th>
                        <th>IP</th>
                        <th>メソッド</th>
                        <th>パス</th>
                        <th>ステータス</th>
                        <th>レスポンスタイム</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{formatDate(log.timestamp)}</td>
                          <td className={styles.monospace}>{log.ip}</td>
                          <td><span className={styles.method}>{log.method}</span></td>
                          <td className={styles.path}>{log.path}</td>
                          <td>
                            <span className={`${styles.status} ${styles[`status${Math.floor(log.statusCode / 100)}`]}`}>
                              {log.statusCode}
                            </span>
                          </td>
                          <td>{log.responseTime}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* エラーログ */}
            {activeTab === 'error' && (
              <div className={styles.errorLogs}>
                {errorLogs.length === 0 ? (
                  <div className={styles.noData}>ログがありません</div>
                ) : (
                  errorLogs.map((log) => (
                    <div key={log.id} className={styles.errorLogCard}>
                      <div className={styles.errorLogHeader}>
                        <span className={`${styles.errorLevel} ${styles[log.level]}`}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className={styles.errorTime}>{formatDate(log.timestamp)}</span>
                      </div>
                      <div className={styles.errorMessage}>{log.message}</div>
                      {log.context && (
                        <div className={styles.errorContext}>
                          <pre>{JSON.stringify(log.context, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* セキュリティログ */}
            {activeTab === 'security' && (
              <div className={styles.securityLogs}>
                {securityLogs.length === 0 ? (
                  <div className={styles.noData}>ログがありません</div>
                ) : (
                  securityLogs.map((log) => (
                    <div key={log.id} className={styles.securityLogCard}>
                      <div className={styles.securityLogHeader}>
                        <span className={`${styles.securityType} ${styles[log.type]}`}>
                          {log.type.toUpperCase().replace('_', ' ')}
                        </span>
                        <span className={styles.securityTime}>{formatDate(log.timestamp)}</span>
                      </div>
                      <div className={styles.securityInfo}>
                        <div><strong>IP:</strong> {log.ip}</div>
                        {log.path && <div><strong>パス:</strong> {log.path}</div>}
                        <div><strong>理由:</strong> {log.reason}</div>
                      </div>
                      {log.metadata && (
                        <div className={styles.securityMetadata}>
                          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className={styles.paginationButton}
                >
                  前へ
                </button>
                <span className={styles.paginationInfo}>
                  {page} / {totalPages} ページ (全{total}件)
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className={styles.paginationButton}
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
