import React, { useEffect, useState } from 'react';
import {
  getEventSubStats,
  getEventSubSubscriptions,
  unsubscribeEventSub,
  reconnectEventSub
} from '../../services/apiClient';
import {
  EventSubStatsResponse,
  EventSubSubscriptionsResponse
} from '../../types';
import styles from './EventSub.module.css';

export const EventSub: React.FC = () => {
  const [statsData, setStatsData] = useState<EventSubStatsResponse | null>(null);
  const [subsData, setSubsData] = useState<EventSubSubscriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [twitchUsername, setTwitchUsername] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [stats, subs] = await Promise.all([
        getEventSubStats(),
        getEventSubSubscriptions()
      ]);
      setStatsData(stats);
      setSubsData(subs);
    } catch (err) {
      console.error('Failed to load EventSub data:', err);
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    if (!confirm('EventSubを再接続しますか?')) {
      return;
    }

    try {
      await reconnectEventSub();
      await loadData();
    } catch (err) {
      console.error('Failed to reconnect:', err);
      alert('再接続に失敗しました');
    }
  };

  const handleUnsubscribe = async (userId: string) => {
    if (!confirm(`チャンネル ${userId} の購読を解除しますか?`)) {
      return;
    }

    try {
      await unsubscribeEventSub(userId);
      await loadData();
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      alert('購読解除に失敗しました');
    }
  };

  const handleTwitchLogin = () => {
    // 本サービス経由で認証（admin=trueパラメータを付与）
    window.location.href = 'http://localhost:4000/auth/twitch?admin=true';
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30秒ごとに更新

    // URLパラメータから認証成功を検出
    const params = new URLSearchParams(window.location.search);
    if (params.get('twitch_auth') === 'success') {
      const username = params.get('username');
      if (username) {
        setTwitchUsername(username);
        alert(`Twitchログイン成功: ${username}`);
      }
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>EventSub管理</h1>
        <div className={styles.headerButtons}>
          {twitchUsername ? (
            <div className={styles.twitchStatus}>
              🟢 {twitchUsername}
            </div>
          ) : (
            <button onClick={handleTwitchLogin} className={styles.twitchLoginButton}>
              🔓 Twitchログイン
            </button>
          )}
          <button onClick={loadData} className={styles.refreshButton}>
            🔄 更新
          </button>
          <button onClick={handleReconnect} className={styles.reconnectButton}>
            🔌 再接続
          </button>
        </div>
      </header>

      {/* 統計カード */}
      {statsData && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>総接続数</div>
            <div className={styles.statValue}>{statsData.stats.totalConnections}</div>
            <div className={styles.statSubtext}>
              アクティブ: {statsData.stats.activeConnections}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>総購読数</div>
            <div className={styles.statValue}>{statsData.stats.totalSubscriptions}</div>
            <div className={styles.statSubtext}>
              チャンネル: {statsData.stats.subscribedChannelCount}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>使用率</div>
            <div className={styles.statValue}>{statsData.capacity.percentage.toFixed(1)}%</div>
            <div className={styles.statSubtext}>
              {statsData.capacity.used} / {statsData.capacity.total}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>残り容量</div>
            <div className={styles.statValue}>{statsData.capacity.available}</div>
            <div className={styles.statSubtext}>購読可能</div>
          </div>
        </div>
      )}

      {/* 接続状況 */}
      {statsData && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>接続状況</h2>
          <div className={styles.connectionsGrid}>
            {statsData.stats.connections.map((conn) => (
              <div key={conn.index} className={styles.connectionCard}>
                <div className={styles.connectionHeader}>
                  <span className={styles.connectionIndex}>接続 #{conn.index}</span>
                  <span className={`${styles.connectionStatus} ${styles[conn.status]}`}>
                    {conn.status}
                  </span>
                </div>
                <div className={styles.connectionBody}>
                  <div className={styles.connectionStat}>
                    <span className={styles.connectionLabel}>購読数:</span>
                    <span className={styles.connectionValue}>{conn.subscriptionCount}</span>
                  </div>
                  {conn.sessionId && (
                    <div className={styles.connectionStat}>
                      <span className={styles.connectionLabel}>セッションID:</span>
                      <span className={styles.connectionValue}>{conn.sessionId.substring(0, 12)}...</span>
                    </div>
                  )}
                  {conn.connectedAt && (
                    <div className={styles.connectionStat}>
                      <span className={styles.connectionLabel}>接続時刻:</span>
                      <span className={styles.connectionValue}>
                        {new Date(conn.connectedAt).toLocaleString('ja-JP')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 購読チャンネル */}
      {subsData && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            購読チャンネル ({subsData.totalChannels})
          </h2>

          {subsData.totalChannels === 0 ? (
            <div className={styles.noData}>購読チャンネルはありません</div>
          ) : (
            <div className={styles.channelList}>
              {subsData.channelIds.map((userId) => (
                <div key={userId} className={styles.channelCard}>
                  <div className={styles.channelId}>{userId}</div>
                  <button
                    onClick={() => handleUnsubscribe(userId)}
                    className={styles.unsubscribeButton}
                  >
                    購読解除
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
