import { useState, useEffect } from 'react';
import { apiUrl, apiFetch } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import styles from './WelcomeScreen.module.css';

interface WelcomeScreenProps {
  onLoginSuccess: () => void;
}

export const WelcomeScreen = ({ onLoginSuccess }: WelcomeScreenProps): JSX.Element => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginCompleted, setLoginCompleted] = useState(false);
  const setTwitchStatus = useAuthStore((state) => state.setTwitchStatus);

  // loginCompletedステートの変化を監視
  useEffect(() => {
    console.log('[WelcomeScreen] loginCompleted state changed to:', loginCompleted);
  }, [loginCompleted]);

  const refreshTwitchAuthStatus = async (): Promise<boolean> => {
    try {
      const response = await apiFetch('/auth/twitch/status');
      console.log('[WelcomeScreen] Auth status response:', response.status, response.ok);
      if (!response.ok) {
        console.log('[WelcomeScreen] Auth status not OK, returning false');
        return false;
      }
      const data = await response.json();
      console.log('[WelcomeScreen] Auth status data:', data);
      console.log('[WelcomeScreen] Authenticated:', Boolean(data.authenticated));
      setTwitchStatus({
        authenticated: Boolean(data.authenticated),
        user: data.user,
        error: undefined
      });
      return Boolean(data.authenticated);
    } catch (error) {
      console.error('[WelcomeScreen] Failed to refresh auth status:', error);
      return false;
    }
  };

  const handleTwitchLogin = (): void => {
    setIsLoggingIn(true);

    const authWindow = window.open(
      apiUrl('/auth/twitch'),
      'twitch-oauth',
      'width=500,height=650,menubar=no,toolbar=no'
    );

    if (!authWindow) {
      setIsLoggingIn(false);
      alert('ポップアップがブロックされました。ポップアップを許可してください。');
      return;
    }

    console.log('[WelcomeScreen] OAuth popup opened, starting polling');

    // ポーリング: 500msごとに認証状態を確認
    const timer = window.setInterval(async () => {
      // ウィンドウが閉じられた場合
      if (authWindow.closed) {
        console.log('[WelcomeScreen] Popup closed, checking authentication');
        window.clearInterval(timer);

        // 最大10回、500msごとにリトライ（合計5秒）
        let authenticated = false;
        for (let i = 0; i < 10; i++) {
          authenticated = await refreshTwitchAuthStatus();
          if (authenticated) {
            console.log(`[WelcomeScreen] Authentication confirmed on retry ${i + 1}`);
            break;
          }

          if (i < 9) { // 最後の試行ではwaitしない
            console.log(`[WelcomeScreen] Retry ${i + 1}/10, waiting 500ms...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (authenticated) {
          console.log('[WelcomeScreen] Authentication confirmed, setting loginCompleted to true');
          console.log('[WelcomeScreen] Current loginCompleted state:', loginCompleted);
          setLoginCompleted(true); // ボタンを「利用開始する」に変更
          console.log('[WelcomeScreen] setLoginCompleted(true) called');
        } else {
          console.log('[WelcomeScreen] Authentication not completed after 10 retries');
        }

        setIsLoggingIn(false);
        return;
      }

      // 認証状態を定期的に確認
      const authenticated = await refreshTwitchAuthStatus();

      // 認証成功したらポップアップを閉じる
      if (authenticated) {
        console.log('[WelcomeScreen] Authentication successful, closing popup');
        window.clearInterval(timer);
        authWindow.close();
        setIsLoggingIn(false);
        console.log('[WelcomeScreen] (Path1) Setting loginCompleted to true');
        setLoginCompleted(true); // ボタンを「利用開始する」に変更
        console.log('[WelcomeScreen] (Path1) setLoginCompleted(true) called');
      }
    }, 500);
  };

  // ボタンクリック処理
  const handleButtonClick = (): void => {
    if (loginCompleted) {
      // ログイン完了後 → 利用開始
      onLoginSuccess();
    } else {
      // 未ログイン → ログイン処理
      handleTwitchLogin();
    }
  };

  console.log('[WelcomeScreen] Rendering with loginCompleted:', loginCompleted, 'isLoggingIn:', isLoggingIn);

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.logo}>ふ</div>
        <h1 className={styles.title}>ふくまど！</h1>
        <p className={styles.subtitle}>
          複数のTwitch配信を1画面で同時視聴
        </p>

        <div className={styles.screenshot}>
          <img
            src="/demo-screenshot.png"
            alt="4分割で複数配信を同時視聴"
            className={styles.screenshotImage}
          />
        </div>

        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>📺</span>
            <span className={styles.featureText}>最大8画面の同時視聴</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🎛️</span>
            <span className={styles.featureText}>音量・レイアウトを自由調整</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🔔</span>
            <span className={styles.featureText}>お気に入り配信の開始通知</span>
          </div>
        </div>

        <button
          className={`${styles.loginButton} ${loginCompleted ? styles.startButton : ''}`}
          onClick={handleButtonClick}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <>
              <span className={styles.spinner}></span>
              ログイン中...
            </>
          ) : loginCompleted ? (
            <>
              ✓ 利用開始する
            </>
          ) : (
            <>
              <svg className={styles.twitchIcon} viewBox="0 0 24 24" fill="none">
                <path
                  d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"
                  fill="currentColor"
                />
              </svg>
              Twitchでログイン
            </>
          )}
        </button>

        <p className={styles.legal}>
          ログインすることで、
          <a href="/terms" target="_blank" rel="noopener noreferrer">利用規約</a>と
          <a href="/privacy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>
          に同意したものとみなされます
        </p>

        <p className={styles.guestNote}>
          ※完全無料でご利用いただけます
        </p>
      </div>
    </div>
  );
};
