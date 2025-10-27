import React from 'react';
import { Card, MetricCard, Loader } from '../common';
import { useMetricsStore } from '../../stores/metricsStore';
import { useSecurityStore } from '../../stores/securityStore';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import styles from './Dashboard.module.css';

export const Dashboard: React.FC = () => {
  const { systemMetrics, twitchRateLimit, youtubeQuota, metricsHistory } = useMetricsStore();
  const { securityMetrics } = useSecurityStore();

  if (!systemMetrics) {
    return <Loader text="データを読み込んでいます..." />;
  }

  const getAPIStatus = (usagePercent: number) => {
    if (usagePercent >= 90) return 'critical';
    if (usagePercent >= 70) return 'warning';
    return 'normal';
  };

  // グラフ用のデータを準備（時刻フォーマット）
  const chartData = metricsHistory.map(point => ({
    ...point,
    time: new Date(point.timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }));

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.pageTitle}>ダッシュボード</h1>

      {/* システムメトリクス */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>システム状態</h2>
        <div className={styles.metricsGrid}>
          <MetricCard
            icon="💻"
            label="CPU使用率"
            value={systemMetrics.cpu.toFixed(2)}
            unit="%"
            status={systemMetrics.cpu > 80 ? 'warning' : 'normal'}
          />
          <MetricCard
            icon="🧠"
            label="メモリ使用量"
            value={systemMetrics.memory.toFixed(0)}
            unit="MB"
            status={systemMetrics.memory > 500 ? 'warning' : 'normal'}
          />
          <MetricCard
            icon="⏱️"
            label="稼働時間"
            value={Math.floor(systemMetrics.uptime / 3600)}
            unit="時間"
            status="normal"
          />
          <MetricCard
            icon="🔌"
            label="WebSocket接続"
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

      {/* API状態 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>API状態</h2>
        <div className={styles.apiGrid}>
          {twitchRateLimit && (
            <Card title="Twitch API">
              <div className={styles.apiInfo}>
                <MetricCard
                  icon="📊"
                  label="残りリクエスト"
                  value={twitchRateLimit.remaining}
                  unit={`/ ${twitchRateLimit.limit}`}
                  status={getAPIStatus(twitchRateLimit.usagePercent)}
                />
                <div className={styles.apiDetail}>
                  <p>使用率: {twitchRateLimit.usagePercent.toFixed(1)}%</p>
                  <p>
                    リセット時刻:{' '}
                    {new Date(twitchRateLimit.resetAt).toLocaleTimeString('ja-JP')}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {youtubeQuota && (
            <Card title="YouTube API">
              <div className={styles.apiInfo}>
                <MetricCard
                  icon="📊"
                  label="残りクォータ"
                  value={youtubeQuota.remaining.toLocaleString()}
                  unit={`/ ${youtubeQuota.limit.toLocaleString()}`}
                  status={getAPIStatus(youtubeQuota.usagePercent)}
                />
                <div className={styles.apiDetail}>
                  <p>使用率: {youtubeQuota.usagePercent.toFixed(1)}%</p>
                  <p>
                    リセット時刻:{' '}
                    {new Date(youtubeQuota.resetAt).toLocaleTimeString('ja-JP')}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* リアルタイムグラフ */}
      {chartData.length > 0 && (
        <>
          {/* CPU/メモリ使用率グラフ */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>CPU・メモリ使用率（リアルタイム）</h2>
            <Card>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    name="CPU使用率 (%)"
                    stroke="#3498DB"
                    fill="#3498DB"
                    fillOpacity={0.6}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    name="メモリ使用量 (MB)"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </section>

          {/* WebSocket接続数と配信同期数グラフ */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>接続状況（リアルタイム）</h2>
            <div className={styles.chartsGrid}>
              <Card title="WebSocket接続数">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="wsConnections"
                      name="接続数"
                      stroke="#3498DB"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card title="配信同期数">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="streamSyncCount"
                      name="同期数"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </section>

          {/* API使用率グラフ */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>API使用率（リアルタイム）</h2>
            <Card>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    domain={[0, 100]}
                    label={{ value: '使用率 (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="twitchUsagePercent"
                    name="Twitch API"
                    stroke="#9146FF"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="youtubeUsagePercent"
                    name="YouTube API"
                    stroke="#FF0000"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </section>
        </>
      )}

      {/* セキュリティ概要 */}
      {securityMetrics && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>セキュリティ概要</h2>
          <div className={styles.securityGrid}>
            <MetricCard
              icon="🚫"
              label="ブロック中のIP"
              value={securityMetrics.blockedIPs}
              unit="件"
              status={securityMetrics.blockedIPs > 0 ? 'warning' : 'normal'}
            />
            <MetricCard
              icon="⚠️"
              label="疑わしいIP"
              value={securityMetrics.suspiciousIPs}
              unit="件"
              status={securityMetrics.suspiciousIPs > 5 ? 'warning' : 'normal'}
            />
            <MetricCard
              icon="✅"
              label="ホワイトリストIP"
              value={securityMetrics.whitelistIPs}
              unit="件"
              status="normal"
            />
          </div>
        </section>
      )}
    </div>
  );
};
