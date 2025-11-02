import { useState, useEffect } from 'react';
import styles from './DebugPanel.module.css';
import { apiFetch } from '../../utils/apiFetch';

interface ApiLog {
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  error?: string;
}

interface ThresholdInfo {
  currentThreshold: number;
  eventSubUsage: {
    total: number;
    totalCost: number;
    maxTotalCost: number;
    usageRate: number;
  };
  lastUpdated: string;
  thresholdReason: string;
}

export const DebugPanel = (): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [thresholdInfo, setThresholdInfo] = useState<ThresholdInfo | null>(null);
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  useEffect(() => {
    // グローバルにログを受け取るリスナーを設定
    const handleLog = (event: CustomEvent<ApiLog>) => {
      setLogs((prev) => [event.detail, ...prev].slice(0, 20)); // 最新20件
    };

    window.addEventListener('api-log' as any, handleLog);
    return () => window.removeEventListener('api-log' as any, handleLog);
  }, []);

  // 閾値情報を取得
  useEffect(() => {
    const fetchThresholdInfo = async () => {
      try {
        const response = await apiFetch('/api/admin/threshold/info');
        if (!response.ok) {
          throw new Error(`Failed to fetch threshold info: ${response.status}`);
        }
        const data = await response.json();
        setThresholdInfo(data.data);
        setThresholdError(null);
      } catch (error) {
        console.error('Error fetching threshold info:', error);
        setThresholdError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // 初回取得
    fetchThresholdInfo();

    // 5分ごとに更新
    const interval = setInterval(fetchThresholdInfo, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const backendOrigin = (window as any).__BACKEND_ORIGIN__ || 'Unknown';

  return (
    <>
      {/* トグルボタン */}
      <button
        className={styles.toggleButton}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        🐛 Debug {isOpen ? '▼' : '▲'}
      </button>

      {/* デバッグパネル */}
      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <h3>デバッグ情報</h3>
            <button onClick={() => setLogs([])} type="button">Clear</button>
          </div>

          <div className={styles.section}>
            <strong>Backend Origin:</strong>
            <div className={styles.value}>{backendOrigin}</div>
          </div>

          <div className={styles.section}>
            <strong>Current URL:</strong>
            <div className={styles.value}>{window.location.href}</div>
          </div>

          <div className={styles.section}>
            <strong>VITE_API_URL:</strong>
            <div className={styles.value}>
              {import.meta.env.VITE_API_URL || '(未設定 - プロキシ経由)'}
            </div>
          </div>

          <div className={styles.section}>
            <strong>動的閾値情報:</strong>
            {thresholdError ? (
              <div className={styles.value} style={{ color: '#ff4444' }}>
                エラー: {thresholdError}
              </div>
            ) : thresholdInfo ? (
              <div className={styles.value}>
                <div>現在の閾値: <strong>{thresholdInfo.currentThreshold}人</strong></div>
                <div style={{ fontSize: '0.9em', color: '#888', marginTop: '4px' }}>
                  {thresholdInfo.thresholdReason}
                </div>
                <div style={{ marginTop: '8px' }}>
                  EventSub使用状況: {thresholdInfo.eventSubUsage.totalCost} / {thresholdInfo.eventSubUsage.maxTotalCost}
                  ({thresholdInfo.eventSubUsage.usageRate.toFixed(2)}%)
                </div>
                <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                  最終更新: {new Date(thresholdInfo.lastUpdated).toLocaleString('ja-JP')}
                </div>
              </div>
            ) : (
              <div className={styles.value}>読み込み中...</div>
            )}
          </div>

          <div className={styles.section}>
            <strong>API Request Logs:</strong>
            <div className={styles.logs}>
              {logs.length === 0 ? (
                <div className={styles.noLogs}>ログなし</div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`${styles.logItem} ${
                      log.error ? styles.logError : log.status && log.status >= 400 ? styles.logError : styles.logSuccess
                    }`}
                  >
                    <div className={styles.logTime}>{log.timestamp}</div>
                    <div className={styles.logMethod}>{log.method}</div>
                    <div className={styles.logUrl}>{log.url}</div>
                    {log.status && <div className={styles.logStatus}>{log.status}</div>}
                    {log.error && <div className={styles.logErrorText}>{log.error}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
