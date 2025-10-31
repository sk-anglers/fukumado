/**
 * モバイル制限画面コンポーネント
 * モバイルデバイスからのアクセス時に表示される案内画面
 */

import styles from './MobileRestriction.module.css';

export const MobileRestriction = (): JSX.Element => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>📱</div>
        <h1 className={styles.title}>モバイル版は現在準備中です</h1>
        <p className={styles.description}>
          モバイルブラウザからのご利用は現在対応しておりません。<br />
          より快適にご利用いただくため、<br />
          <strong>タブレットまたはPCからのアクセス</strong>をお願いいたします。
        </p>
        <div className={styles.notice}>
          <p>モバイル版は順次対応予定です。</p>
          <p>ご不便をおかけしますが、今しばらくお待ちください。</p>
        </div>
      </div>
    </div>
  );
};
