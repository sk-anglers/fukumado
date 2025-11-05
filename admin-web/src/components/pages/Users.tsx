import React, { useEffect, useState } from 'react';
import { getUserSessions, getUserStats, destroySession, getDailyUserStats } from '../../services/apiClient';
import { SessionInfo, UserStats as UserStatsType, DailyUserStat } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import styles from './Users.module.css';

export const Users: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [stats, setStats] = useState<UserStatsType | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyUserStat[]>([]);
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
      const [sessionsData, userStats, dailyStatsData] = await Promise.all([
        getUserSessions(),
        getUserStats(),
        getDailyUserStats(30)
      ]);

      setSessions(sessionsData.sessions);
      setSessionStats(sessionsData.stats);
      setStats(userStats);
      setDailyStats(dailyStatsData.dailyStats);
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
          <div className={styles.statHint}>現在ログイン中のユーザー数</div>
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

      {/* UU数推移グラフ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ユニークユーザー数推移 (過去30日)</h2>
        {dailyStats.length > 0 ? (
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={dailyStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#e2e8f0'
                  }}
                  labelFormatter={(value) => `日付: ${value}`}
                />
                <Legend
                  wrapperStyle={{ color: '#e2e8f0' }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="totalUsers"
                  stroke="#3498DB"
                  strokeWidth={2}
                  name="総ユーザー数"
                  dot={{ fill: '#3498DB', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="youtubeUsers"
                  stroke="#FF0000"
                  strokeWidth={2}
                  name="YouTubeユーザー"
                  dot={{ fill: '#FF0000', r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="twitchUsers"
                  stroke="#9146FF"
                  strokeWidth={2}
                  name="Twitchユーザー"
                  dot={{ fill: '#9146FF', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.noData}>データがありません</div>
        )}
      </section>

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
