import React, { useEffect, useState } from 'react';
import {
  getEventSubStats,
  getEventSubSubscriptions,
  getEventSubEvents,
  unsubscribeEventSub,
  reconnectEventSub
} from '../../services/apiClient';
import {
  EventSubStatsResponse,
  EventSubSubscriptionsResponse,
  EventSubEventsResponse
} from '../../types';
import styles from './EventSub.module.css';

export const EventSub: React.FC = () => {
  const [statsData, setStatsData] = useState<EventSubStatsResponse | null>(null);
  const [subsData, setSubsData] = useState<EventSubSubscriptionsResponse | null>(null);
  const [eventsData, setEventsData] = useState<EventSubEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [twitchUsername, setTwitchUsername] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [stats, subs, events] = await Promise.all([
        getEventSubStats(),
        getEventSubSubscriptions(),
        getEventSubEvents(20) // 最新20件を取得
      ]);
      setStatsData(stats);
      setSubsData(subs);
      setEventsData(events);
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
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    window.location.href = `${apiUrl}/auth/twitch?admin=true`;
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
            <div className={styles.statLabel}>モード</div>
            <div className={styles.statValue}>
              {statsData.stats.mode === 'conduit' ? '🚀 Conduits' : '📡 WebSocket'}
            </div>
            <div className={styles.statSubtext}>
              {statsData.stats.mode === 'conduit'
                ? '最大100,000サブスクリプション'
                : '最大900サブスクリプション'}
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

          {/* WebSocketモード */}
          {statsData.stats.mode === 'websocket' && (
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
          )}

          {/* Conduitsモード */}
          {statsData.stats.mode === 'conduit' && statsData.stats.conduitStats && (
            <div className={styles.conduitInfo}>
              <div className={styles.conduitCard}>
                <div className={styles.conduitHeader}>
                  <span className={styles.conduitTitle}>🚀 Conduit Information</span>
                </div>
                <div className={styles.conduitBody}>
                  <div className={styles.conduitStat}>
                    <span className={styles.conduitLabel}>Conduit ID:</span>
                    <span className={styles.conduitValue}>
                      {statsData.stats.conduitStats.conduitId || 'N/A'}
                    </span>
                  </div>
                  <div className={styles.conduitStat}>
                    <span className={styles.conduitLabel}>総シャード数:</span>
                    <span className={styles.conduitValue}>
                      {statsData.stats.conduitStats.totalShards}
                    </span>
                  </div>
                  <div className={styles.conduitStat}>
                    <span className={styles.conduitLabel}>有効シャード:</span>
                    <span className={styles.conduitValue}>
                      {statsData.stats.conduitStats.enabledShards}
                    </span>
                  </div>
                  <div className={styles.conduitStat}>
                    <span className={styles.conduitLabel}>無効シャード:</span>
                    <span className={styles.conduitValue}>
                      {statsData.stats.conduitStats.disabledShards}
                    </span>
                  </div>
                  <div className={styles.conduitStat}>
                    <span className={styles.conduitLabel}>サブスクリプション:</span>
                    <span className={styles.conduitValue}>
                      {statsData.stats.conduitStats.totalSubscriptions}
                    </span>
                  </div>
                  <div className={styles.conduitStat}>
                    <span className={styles.conduitLabel}>使用率:</span>
                    <span className={styles.conduitValue}>
                      {statsData.stats.conduitStats.usagePercentage.toFixed(3)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.conduitNote}>
                💡 Conduitsモードでは、Twitchが自動的にシャードを管理します。<br />
                最大100,000サブスクリプションまで対応可能です。
              </div>
            </div>
          )}
        </section>
      )}

      {/* 監視チャンネル */}
      {subsData && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>監視チャンネル</h2>

          {/* 優先度統計 */}
          {subsData.priorityStats && (
            <div className={styles.priorityStats}>
              <div className={styles.priorityStat}>
                <span className={styles.priorityLabel}>総ユーザー数:</span>
                <span className={styles.priorityValue}>{subsData.priorityStats.totalUsers}</span>
              </div>
              <div className={styles.priorityStat}>
                <span className={styles.priorityLabel}>総チャンネル数:</span>
                <span className={styles.priorityValue}>{subsData.priorityStats.totalChannels}</span>
              </div>
              <div className={styles.priorityStat}>
                <span className={styles.priorityLabel}>EventSub監視:</span>
                <span className={styles.priorityValue}>{subsData.priorityStats.realtimeChannels}</span>
              </div>
              <div className={styles.priorityStat}>
                <span className={styles.priorityLabel}>ポーリング監視:</span>
                <span className={styles.priorityValue}>{subsData.priorityStats.delayedChannels}</span>
              </div>
            </div>
          )}

          {/* EventSub監視中のチャンネル */}
          {subsData.allChannels && (
            <>
              <div className={styles.channelSection}>
                <h3 className={styles.channelSectionTitle}>
                  🔴 EventSub監視中 ({subsData.allChannels.realtime.length})
                </h3>
                <p className={styles.channelSectionDesc}>
                  2人以上が視聴中のチャンネル（リアルタイム監視）
                </p>

                {subsData.allChannels.realtime.length === 0 ? (
                  <div className={styles.noData}>EventSub監視中のチャンネルはありません</div>
                ) : (
                  <div className={styles.channelList}>
                    {subsData.allChannels.realtime.map((channel) => (
                      <div key={channel.channelId} className={styles.channelCard}>
                        <div className={styles.channelInfo}>
                          {channel.channelDisplayName || channel.channelLogin ? (
                            <>
                              <div className={styles.channelName}>
                                {channel.channelDisplayName || channel.channelLogin}
                              </div>
                              <div className={styles.channelId}>({channel.channelId})</div>
                            </>
                          ) : (
                            <div className={styles.channelId}>{channel.channelId}</div>
                          )}
                          <div className={styles.channelMeta}>
                            <span className={styles.channelBadge}>👥 {channel.userCount}人</span>
                            <span className={styles.channelMethod}>{channel.method}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnsubscribe(channel.channelId)}
                          className={styles.unsubscribeButton}
                        >
                          購読解除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.channelSection}>
                <h3 className={styles.channelSectionTitle}>
                  🟡 ポーリング監視中 ({subsData.allChannels.delayed.length})
                </h3>
                <p className={styles.channelSectionDesc}>
                  1人のみが視聴中のチャンネル（60秒間隔でポーリング）
                </p>

                {subsData.allChannels.delayed.length === 0 ? (
                  <div className={styles.noData}>ポーリング監視中のチャンネルはありません</div>
                ) : (
                  <div className={styles.channelList}>
                    {subsData.allChannels.delayed.map((channel) => (
                      <div key={channel.channelId} className={styles.channelCard}>
                        <div className={styles.channelInfo}>
                          {channel.channelDisplayName || channel.channelLogin ? (
                            <>
                              <div className={styles.channelName}>
                                {channel.channelDisplayName || channel.channelLogin}
                              </div>
                              <div className={styles.channelId}>({channel.channelId})</div>
                            </>
                          ) : (
                            <div className={styles.channelId}>{channel.channelId}</div>
                          )}
                          <div className={styles.channelMeta}>
                            <span className={styles.channelBadge}>👥 {channel.userCount}人</span>
                            <span className={styles.channelMethod}>{channel.method}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 旧形式との互換性（allChannelsがない場合） */}
          {!subsData.allChannels && subsData.totalChannels > 0 && (
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

      {/* イベント履歴 */}
      {eventsData && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            イベント履歴 ({eventsData.totalEvents})
          </h2>

          {eventsData.totalEvents === 0 ? (
            <div className={styles.noData}>イベント履歴はありません</div>
          ) : (
            <div className={styles.eventList}>
              {eventsData.events.map((event) => (
                <div key={event.id} className={styles.eventCard}>
                  <div className={styles.eventHeader}>
                    <span className={`${styles.eventType} ${styles[event.type]}`}>
                      {event.type === 'online' ? '🟢 配信開始' : '🔴 配信終了'}
                    </span>
                    <span className={styles.eventTime}>
                      {new Date(event.timestamp).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <div className={styles.eventBody}>
                    <div className={styles.eventBroadcaster}>
                      <strong>{event.broadcasterName}</strong> (@{event.broadcasterLogin})
                    </div>
                    <div className={styles.eventId}>ID: {event.broadcasterId}</div>
                    {event.startedAt && (
                      <div className={styles.eventStarted}>
                        開始: {new Date(event.startedAt).toLocaleString('ja-JP')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
