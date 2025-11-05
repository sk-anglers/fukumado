import React, { useEffect, useState } from 'react';
import { getUserStats, searchUsers, deleteUser } from '../../services/apiClient';
import { UserStats as UserStatsType, UserSearchResult } from '../../types';
import styles from './Users.module.css';

export const Users: React.FC = () => {
  const [stats, setStats] = useState<UserStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ユーザー検索関連
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      setError(null);
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error('Failed to search users:', err);
      setError(err instanceof Error ? err.message : '検索に失敗しました');
    } finally {
      setSearching(false);
    }
  };

  const handleDeleteUser = async (user: UserSearchResult) => {
    const confirmMessage = `本当にこのユーザーを削除しますか？\n\nユーザー名: ${user.displayName}\nメール: ${user.email || 'なし'}\nYouTube ID: ${user.youtubeUserId || 'なし'}\nTwitch ID: ${user.twitchUserId || 'なし'}\n\nこの操作は取り消せません。`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteUser(user.id);
      alert(`ユーザー「${user.displayName}」を削除しました`);

      // 検索結果から削除
      setSearchResults(searchResults.filter(u => u.id !== user.id));

      // 統計を再読み込み
      await loadData();
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('ユーザーの削除に失敗しました');
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

      {/* ユーザー検索 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ユーザー検索・削除</h2>

        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="メールアドレス、ユーザー名、YouTube ID、Twitch IDで検索..."
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton} disabled={searching}>
            {searching ? '検索中...' : '🔍 検索'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            <div className={styles.resultsHeader}>
              検索結果: {searchResults.length}件
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ユーザー名</th>
                    <th>メールアドレス</th>
                    <th>YouTube ID</th>
                    <th>Twitch ID</th>
                    <th>作成日時</th>
                    <th>最終ログイン</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className={styles.userInfo}>
                          <div className={styles.userName}>{user.displayName}</div>
                        </div>
                      </td>
                      <td>{user.email || '-'}</td>
                      <td className={styles.userId}>{user.youtubeUserId || '-'}</td>
                      <td className={styles.userId}>{user.twitchUserId || '-'}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>{formatDate(user.lastLoginAt)}</td>
                      <td>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDeleteUser(user)}
                        >
                          🗑️ 削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {searchQuery && searchResults.length === 0 && !searching && (
          <div className={styles.noData}>検索結果が見つかりませんでした</div>
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
