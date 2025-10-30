import React from 'react';
import { useMetricsStore } from '../../stores/metricsStore';
import styles from './ConnectionStatus.module.css';

export const ConnectionStatus: React.FC = () => {
  // storeから直接取得して、このコンポーネントのみが再レンダリングされる
  const status = useMetricsStore(state => state.connectionStatus);
  const lastUpdate = useMetricsStore(state => state.lastUpdate);

  console.log('[DEBUG] ConnectionStatus: Rendering');
  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return '接続中';
      case 'connecting':
        return '接続中...';
      case 'disconnected':
        return '切断';
      case 'error':
        return 'エラー';
      default:
        return '不明';
    }
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return null;

    const date = new Date(lastUpdate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec}秒前`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
    return date.toLocaleTimeString('ja-JP');
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.indicator} ${styles[status]}`}></div>
      <span className={styles.text}>{getStatusText()}</span>
      {lastUpdate && (
        <span className={styles.lastUpdate}>最終更新: {formatLastUpdate()}</span>
      )}
    </div>
  );
};
