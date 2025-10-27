import React, { useEffect, useState } from 'react';
import { getUserSessions, getUserStats, destroySession } from '../../services/apiClient';
import { SessionInfo, UserStats as UserStatsType } from '../../types';
import styles from './Users.module.css';

export const Users: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [stats, setStats] = useState<UserStatsType | null>(null);
  const [sessionStats, setSessionStats] = useState({
    totalSessions: 0,
    authenticatedSessions: 0,
    youtubeAuthSessions: 0,
    twitchAuthSessions: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const [sessionsData, userStats] = await Promise.all([
        getUserSessions(),
        getUserStats()
      ]);

      setSessions(sessionsData.sessions);
      setSessionStats(sessionsData.stats);
      setStats(userStats);
    } catch (err) {
      console.error('Failed to load users data:', err);
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDestroySession = async (sessionId: string) => {
    if (!confirm('このセッションを強制終了しますか?')) {
      return;
    }

    try {
      await destroySession(sessionId);
      await loadData(); // リロード
    } catch (err) {
      console.error('Failed to destroy session:', err);
      alert('セッションの終了に失敗しました');
    }
  };

  useEffect(() => {
    loadData();

    // 30秒ごとに自動更新
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('ja-JP');
    } catch {
      return '-';
    }
  };

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
        <h1 className={styles.title}>ユーザー・セッション管理</h1>
        <button onClick={loadData} className={styles.refreshButton}>
          🔄 更新
        </button>
      </header>

      {/* 統計カード */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>総ユニークユーザー</div>
          <div className={styles.statValue}>{stats?.totalUsers || 0}</div>
          <div className={styles.statSubtext}>YouTube + Twitch</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>アクティブセッション</div>
          <div className={styles.statValue}>{sessionStats.totalSessions}</div>
          <div className={styles.statSubtext}>
            認証済: {sessionStats.authenticatedSessions}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>YouTube認証</div>
          <div className={styles.statValue}>{stats?.youtubeUsers || 0}</div>
          <div className={styles.statSubtext}>
            セッション: {sessionStats.youtubeAuthSessions}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Twitch認証</div>
          <div className={styles.statValue}>{stats?.twitchUsers || 0}</div>
          <div className={styles.statSubtext}>
            セッション: {sessionStats.twitchAuthSessions}
          </div>
        </div>
      </div>

      {/* セッション一覧 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アクティブセッション ({sessions.length})</h2>

        {sessions.length === 0 ? (
          <div className={styles.noData}>アクティブなセッションはありません</div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>セッションID</th>
                  <th>認証状態</th>
                  <th>YouTubeユーザー</th>
                  <th>Twitchユーザー</th>
                  <th>作成日時</th>
                  <th>最終アクティビティ</th>
                  <th>IPアドレス</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.sessionId}>
                    <td className={styles.sessionId}>
                      {session.sessionId.substring(0, 12)}...
                    </td>
                    <td>
                      <div className={styles.authStatus}>
                        {session.authenticated && (
                          <span className={styles.badge}>YouTube</span>
                        )}
                        {session.twitchAuthenticated && (
                          <span className={styles.badge}>Twitch</span>
                        )}
                        {!session.authenticated && !session.twitchAuthenticated && (
                          <span className={styles.badgeGray}>未認証</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {session.googleUser ? (
                        <div className={styles.userInfo}>
                          <div className={styles.userName}>
                            {session.googleUser.name}
                          </div>
                          <div className={styles.userEmail}>
                            {session.googleUser.email}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {session.twitchUser ? (
                        <div className={styles.userInfo}>
                          <div className={styles.userName}>
                            {session.twitchUser.displayName}
                          </div>
                          <div className={styles.userEmail}>
                            @{session.twitchUser.login}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{formatDate(session.createdAt)}</td>
                    <td>{formatDate(session.lastActivity)}</td>
                    <td className={styles.ipAddress}>{session.ipAddress || '-'}</td>
                    <td>
                      <button
                        className={styles.destroyButton}
                        onClick={() => handleDestroySession(session.sessionId)}
                      >
                        強制終了
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 最近のログイン */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>最近のログイン (過去24時間)</h2>

        {!stats || stats.recentLogins.length === 0 ? (
          <div className={styles.noData}>最近のログインはありません</div>
        ) : (
          <div className={styles.recentLogins}>
            {stats.recentLogins.map((login, index) => (
              <div key={index} className={styles.loginCard}>
                <div className={styles.loginTime}>{formatDate(login.createdAt)}</div>
                <div className={styles.loginUsers}>
                  {login.googleUser && (
                    <div className={styles.loginUser}>
                      <span className={styles.badge}>YouTube</span>
                      <span className={styles.loginName}>{login.googleUser.name}</span>
                    </div>
                  )}
                  {login.twitchUser && (
                    <div className={styles.loginUser}>
                      <span className={styles.badge}>Twitch</span>
                      <span className={styles.loginName}>
                        {login.twitchUser.displayName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
