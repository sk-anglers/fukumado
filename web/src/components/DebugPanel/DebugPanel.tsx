import { useState, useEffect } from 'react';
import styles from './DebugPanel.module.css';

interface ApiLog {
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  error?: string;
}

export const DebugPanel = (): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<ApiLog[]>([]);

  useEffect(() => {
    // グローバルにログを受け取るリスナーを設定
    const handleLog = (event: CustomEvent<ApiLog>) => {
      setLogs((prev) => [event.detail, ...prev].slice(0, 20)); // 最新20件
    };

    window.addEventListener('api-log' as any, handleLog);
    return () => window.removeEventListener('api-log' as any, handleLog);
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
