import React from 'react';
import styles from './ErrorScreen.module.css';

interface ErrorScreenProps {
  error?: Error;
  resetError?: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, resetError }) => {
  const isDevelopment = import.meta.env.DEV;

  console.log('[ErrorScreen] Rendering ErrorScreen component', {
    hasError: !!error,
    errorMessage: error?.message,
    isDevelopment
  });

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

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
            href="https://twitter.com/anglers_jp"
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
};
