import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard, System, Security, Maintenance, Streams, Users, Logs, EventSub, Cache, ApiMonitor, PVStats, Analytics, ServerMonitor } from './components/pages';
import { setAuthCredentials } from './services/apiClient';
import styles from './App.module.css';

/**
 * ログインコンポーネント
 */
const LoginPage: React.FC<{ onLogin: (username: string, password: string) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      onLogin(username, password);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>ふくまど！管理ダッシュボード</h1>
        <p className={styles.loginSubtitle}>管理者ログイン</p>
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.formGroup}>
            <label htmlFor="username">ユーザー名</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className={styles.loginButton}>
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
};

function App() {
  console.log('[DEBUG] App: Rendering');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ローカルストレージから認証情報を復元
  useEffect(() => {
    console.log('[DEBUG] App: Auth restore useEffect RUNNING');
    const savedUsername = localStorage.getItem('admin_username');
    const savedPassword = localStorage.getItem('admin_password');

    if (savedUsername && savedPassword) {
      setAuthCredentials(savedUsername, savedPassword);
      setIsAuthenticated(true);
    }
  }, []);

  // 認証エラーをリッスンして自動ログアウト
  useEffect(() => {
    console.log('[DEBUG] App: Auth error listener useEffect RUNNING');
    const handleAuthError = () => {
      console.warn('[Auth] Authentication failed, logging out...');
      setIsAuthenticated(false);
      localStorage.removeItem('admin_username');
      localStorage.removeItem('admin_password');
    };

    window.addEventListener('auth-error', handleAuthError);

    return () => {
      console.log('[DEBUG] App: Auth error listener useEffect CLEANUP');
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, []);

  const handleLogin = (username: string, password: string) => {
    // 認証情報を設定
    setAuthCredentials(username, password);

    // ローカルストレージに保存（本番環境では適切なトークン管理を推奨）
    localStorage.setItem('admin_username', username);
    localStorage.setItem('admin_password', password);

    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/system" element={<System />} />
          <Route path="/server-monitor" element={<ServerMonitor />} />
          <Route path="/security" element={<Security />} />
          <Route path="/streams" element={<Streams />} />
          <Route path="/users" element={<Users />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/eventsub" element={<EventSub />} />
          <Route path="/cache" element={<Cache />} />
          <Route path="/api-monitor" element={<ApiMonitor />} />
          <Route path="/pv-stats" element={<PVStats />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
