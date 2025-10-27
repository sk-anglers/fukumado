import React from 'react';
import { Card, MetricCard, Loader } from '../common';
import { useMetricsStore } from '../../stores/metricsStore';
import styles from './System.module.css';

export const System: React.FC = () => {
  const { systemMetrics, twitchRateLimit, youtubeQuota, lastUpdate } =
    useMetricsStore();

  if (!systemMetrics) {
    return <Loader text="システムメトリクスを読み込んでいます..." />;
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}時間 ${minutes}分 ${secs}秒`;
  };

  return (
    <div className={styles.system}>
      <h1 className={styles.pageTitle}>システムモニタリング</h1>

      {lastUpdate && (
        <p className={styles.lastUpdate}>
          最終更新: {new Date(lastUpdate).toLocaleString('ja-JP')}
        </p>
      )}

      {/* システムリソース */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>システムリソース</h2>
        <div className={styles.metricsGrid}>
          <MetricCard
            icon="💻"
            label="CPU使用率"
            value={systemMetrics.cpu.toFixed(2)}
            unit="%"
            status={systemMetrics.cpu > 80 ? 'critical' : systemMetrics.cpu > 60 ? 'warning' : 'normal'}
          />
          <MetricCard
            icon="🧠"
            label="メモリ使用量"
            value={systemMetrics.memory.toFixed(0)}
            unit="MB"
            status={systemMetrics.memory > 700 ? 'critical' : systemMetrics.memory > 500 ? 'warning' : 'normal'}
          />
        </div>

        <Card title="詳細情報" className={styles.detailCard}>
          <div className={styles.detailGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>稼働時間</span>
              <span className={styles.detailValue}>
                {formatUptime(systemMetrics.uptime)}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>データ取得時刻</span>
              <span className={styles.detailValue}>
                {new Date(systemMetrics.timestamp).toLocaleString('ja-JP')}
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* 接続状態 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>接続状態</h2>
        <div className={styles.metricsGrid}>
          <MetricCard
            icon="🔌"
            label="WebSocket接続数"
            value={systemMetrics.wsConnections}
            unit="件"
            status="normal"
          />
          <MetricCard
            icon="📺"
            label="配信同期数"
            value={systemMetrics.streamSyncCount}
            unit="件"
            status="normal"
          />
        </div>
      </section>

      {/* 外部API状態 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>外部API状態</h2>

        {twitchRateLimit && (
          <Card title="Twitch API レート制限" className={styles.apiCard}>
            <div className={styles.apiContent}>
              <div className={styles.apiMetrics}>
                <div className={styles.apiMetricItem}>
                  <span className={styles.apiLabel}>残りリクエスト数</span>
                  <span className={styles.apiValue}>
                    {twitchRateLimit.remaining} / {twitchRateLimit.limit}
                  </span>
                </div>
                <div className={styles.apiMetricItem}>
                  <span className={styles.apiLabel}>使用率</span>
                  <span
                    className={`${styles.apiValue} ${
                      twitchRateLimit.usagePercent > 90
                        ? styles.critical
                        : twitchRateLimit.usagePercent > 70
                        ? styles.warning
                        : ''
                    }`}
                  >
                    {twitchRateLimit.usagePercent.toFixed(1)}%
                  </span>
                </div>
                <div className={styles.apiMetricItem}>
                  <span className={styles.apiLabel}>リセット時刻</span>
                  <span className={styles.apiValue}>
                    {new Date(twitchRateLimit.resetAt).toLocaleString('ja-JP')}
                  </span>
                </div>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={`${styles.progressFill} ${
                    twitchRateLimit.usagePercent > 90
                      ? styles.criticalBar
                      : twitchRateLimit.usagePercent > 70
                      ? styles.warningBar
                      : styles.normalBar
                  }`}
                  style={{ width: `${twitchRateLimit.usagePercent}%` }}
                ></div>
              </div>
            </div>
          </Card>
        )}

        {youtubeQuota && (
          <Card title="YouTube API クォータ" className={styles.apiCard}>
            <div className={styles.apiContent}>
              <div className={styles.apiMetrics}>
                <div className={styles.apiMetricItem}>
                  <span className={styles.apiLabel}>使用済みクォータ</span>
                  <span className={styles.apiValue}>
                    {youtubeQuota.used.toLocaleString()}
                  </span>
                </div>
                <div className={styles.apiMetricItem}>
                  <span className={styles.apiLabel}>残りクォータ</span>
                  <span className={styles.apiValue}>
                    {youtubeQuota.remaining.toLocaleString()} /{' '}
                    {youtubeQuota.limit.toLocaleString()}
                  </span>
                </div>
                <div className={styles.apiMetricItem}>
                  <span className={styles.apiLabel}>使用率</span>
                  <span
                    className={`${styles.apiValue} ${
                      youtubeQuota.usagePercent > 90
                        ? styles.critical
                        : youtubeQuota.usagePercent > 70
                        ? styles.warning
                        : ''
                    }`}
                  >
                    {youtubeQuota.usagePercent.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={`${styles.progressFill} ${
                    youtubeQuota.usagePercent > 90
                      ? styles.criticalBar
                      : youtubeQuota.usagePercent > 70
                      ? styles.warningBar
                      : styles.normalBar
                  }`}
                  style={{ width: `${youtubeQuota.usagePercent}%` }}
                ></div>
              </div>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
};
