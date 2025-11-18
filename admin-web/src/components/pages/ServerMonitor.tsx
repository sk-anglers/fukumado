import React, { useEffect, useState } from 'react';
import { Card, MetricCard, Loader } from '../common';
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
import styles from './ServerMonitor.module.css';

// 型定義
interface SystemMetrics {
  cpu: {
    usage: number;
    count: number;
    loadAverage: {
      oneMinute: number;
      fiveMinutes: number;
      fifteenMinutes: number;
    };
  };
  memory: {
    totalMB: number;
    freeMB: number;
    usedMB: number;
    usagePercent: number;
    processUsedMB: number;
    processUsagePercent: number;
  };
  uptime: {
    systemSeconds: number;
    processSeconds: number;
  };
}

interface DatabaseStats {
  connections: {
    active: number;
    idle: number;
    total: number;
    maxConnections: number;
  };
  transactions: {
    committed: number;
    rolledBack: number;
  };
  cache: {
    hitRate: number;
    blocksHit: number;
    blocksRead: number;
  };
  size: {
    totalMB: number;
  };
  diskOperations: {
    blocksRead: number;
    blocksWritten: number;
    tuplesReturned: number;
    tuplesFetched: number;
    tuplesInserted: number;
    tuplesUpdated: number;
    tuplesDeleted: number;
  };
}

interface TableStats {
  schemaName: string;
  tableName: string;
  rowCount: number;
  tableSizeMB: number;
  indexSizeMB: number;
  totalSizeMB: number;
  sequentialScans: number;
  indexScans: number;
  tuples: {
    inserted: number;
    updated: number;
    deleted: number;
  };
}

interface ActiveQuery {
  pid: number;
  user: string;
  database: string;
  state: string;
  query: string;
  duration: number;
  waitEvent: string | null;
}

const API_BASE_URL = import.meta.env.VITE_ADMIN_API_URL || '';

// API クライアント
const fetchSystemMetrics = async (): Promise<SystemMetrics | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/api/metrics/system/detailed-metrics`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch system metrics');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    return null;
  }
};

const fetchDatabaseStats = async (): Promise<DatabaseStats | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/api/metrics/database/stats`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch database stats');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching database stats:', error);
    return null;
  }
};

const fetchTableStats = async (): Promise<TableStats[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/api/metrics/database/tables`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch table stats');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching table stats:', error);
    return [];
  }
};

const fetchActiveQueries = async (): Promise<ActiveQuery[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/api/metrics/database/queries`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch active queries');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching active queries:', error);
    return [];
  }
};

export const ServerMonitor: React.FC = () => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [activeQueries, setActiveQueries] = useState<ActiveQuery[]>([]);
  const [loading, setLoading] = useState(true);

  // メトリクスを取得
  useEffect(() => {
    const fetchData = async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) {
          setLoading(true);
        }

        const [system, db, tables, queries] = await Promise.all([
          fetchSystemMetrics(),
          fetchDatabaseStats(),
          fetchTableStats(),
          fetchActiveQueries()
        ]);

        if (system) setSystemMetrics(system);
        if (db) setDbStats(db);
        setTableStats(tables);
        setActiveQueries(queries);
      } catch (error) {
        console.error('[ServerMonitor] Failed to fetch metrics:', error);
      } finally {
        if (isInitialLoad) {
          setLoading(false);
        }
      }
    };

    // 初回実行
    fetchData(true);

    // 30秒ごとに更新
    const interval = setInterval(() => fetchData(false), 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  if (loading && !systemMetrics && !dbStats) {
    return <Loader text="サーバ監視データを読み込んでいます..." />;
  }

  // アップタイムをフォーマット
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}日 ${hours}時間 ${minutes}分`;
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>サーバ監視</h1>

      {/* システムメトリクス */}
      {systemMetrics && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>システムメトリクス</h2>
          <div className={styles.metricsGrid}>
            <MetricCard
              label="CPU使用率"
              value={`${systemMetrics.cpu.usage.toFixed(1)}%`}
            />
            <MetricCard
              label="メモリ使用率"
              value={`${systemMetrics.memory.usagePercent.toFixed(1)}%`}
            />
            <MetricCard
              label="プロセスメモリ"
              value={`${systemMetrics.memory.processUsedMB}`}
              unit="MB"
            />
            <MetricCard
              label="ロードアベレージ (1分)"
              value={systemMetrics.cpu.loadAverage.oneMinute.toFixed(2)}
            />
            <MetricCard
              label="システム稼働時間"
              value={formatUptime(systemMetrics.uptime.systemSeconds)}
            />
            <MetricCard
              label="プロセス稼働時間"
              value={formatUptime(systemMetrics.uptime.processSeconds)}
            />
          </div>
        </section>
      )}

      {/* データベース統計 */}
      {dbStats && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>データベース統計</h2>
          <div className={styles.metricsGrid}>
            <MetricCard
              label="アクティブ接続"
              value={dbStats.connections.active.toString()}
            />
            <MetricCard
              label="アイドル接続"
              value={dbStats.connections.idle.toString()}
            />
            <MetricCard
              label="キャッシュヒット率"
              value={`${dbStats.cache.hitRate.toFixed(2)}%`}
            />
            <MetricCard
              label="データベースサイズ"
              value={`${dbStats.size.totalMB}`}
              unit="MB"
            />
            <MetricCard
              label="コミット"
              value={dbStats.transactions.committed.toLocaleString()}
            />
            <MetricCard
              label="ロールバック"
              value={dbStats.transactions.rolledBack.toLocaleString()}
            />
          </div>

          {/* ディスク操作統計 */}
          <Card className={styles.card}>
            <h3 className={styles.chartTitle}>ディスク操作統計</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>ブロック読み取り:</span>
                <span className={styles.statValue}>{dbStats.diskOperations.blocksRead.toLocaleString()}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>タプル返却:</span>
                <span className={styles.statValue}>{dbStats.diskOperations.tuplesReturned.toLocaleString()}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>タプル取得:</span>
                <span className={styles.statValue}>{dbStats.diskOperations.tuplesFetched.toLocaleString()}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>タプル挿入:</span>
                <span className={styles.statValue}>{dbStats.diskOperations.tuplesInserted.toLocaleString()}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>タプル更新:</span>
                <span className={styles.statValue}>{dbStats.diskOperations.tuplesUpdated.toLocaleString()}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>タプル削除:</span>
                <span className={styles.statValue}>{dbStats.diskOperations.tuplesDeleted.toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* テーブル統計 */}
      {tableStats.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>テーブル統計</h2>
          <Card>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>テーブル名</th>
                    <th>テーブルサイズ</th>
                    <th>インデックスサイズ</th>
                    <th>合計サイズ</th>
                    <th>Seq Scans</th>
                    <th>Index Scans</th>
                    <th>挿入</th>
                    <th>更新</th>
                    <th>削除</th>
                  </tr>
                </thead>
                <tbody>
                  {tableStats.map((table, index) => (
                    <tr key={index}>
                      <td className={styles.tableName}>
                        {table.schemaName}.{table.tableName}
                      </td>
                      <td>{table.tableSizeMB.toFixed(2)} MB</td>
                      <td>{table.indexSizeMB.toFixed(2)} MB</td>
                      <td>{table.totalSizeMB.toFixed(2)} MB</td>
                      <td>{table.sequentialScans.toLocaleString()}</td>
                      <td>{table.indexScans.toLocaleString()}</td>
                      <td>{table.tuples.inserted.toLocaleString()}</td>
                      <td>{table.tuples.updated.toLocaleString()}</td>
                      <td>{table.tuples.deleted.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* アクティブクエリ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アクティブクエリ ({activeQueries.length})</h2>
        {activeQueries.length === 0 ? (
          <Card>
            <p>現在実行中のクエリはありません。</p>
          </Card>
        ) : (
          <Card>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>PID</th>
                    <th>ユーザー</th>
                    <th>状態</th>
                    <th>実行時間</th>
                    <th>クエリ</th>
                  </tr>
                </thead>
                <tbody>
                  {activeQueries.map((query, index) => (
                    <tr key={index}>
                      <td>{query.pid}</td>
                      <td>{query.user}</td>
                      <td>{query.state}</td>
                      <td>{query.duration}秒</td>
                      <td className={styles.queryText}>{query.query}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
};
