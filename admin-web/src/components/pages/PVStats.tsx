import React, { useEffect, useState } from 'react';
import { Card, MetricCard, Loader } from '../common';
import { usePVStore } from '../../stores/pvStore';
import { getPVStats, exportPVStats } from '../../services/apiClient';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import styles from './PVStats.module.css';

export const PVStats: React.FC = () => {
  const pvStats = usePVStore(state => state.pvStats);
  const loading = usePVStore(state => state.loading);
  const setPVStats = usePVStore(state => state.setPVStats);
  const setLoading = usePVStore(state => state.setLoading);
  const [exportingPV, setExportingPV] = useState(false);

  // PV統計データを取得
  useEffect(() => {
    const fetchPVStats = async () => {
      try {
        setLoading(true);
        const stats = await getPVStats();
        if (stats) {
          setPVStats(stats);
        }
      } catch (error) {
        console.error('[PVStats] Failed to fetch PV stats:', error);
      } finally {
        setLoading(false);
      }
    };

    // 初回実行
    fetchPVStats();

    // 30秒ごとに更新
    const interval = setInterval(fetchPVStats, 30000);

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (format: 'json' | 'csv') => {
    setExportingPV(true);
    try {
      await exportPVStats(format);
    } catch (error) {
      console.error('Export failed:', error);
      alert('エクスポートに失敗しました');
    } finally {
      setExportingPV(false);
    }
  };

  if (loading && !pvStats) {
    return <Loader text="PV統計を読み込んでいます..." />;
  }

  if (!pvStats) {
    return (
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>PV統計（広告掲載用）</h1>
        <Card>
          <p>データがありません。しばらくお待ちください。</p>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>PV統計（広告掲載用）</h1>

      {/* サマリーカード */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>サマリー</h2>
        <div className={styles.metricsGrid}>
          <MetricCard
            icon="📊"
            label="今日のPV"
            value={pvStats.today.pv.toLocaleString()}
            unit="PV"
            status="normal"
          />
          <MetricCard
            icon="👥"
            label="今日のユニーク"
            value={pvStats.today.uniqueUsers.toLocaleString()}
            unit="人"
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
            icon="🎯"
            label="今月のユニーク"
            value={pvStats.month.uniqueUsers.toLocaleString()}
            unit="人"
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
      </section>

      {/* エクスポートボタン */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>データエクスポート</h2>
        <div className={styles.exportButtons}>
          <button
            onClick={() => handleExport('csv')}
            disabled={exportingPV}
            className={styles.exportButton}
          >
            {exportingPV ? 'エクスポート中...' : '📄 CSV エクスポート'}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exportingPV}
            className={styles.exportButton}
          >
            {exportingPV ? 'エクスポート中...' : '📋 JSON エクスポート'}
          </button>
        </div>
        <p className={styles.hint}>
          ※ 広告主への報告用にCSV形式でダウンロードできます
        </p>
      </section>

      {/* 過去30日のPV推移グラフ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>過去30日のPV推移</h2>
        <Card>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={pvStats.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                interval={4}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="pv"
                name="ページビュー"
                stroke="#3498DB"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="uniqueUsers"
                name="ユニークユーザー"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* 日次詳細（棒グラフ） */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>日次詳細</h2>
        <Card>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={pvStats.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                interval={4}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="pv" name="PV" fill="#3498DB" />
              <Bar dataKey="uniqueUsers" name="ユニーク" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* 過去12ヶ月の推移 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>過去12ヶ月の推移</h2>
        <Card>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={pvStats.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="pv" name="PV" fill="#3498DB" />
              <Bar dataKey="uniqueUsers" name="ユニーク" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* データ更新情報 */}
      <section className={styles.section}>
        <Card>
          <p className={styles.updateInfo}>
            最終更新: {new Date(pvStats.timestamp).toLocaleString('ja-JP')}
          </p>
          <p className={styles.hint}>
            ※ PV統計は30秒ごとに自動更新されます<br />
            ※ ボット・クローラーは自動で除外されます
          </p>
        </Card>
      </section>
    </div>
  );
};
