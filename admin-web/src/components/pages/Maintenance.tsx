import React, { useState, useEffect } from 'react';
import { Card, Button, Loader } from '../common';
import {
  getMaintenanceStatus,
  enableMaintenance as apiEnableMaintenance,
  disableMaintenance as apiDisableMaintenance
} from '../../services/apiClient';
import { MaintenanceStatus as MaintenanceStatusType } from '../../types';
import styles from './Maintenance.module.css';

export const Maintenance: React.FC = () => {
  const [status, setStatus] = useState<MaintenanceStatusType | null>(null);
  const [message, setMessage] = useState('');
  const [generateBypass, setGenerateBypass] = useState(false);
  const [duration, setDuration] = useState<number>(0); // 0=無期限
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      const data = await getMaintenanceStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load maintenance status:', error);
      alert('メンテナンス状態の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!message.trim()) {
      alert('メンテナンスメッセージを入力してください');
      return;
    }

    if (!confirm('メンテナンスモードを有効にしますか？\nユーザーはアプリケーションを使用できなくなります。')) {
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiEnableMaintenance(message.trim(), generateBypass, duration);
      setStatus(data);
      setMessage('');
      setGenerateBypass(false);
      setDuration(0);
      alert('メンテナンスモードを有効にしました');
    } catch (error) {
      console.error('Failed to enable maintenance:', error);
      alert('メンテナンスモードの有効化に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm('メンテナンスモードを無効にしますか？')) {
      return;
    }

    try {
      setIsSubmitting(true);
      await apiDisableMaintenance();
      setStatus({ enabled: false });
      alert('メンテナンスモードを無効にしました');
    } catch (error) {
      console.error('Failed to disable maintenance:', error);
      alert('メンテナンスモードの無効化に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <Loader text="メンテナンス状態を読み込んでいます..." />;
  }

  if (!status) {
    return (
      <div className={styles.error}>
        <p>メンテナンス状態の取得に失敗しました</p>
        <Button onClick={loadStatus}>再読み込み</Button>
      </div>
    );
  }

  return (
    <div className={styles.maintenance}>
      <h1 className={styles.pageTitle}>メンテナンスモード管理</h1>

      {/* 現在の状態 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>現在の状態</h2>
        <Card>
          <div className={styles.statusContainer}>
            <div className={styles.statusBadge}>
              <span
                className={`${styles.indicator} ${
                  status.enabled ? styles.enabled : styles.disabled
                }`}
              ></span>
              <span className={styles.statusText}>
                {status.enabled ? 'メンテナンス中' : '通常運用中'}
              </span>
            </div>

            {status.enabled && status.message && (
              <div className={styles.currentMessage}>
                <h4>メッセージ:</h4>
                <p>{status.message}</p>
              </div>
            )}

            {status.enabled && status.enabledAt && (
              <div className={styles.timestamp}>
                <span className={styles.label}>有効化日時:</span>
                <span className={styles.value}>
                  {new Date(status.enabledAt).toLocaleString('ja-JP')}
                </span>
              </div>
            )}

            {status.enabled && (
              <div className={styles.timestamp}>
                <span className={styles.label}>メンテナンス時間:</span>
                <span className={styles.value}>
                  {status.duration === 0 ? '無期限' : `${status.duration}分`}
                </span>
              </div>
            )}

            {status.enabled && status.scheduledEndAt && (
              <div className={styles.timestamp}>
                <span className={styles.label}>終了予定:</span>
                <span className={styles.value}>
                  {new Date(status.scheduledEndAt).toLocaleString('ja-JP')}
                </span>
              </div>
            )}

            {status.bypassToken && status.expiresAt && (
              <div className={styles.bypassInfo}>
                <h4>バイパストークン:</h4>
                <div className={styles.tokenContainer}>
                  <code className={styles.token}>{status.bypassToken}</code>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(status.bypassToken!);
                      alert('トークンをクリップボードにコピーしました');
                    }}
                  >
                    コピー
                  </Button>
                </div>
                <p className={styles.expiryNote}>
                  有効期限: {new Date(status.expiresAt).toLocaleString('ja-JP')}
                </p>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* 操作 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>操作</h2>

        {status.enabled ? (
          <Card title="メンテナンスモード無効化">
            <p className={styles.description}>
              メンテナンスモードを無効にすると、ユーザーは通常通りアプリケーションを利用できるようになります。
            </p>
            <Button
              variant="primary"
              onClick={handleDisable}
              disabled={isSubmitting}
            >
              {isSubmitting ? '無効化中...' : 'メンテナンスモードを無効にする'}
            </Button>
          </Card>
        ) : (
          <Card title="メンテナンスモード有効化">
            <p className={styles.description}>
              メンテナンスモードを有効にすると、ユーザーはアプリケーションを利用できなくなります。
              メンテナンスメッセージが表示されます。
            </p>
            <div className={styles.enableForm}>
              <div className={styles.formGroup}>
                <label htmlFor="message" className={styles.formLabel}>
                  メンテナンスメッセージ *
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={styles.textarea}
                  rows={4}
                  placeholder="メンテナンス中です。しばらくお待ちください。"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="duration" className={styles.formLabel}>
                  メンテナンス時間
                </label>
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className={styles.select}
                >
                  <option value={0}>無期限</option>
                  <option value={30}>30分</option>
                  <option value={60}>1時間</option>
                  <option value={120}>2時間</option>
                  <option value={240}>4時間</option>
                </select>
              </div>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={generateBypass}
                  onChange={(e) => setGenerateBypass(e.target.checked)}
                />
                <span>バイパストークンを生成（管理者用アクセス）</span>
              </label>

              <Button
                variant="danger"
                onClick={handleEnable}
                disabled={isSubmitting || !message.trim()}
              >
                {isSubmitting ? '有効化中...' : 'メンテナンスモードを有効にする'}
              </Button>
            </div>
          </Card>
        )}
      </section>

      {/* 説明 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>メンテナンスモードについて</h2>
        <Card>
          <div className={styles.info}>
            <h4>メンテナンスモードとは</h4>
            <p>
              メンテナンスモードを有効にすると、ユーザーはアプリケーションにアクセスできなくなり、
              指定したメンテナンスメッセージが表示されます。
            </p>

            <h4>バイパストークン</h4>
            <p>
              バイパストークンを生成すると、管理者はメンテナンス中でもアプリケーションにアクセスできます。
              トークンをURLパラメータに付与することで、メンテナンスモードを回避できます。
            </p>
            <p className={styles.example}>
              例: https://example.com/?bypass={"<token>"}
            </p>

            <h4>注意事項</h4>
            <ul className={styles.notesList}>
              <li>メンテナンスモード中は全ユーザーがアプリケーションを利用できなくなります</li>
              <li>バイパストークンは1時間で期限切れになります</li>
              <li>トークンは第三者に漏らさないよう注意してください</li>
            </ul>
          </div>
        </Card>
      </section>
    </div>
  );
};
