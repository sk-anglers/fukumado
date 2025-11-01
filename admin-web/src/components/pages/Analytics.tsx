import React, { useEffect, useState } from 'react';
import { Card, MetricCard, Loader } from '../common';
import { getAnalyticsStats, exportAnalyticsStats } from '../../services/apiClient';
import type { AnalyticsStats } from '../../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import styles from './Analytics.module.css';

export const Analytics: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [days, setDays] = useState(30);

  // アナリティクス統計データを取得
  useEffect(() => {
    const fetchAnalyticsStats = async (isInitialLoad = false) => {
      try {
        // 初回読み込み時のみローディング表示
        if (isInitialLoad) {
          setLoading(true);
        }
        const data = await getAnalyticsStats(days);
        if (data) {
          setStats(data);
        }
      } catch (error) {
        console.error('[Analytics] Failed to fetch analytics stats:', error);
      } finally {
        if (isInitialLoad) {
          setLoading(false);
        }
      }
    };

    // 初回実行
    fetchAnalyticsStats(true);

    // 60秒ごとにバックグラウンド更新
    const interval = setInterval(() => fetchAnalyticsStats(false), 60000);

    return () => {
      clearInterval(interval);
    };
  }, [days]);

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      await exportAnalyticsStats(format, days);
    } catch (error) {
      console.error('Export failed:', error);
      alert('エクスポートに失敗しました');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !stats) {
    return <Loader text="アナリティクス統計を読み込んでいます..." />;
  }

  if (!stats) {
    return (
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>アナリティクス</h1>
        <Card>
          <p>データがありません。しばらくお待ちください。</p>
        </Card>
      </div>
    );
  }

  // カラーパレット
  const COLORS = ['#3498DB', '#2ECC71', '#F39C12', '#E74C3C', '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'];

  // レイアウト分割数データの整形
  const slotsData = Object.entries(stats.layout.slotsDistribution || {})
    .map(([slots, count]) => ({ name: `${slots}分割`, count }))
    .sort((a, b) => parseInt(a.name) - parseInt(b.name));

  // プリセットデータの整形
  const presetLabels: Record<string, string> = {
    twoByTwo: '2x2グリッド',
    oneByTwo: '1+2レイアウト',
    focus: 'フォーカス'
  };
  const presetData = Object.entries(stats.layout.presetDistribution || {})
    .map(([preset, count]) => ({ name: presetLabels[preset] || preset, count }));

  // デバイス分布データの整形
  const deviceLabels: Record<string, string> = {
    mobile: 'モバイル',
    tablet: 'タブレット',
    desktop: 'デスクトップ'
  };
  const deviceData = Object.entries(stats.device.distribution || {})
    .map(([device, count]) => ({ name: deviceLabels[device] || device, count }));

  // ボタンクリック上位10件
  const buttonData = Object.entries(stats.buttons.clicks || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([button, count]) => ({ name: button, count }));

  // 機能使用統計
  const featureData = Object.entries(stats.features.usage || {})
    .map(([feature, count]) => ({ name: feature, count }));

  // 配信操作統計
  const streamActionData = Object.entries(stats.streams.actions || {})
    .map(([action, count]) => ({ name: action, count }));

  // 平均セッション時間（ミリ秒→分）
  const avgSessionMinutes = (stats.sessions.averageDuration / 1000 / 60).toFixed(1);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>アナリティクス</h1>
        <div className={styles.controls}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className={styles.select}
          >
            <option value={7}>過去7日間</option>
            <option value={30}>過去30日間</option>
            <option value={90}>過去90日間</option>
          </select>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className={styles.exportButton}
          >
            CSV出力
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className={styles.exportButton}
          >
            JSON出力
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>サマリー</h2>
        <div className={styles.metricsGrid}>
          <MetricCard
            icon="📊"
            label="総イベント数"
            value={stats.total.events.toLocaleString()}
            unit="イベント"
            status="normal"
          />
          <MetricCard
            icon="🔄"
            label="総セッション数"
            value={stats.total.sessions.toLocaleString()}
            unit="セッション"
            status="normal"
          />
          <MetricCard
            icon="👥"
            label="ユニークユーザー"
            value={stats.total.uniqueUsers.toLocaleString()}
            unit="人"
            status="normal"
          />
          <MetricCard
            icon="⏱️"
            label="平均セッション時間"
            value={avgSessionMinutes}
            unit="分"
            status="normal"
          />
        </div>
      </section>

      {/* レイアウト統計 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>レイアウト使用状況</h2>
        <div className={styles.chartsGrid}>
          <Card>
            <h3 className={styles.chartTitle}>画面分割数</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={slotsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3498DB" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 className={styles.chartTitle}>プリセット使用率</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={presetData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {presetData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </section>

      {/* デバイス統計 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>デバイス分布</h2>
        <Card>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={deviceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {deviceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* ボタンクリック統計 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ボタンクリック統計（上位10件）</h2>
        <Card>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={buttonData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="#2ECC71" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* 機能使用統計 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>機能使用統計</h2>
        <Card>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={featureData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#F39C12" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* 配信操作統計 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>配信操作統計</h2>
        <Card>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={streamActionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#9B59B6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* 時系列グラフ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>日次推移</h2>
        <Card>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={stats.timeline.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="events"
                stroke="#3498DB"
                name="イベント数"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sessions"
                stroke="#2ECC71"
                name="セッション数"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="uniqueUsers"
                stroke="#E74C3C"
                name="ユニークユーザー"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </section>
    </div>
  );
};
