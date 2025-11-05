import React, { useEffect, useState } from 'react';
import { getUserStats } from '../../services/apiClient';
import { UserStats as UserStatsType } from '../../types';
import styles from './Users.module.css';

export const Users: React.FC = () => {
  const [stats, setStats] = useState<UserStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const userStats = await getUserStats();
      setStats(userStats);
    } catch (err) {
      console.error('Failed to load users data:', err);
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
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
        <h1 className={styles.title}>ユーザー管理</h1>
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
          <div className={styles.statLabel}>YouTube認証</div>
          <div className={styles.statValue}>{stats?.youtubeUsers || 0}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Twitch認証</div>
          <div className={styles.statValue}>{stats?.twitchUsers || 0}</div>
        </div>
      </div>

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
