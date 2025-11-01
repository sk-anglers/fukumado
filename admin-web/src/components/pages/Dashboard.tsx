import React, { useEffect, useMemo, useState } from 'react';
import { Card, MetricCard, Loader } from '../common';
import { useMetricsStore } from '../../stores/metricsStore';
import { useSecurityStore } from '../../stores/securityStore';
import { usePVStore } from '../../stores/pvStore';
import { getApiStats, getPVStats, exportPVStats } from '../../services/apiClient';
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
  console.log('[DEBUG] Dashboard: Rendering START');

  // 値だけ取得（表示用）
  const systemMetrics = useMetricsStore(state => state.systemMetrics);
  const twitchRateLimit = useMetricsStore(state => state.twitchRateLimit);
  const youtubeQuota = useMetricsStore(state => state.youtubeQuota);
  const metricsHistory = useMetricsStore(state => state.metricsHistory);
  const apiStatsHistory = useMetricsStore(state => state.apiStatsHistory);
  const securityMetrics = useSecurityStore(state => state.securityMetrics);
  const pvStats = usePVStore(state => state.pvStats);
  const pvLoading = usePVStore(state => state.loading);

  // setter関数だけ取得（useEffectで使用）
  const setApiStats = useMetricsStore(state => state.setApiStats);
  const setPVStats = usePVStore(state => state.setPVStats);
  const setPVLoading = usePVStore(state => state.setLoading);
  const [exportingPV, setExportingPV] = useState(false);

  // API統計データを定期的に取得 - useEffectは条件分岐の前に配置
  useEffect(() => {
    console.log('[DEBUG] Dashboard: API stats useEffect RUNNING');
    const fetchApiStats = async () => {
      try {
        const statsData = await getApiStats();
        if (statsData) {
          setApiStats({
            totalCalls: statsData.totalCalls || 0,
            successfulCalls: statsData.successfulCalls || 0,
            failedCalls: statsData.failedCalls || 0,
            averageResponseTime: statsData.averageResponseTime || 0
          });
        }
      } catch (error) {
        console.error('[Dashboard] Failed to fetch API stats:', error);
      }
    };

    // 初回実行
    fetchApiStats();

    // 5秒ごとに更新
    const interval = setInterval(fetchApiStats, 5000);

    return () => {
      console.log('[DEBUG] Dashboard: API stats useEffect CLEANUP');
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PV統計データを定期的に取得
  useEffect(() => {
    console.log('[DEBUG] Dashboard: PV stats useEffect RUNNING');
    const fetchPVStats = async (isInitialLoad = false) => {
      try {
        // 初回読み込み時のみローディング表示
        if (isInitialLoad) {
          setPVLoading(true);
        }
        const stats = await getPVStats();
        if (stats) {
          setPVStats(stats);
        }
      } catch (error) {
        console.error('[Dashboard] Failed to fetch PV stats:', error);
      } finally {
        if (isInitialLoad) {
          setPVLoading(false);
        }
      }
    };

    // 初回実行
    fetchPVStats(true);

    // 30秒ごとにバックグラウンド更新
    const interval = setInterval(() => fetchPVStats(false), 30000);

    return () => {
      console.log('[DEBUG] Dashboard: PV stats useEffect CLEANUP');
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // グラフ用のデータを準備（時刻フォーマット） - useMemoも条件分岐の前に配置
  const chartData = useMemo(() => {
    console.log('[DEBUG] Dashboard: Calculating chartData, metricsHistory =', metricsHistory);
    return metricsHistory.map((point, index) => {
      console.log(`[DEBUG] Dashboard: Processing point ${index}:`, point);
      return {
        ...point,
        time: new Date(point.timestamp).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      };
    });
  }, [metricsHistory]);

  // API統計グラフ用のデータを準備 - useMemoも条件分岐の前に配置
  const apiStatsChartData = useMemo(() => {
    console.log('[DEBUG] Dashboard: Calculating apiStatsChartData');
    return apiStatsHistory.map(point => ({
      ...point,
      time: new Date(point.timestamp).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }));
  }, [apiStatsHistory]);

  console.log('[DEBUG] Dashboard: systemMetrics =', systemMetrics ? 'exists' : 'null');

  if (!systemMetrics) {
    console.log('[DEBUG] Dashboard: Showing Loader (systemMetrics is null)');
    return <Loader text="データを読み込んでいます..." />;
  }

  console.log('[DEBUG] Dashboard: Rendering main content');
  console.log('[DEBUG] Dashboard: metricsHistory length =', metricsHistory.length);
  console.log('[DEBUG] Dashboard: metricsHistory data =', JSON.stringify(metricsHistory));
  console.log('[DEBUG] Dashboard: apiStatsHistory length =', apiStatsHistory.length);
  console.log('[DEBUG] Dashboard: apiStatsHistory data =', JSON.stringify(apiStatsHistory));

  const getAPIStatus = (usagePercent: number) => {
    if (usagePercent >= 90) return 'critical';
    if (usagePercent >= 70) return 'warning';
    return 'normal';
  };

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
            label="WebSocket接続（総）"
            value={systemMetrics.wsConnections}
            unit="件"
            status="normal"
          />
          {systemMetrics.activeWsConnections !== undefined && (
            <MetricCard
              icon="✅"
              label="WebSocket接続（アクティブ）"
              value={systemMetrics.activeWsConnections}
              unit="件"
              status="normal"
            />
          )}
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
                      name="総接続数"
                      stroke="#3498DB"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="activeWsConnections"
                      name="アクティブ接続数"
                      stroke="#10b981"
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

          {/* API呼び出し統計グラフ */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>API呼び出し統計（リアルタイム）</h2>
            <Card>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={apiStatsChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{ value: '呼び出し数', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalCalls"
                    name="総呼び出し"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="successfulCalls"
                    name="成功"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="failedCalls"
                    name="失敗"
                    stroke="#EF4444"
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

      {/* PV統計（サマリー） */}
      <section className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>PV統計（広告掲載用）</h2>
          <a
            href="/pv-stats"
            style={{
              padding: '8px 16px',
              backgroundColor: '#3498DB',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📈 詳細を見る
          </a>
        </div>
        {pvLoading && !pvStats && <Loader text="PV統計を読み込んでいます..." />}
        {pvStats && (
          <div className={styles.metricsGrid}>
            <MetricCard
              icon="📊"
              label="今日のPV"
              value={pvStats.today.pv.toLocaleString()}
              unit="PV"
              status="normal"
            />
            <MetricCard
              icon="📈"
              label="今月のPV"
              value={pvStats.month.pv.toLocaleString()}
              unit="PV"
              status="normal"
            />
            <MetricCard
              icon="🏆"
              label="累計PV"
              value={pvStats.total.toLocaleString()}
              unit="PV"
              status="normal"
            />
          </div>
        )}
        {!pvLoading && !pvStats && (
          <Card>
            <p style={{ textAlign: 'center', color: '#605e5c', margin: '20px 0' }}>
              PVデータがまだありません。しばらくお待ちください。
            </p>
          </Card>
        )}
      </section>
    </div>
  );
};
