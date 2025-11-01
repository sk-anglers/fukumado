import styles from './UnsupportedBrowser.module.css';

export const UnsupportedBrowser = (): JSX.Element => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>⚠️</div>
        <h1 className={styles.title}>Safari非対応のお知らせ</h1>
        <p className={styles.message}>
          申し訳ございません。現在、Safariブラウザには対応しておりません。
        </p>
        <div className={styles.recommendation}>
          <h2 className={styles.recommendTitle}>推奨ブラウザ</h2>
          <div className={styles.browsers}>
            <div className={styles.browserItem}>
              <div className={styles.browserIcon}>
                <img
                  src="https://www.google.com/chrome/static/images/chrome-logo-m100.svg"
                  alt="Chrome"
                  className={styles.browserLogo}
                />
              </div>
              <div className={styles.browserName}>Google Chrome</div>
              <a
                href="https://www.google.com/chrome/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.downloadLink}
              >
                ダウンロード
              </a>
            </div>
            <div className={styles.browserItem}>
              <div className={styles.browserIcon}>
                <img
                  src="https://www.mozilla.org/media/protocol/img/logos/firefox/browser/logo.svg"
                  alt="Firefox"
                  className={styles.browserLogo}
                />
              </div>
              <div className={styles.browserName}>Mozilla Firefox</div>
              <a
                href="https://www.mozilla.org/firefox/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.downloadLink}
              >
                ダウンロード
              </a>
            </div>
            <div className={styles.browserItem}>
              <div className={styles.browserIcon}>
                <img
                  src="https://www.microsoft.com/edge/favicon.ico"
                  alt="Edge"
                  className={styles.browserLogo}
                />
              </div>
              <div className={styles.browserName}>Microsoft Edge</div>
              <a
                href="https://www.microsoft.com/edge/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.downloadLink}
              >
                ダウンロード
              </a>
            </div>
          </div>
        </div>
        <div className={styles.reason}>
          <details className={styles.details}>
            <summary className={styles.summary}>なぜSafariに対応していないのですか？</summary>
            <p className={styles.detailsText}>
              Safariブラウザは、セキュリティ上の理由から一部の機能（Cookie、セッション管理など）が制限されており、
              本サービスの正常な動作に必要な機能が利用できないためです。
              <br />
              <br />
              将来的な対応を検討しておりますが、現時点では他のブラウザのご利用をお願いいたします。
            </p>
          </details>
        </div>
      </div>
    </div>
  );
};
