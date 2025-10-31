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
  { id: 'system', label: 'システム', path: '/system', icon: '💻' },
  { id: 'security', label: 'セキュリティ', path: '/security', icon: '🔒' },
  { id: 'streams', label: '配信管理', path: '/streams', icon: '📺' },
  { id: 'users', label: 'ユーザー管理', path: '/users', icon: '👥' },
  { id: 'logs', label: 'ログ閲覧', path: '/logs', icon: '📋' },
  { id: 'eventsub', label: 'EventSub管理', path: '/eventsub', icon: '🔔' },
  { id: 'cache', label: 'キャッシュ/DB', path: '/cache', icon: '💾' },
  { id: 'api-monitor', label: 'API監視', path: '/api-monitor', icon: '🌐' },
  { id: 'maintenance', label: 'メンテナンス', path: '/maintenance', icon: '🔧' }
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  console.log('[DEBUG] Layout: Rendering');

  // 値だけ取得（表示用） - ConnectionStatusは内部でサブスクライブするので不要
  const unreadAlertCount = useSecurityStore(state => state.unreadAlertCount);

  // setter関数だけ取得（useEffectで使用）
  const setSystemMetrics = useMetricsStore(state => state.setSystemMetrics);
  const setTwitchRateLimit = useMetricsStore(state => state.setTwitchRateLimit);
  const setYoutubeQuota = useMetricsStore(state => state.setYoutubeQuota);
  const setConnectionStatus = useMetricsStore(state => state.setConnectionStatus);
  const setMetricsError = useMetricsStore(state => state.setError);
  const setSecurityMetrics = useSecurityStore(state => state.setSecurityMetrics);
  const setSecurityError = useSecurityStore(state => state.setError);

  // WebSocket接続とメッセージ処理
  useEffect(() => {
    console.log('[DEBUG] Layout: WebSocket useEffect RUNNING');
    // WebSocket接続
    websocketClient.connect();

    // ステータス変更ハンドラー
    const statusHandler = (status: ConnectionStatus) => {
      setConnectionStatus(status);
    };

    // メッセージハンドラー
    const messageHandler = (message: any) => {
      console.log('[DEBUG] Layout: WebSocket message received', message.type);
      if (message.type === 'metrics_update') {
        if (message.data.system) {
          console.log('[DEBUG] Layout: Calling setSystemMetrics');
          setSystemMetrics(message.data.system);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        setSystemMetrics(systemMetrics);
        setTwitchRateLimit(twitchRate);
        setYoutubeQuota(youtubeQuota);
        setSecurityMetrics(securityMetrics);
      } catch (error) {
        console.error('Failed to load initial data:', error);
        const errorMessage =
          error instanceof Error ? error.message : '初期データの読み込みに失敗しました';
        setMetricsError(errorMessage);
        setSecurityError(errorMessage);
      }
    };

    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                  {item.id === 'security' && unreadAlertCount > 0 && (
                    <span className={styles.badge}>{unreadAlertCount}</span>
                  )}
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
