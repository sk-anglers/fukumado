import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectionStatus } from './common';
import { useMetricsStore } from '../stores/metricsStore';
import { useSecurityStore } from '../stores/securityStore';
import { websocketClient } from '../services/websocketClient';
import {
  getSystemMetrics,
  getTwitchRateLimit,
  getYouTubeQuota,
  getSecurityMetrics
} from '../services/apiClient';
import { NavItem } from '../types';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'ダッシュボード', path: '/', icon: '📊' },
  { id: 'pv-stats', label: 'PV統計', path: '/pv-stats', icon: '📈' },
  { id: 'analytics', label: 'アナリティクス', path: '/analytics', icon: '📉' },
  { id: 'system', label: 'システム', path: '/system', icon: '💻' },
  { id: 'server-monitor', label: 'サーバ監視', path: '/server-monitor', icon: '🖥️' },
  { id: 'security', label: 'セキュリティ', path: '/security', icon: '🔒' },
  { id: 'streams', label: '配信管理', path: '/streams', icon: '📺' },
  { id: 'users', label: 'ユーザー管理', path: '/users', icon: '👥' },
  { id: 'logs', label: 'ログ閲覧', path: '/logs', icon: '📋' },
  { id: 'audit-logs', label: '監査ログ', path: '/audit-logs', icon: '📜' },
  { id: 'alerts', label: 'アラート', path: '/alerts', icon: '🔔' },
  { id: 'eventsub', label: 'EventSub管理', path: '/eventsub', icon: '📡' },
  { id: 'cache', label: 'キャッシュ/DB', path: '/cache', icon: '💾' },
  { id: 'api-monitor', label: 'API監視', path: '/api-monitor', icon: '🌐' },
  { id: 'maintenance', label: 'メンテナンス', path: '/maintenance', icon: '🔧' }
];

/**
 * セキュリティバッジコンポーネント
 * このコンポーネントのみがunreadAlertCountの変更をサブスクライブする
 */
const SecurityBadge: React.FC = () => {
  const unreadAlertCount = useSecurityStore(state => state.unreadAlertCount);

  if (unreadAlertCount === 0) {
    return null;
  }

  return <span className={styles.badge}>{unreadAlertCount}</span>;
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  console.log('[DEBUG] Layout: Rendering');

  // WebSocket接続とメッセージ処理
  useEffect(() => {
    console.log('[DEBUG] Layout: WebSocket useEffect RUNNING');
    // WebSocket接続
    websocketClient.connect();

    // ステータス変更ハンドラー
    const statusHandler = (status: ConnectionStatus) => {
      // getState()を使って直接ストアのアクションを呼び出す（再レンダリング防止）
      useMetricsStore.getState().setConnectionStatus(status);
    };

    // メッセージハンドラー
    const messageHandler = (message: any) => {
      console.log('[DEBUG] Layout: WebSocket message received', message.type);
      if (message.type === 'metrics_update') {
        if (message.data.system) {
          console.log('[DEBUG] Layout: Calling setSystemMetrics');
          // getState()を使って直接ストアのアクションを呼び出す（再レンダリング防止）
          useMetricsStore.getState().setSystemMetrics(message.data.system);
        }
      }
    };

    websocketClient.onStatusChange(statusHandler);
    websocketClient.onMessage(messageHandler);

    // クリーンアップ（ハンドラーのみ解除、接続は維持）
    return () => {
      console.log('[DEBUG] Layout: WebSocket useEffect CLEANUP');
      websocketClient.offStatusChange(statusHandler);
      websocketClient.offMessage(messageHandler);
      // NOTE: WebSocket接続は切断せず維持（アプリケーション全体で共有）
    };
  }, []);

  // 初期データ読み込み
  useEffect(() => {
    console.log('[DEBUG] Layout: Initial data load useEffect RUNNING');
    const loadInitialData = async () => {
      try {
        const [systemMetrics, twitchRate, youtubeQuota, securityMetrics] =
          await Promise.all([
            getSystemMetrics(),
            getTwitchRateLimit(),
            getYouTubeQuota(),
            getSecurityMetrics()
          ]);

        // getState()を使って直接ストアのアクションを呼び出す（再レンダリング防止）
        useMetricsStore.getState().setSystemMetrics(systemMetrics);
        useMetricsStore.getState().setTwitchRateLimit(twitchRate);
        useMetricsStore.getState().setYoutubeQuota(youtubeQuota);
        useSecurityStore.getState().setSecurityMetrics(securityMetrics);
      } catch (error) {
        console.error('Failed to load initial data:', error);
        const errorMessage =
          error instanceof Error ? error.message : '初期データの読み込みに失敗しました';
        useMetricsStore.getState().setError(errorMessage);
        useSecurityStore.getState().setError(errorMessage);
      }
    };

    loadInitialData();
  }, []);

  return (
    <div className={styles.layout}>
      {/* ヘッダー */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.logo}>ふくまど！管理ダッシュボード</h1>
          <div className={styles.headerRight}>
            <ConnectionStatus />
          </div>
        </div>
      </header>

      <div className={styles.container}>
        {/* サイドバー */}
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                  {item.id === 'security' && <SecurityBadge />}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* メインコンテンツ */}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
};
