import React from 'react';
import { trackButtonClick } from '../../utils/gtm';
import styles from './ErrorScreen.module.css';

interface ErrorScreenProps {
  error?: Error;
  resetError?: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, resetError }) => {
  console.log('[ErrorScreen] Component mounted');

  let isDevelopment = false;
  try {
    isDevelopment = import.meta.env.DEV;
  } catch (e) {
    console.error('[ErrorScreen] Failed to get DEV env:', e);
  }

  console.log('[ErrorScreen] Rendering ErrorScreen component', {
    hasError: !!error,
    errorMessage: error?.message,
    isDevelopment,
    styles: typeof styles,
    stylesKeys: Object.keys(styles || {})
  });

  const handleReload = () => {
    console.log('[ErrorScreen] Reload button clicked');
    // GTMトラッキング
    trackButtonClick('error_screen_reload', {
      error_message: error?.message
    });
    window.location.reload();
  };

  const handleGoHome = () => {
    console.log('[ErrorScreen] Home button clicked');
    // GTMトラッキング
    trackButtonClick('error_screen_go_home', {
      error_message: error?.message
    });
    window.location.href = '/';
  };

  try {
    return (
      <div className={styles.errorScreen}>
        <div className={styles.errorContent}>
          <div className={styles.icon}>😕</div>

          <h1 className={styles.title}>エラーが発生しました</h1>

          <p className={styles.message}>
            申し訳ございません。予期しないエラーが発生しました。
            <br />
            ページをリロードするか、トップページに戻ってお試しください。
          </p>

        {isDevelopment && error && (
          <div className={styles.errorDetails}>
            <h3 className={styles.errorDetailsTitle}>開発者向け情報:</h3>
            <pre className={styles.errorDetailsContent}>
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </div>
        )}

        <div className={styles.buttons}>
          <button
            onClick={resetError || handleReload}
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            🔄 ページをリロード
          </button>

          <button
            onClick={handleGoHome}
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            🏠 トップページへ
          </button>
        </div>

          <div className={styles.footer}>
            問題が解決しない場合は、
            <a
              href="https://x.com/fukumado_staff"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              サポート
            </a>
            までお問い合わせください。
          </div>
        </div>
      </div>
    );
  } catch (renderError) {
    console.error('[ErrorScreen] Render error:', renderError);
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#e2e8f0',
        padding: '24px',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ maxWidth: '600px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>エラーが発生しました</h1>
          <p style={{ fontSize: '18px', marginBottom: '32px' }}>
            申し訳ございません。予期しないエラーが発生しました。
          </p>
          <button
            onClick={handleReload}
            style={{
              padding: '12px 32px',
              background: '#3498DB',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              marginRight: '12px'
            }}
          >
            🔄 ページをリロード
          </button>
          <button
            onClick={handleGoHome}
            style={{
              padding: '12px 32px',
              background: '#334155',
              color: '#e2e8f0',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            🏠 トップページへ
          </button>
        </div>
      </div>
    );
  }
};
