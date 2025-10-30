import React, { useEffect, useState } from 'react';
import { Card, MetricCard } from '../common';
import { useSecurityStore } from '../../stores/securityStore';
import {
  getMainServiceStats,
  getMainServiceHealth,
  getMainServiceAlerts,
  getMainServiceSessions,
  getMainServiceWebSocket,
  getMainServiceSummary
} from '../../services/apiClient';
import styles from './Security.module.css';

export const Security: React.FC = () => {
  // 値だけ取得（表示用）
  const securityMetrics = useSecurityStore(state => state.securityMetrics);
  const mainServiceStats = useSecurityStore(state => state.mainServiceStats);
  const mainServiceHealth = useSecurityStore(state => state.mainServiceHealth);
  const mainServiceAlerts = useSecurityStore(state => state.mainServiceAlerts);
  const mainServiceSessions = useSecurityStore(state => state.mainServiceSessions);
  const mainServiceSummary = useSecurityStore(state => state.mainServiceSummary);

  // setter関数だけ取得（useEffectで使用）
  const setMainServiceStats = useSecurityStore(state => state.setMainServiceStats);
  const setMainServiceHealth = useSecurityStore(state => state.setMainServiceHealth);
  const setMainServiceAlerts = useSecurityStore(state => state.setMainServiceAlerts);
  const setMainServiceSessions = useSecurityStore(state => state.setMainServiceSessions);
  const setMainServiceWebSocket = useSecurityStore(state => state.setMainServiceWebSocket);
  const setMainServiceSummary = useSecurityStore(state => state.setMainServiceSummary);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'main-service'>('dashboard');

  // 本サービスのセキュリティデータを取得
  useEffect(() => {
    const fetchMainServiceData = async () => {
      try {
        const [stats, health, alerts, sessions, websocket, summary] = await Promise.all([
          getMainServiceStats().catch(() => null),
          getMainServiceHealth().catch(() => null),
          getMainServiceAlerts(20).catch(() => null),
          getMainServiceSessions().catch(() => null),
          getMainServiceWebSocket().catch(() => null),
          getMainServiceSummary().catch(() => null)
        ]);

        if (stats) setMainServiceStats(stats);
        if (health) setMainServiceHealth(health);
        if (alerts) setMainServiceAlerts(alerts);
        if (sessions) setMainServiceSessions(sessions);
        if (websocket) setMainServiceWebSocket(websocket);
        if (summary) setMainServiceSummary(summary);
      } catch (error) {
        console.error('[Security] Failed to fetch main service data:', error);
      }
    };

    fetchMainServiceData();

    // 30秒ごとに更新
    const interval = setInterval(fetchMainServiceData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // データがない場合はデフォルト値を使用
  const metrics = securityMetrics || {
    totalUniqueIPs: 0,
    blockedIPs: 0,
    suspiciousIPs: 0,
    whitelistIPs: 0,
    recentAlerts: [],
    topIPs: []
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'critical':
      case 'error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  };

  return (
    <div className={styles.security}>
      <h1 className={styles.pageTitle}>セキュリティ管理</h1>

      {/* タブナビゲーション */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'dashboard' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          管理ダッシュボード
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'main-service' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('main-service')}
        >
          本サービス（ふくまど）
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* 概要メトリクス */}
          <section className={styles.section}>
        <h2 className={styles.sectionTitle}>概要</h2>
        <div className={styles.metricsGrid}>
          <MetricCard
            icon="👥"
            label="ユニークIP数"
            value={metrics.totalUniqueIPs}
            unit="件"
            status="normal"
          />
          <MetricCard
            icon="🚫"
            label="ブロック中のIP"
            value={metrics.blockedIPs}
            unit="件"
            status={metrics.blockedIPs > 0 ? 'warning' : 'normal'}
          />
          <MetricCard
            icon="⚠️"
            label="疑わしいIP"
            value={metrics.suspiciousIPs}
            unit="件"
            status={metrics.suspiciousIPs > 5 ? 'warning' : 'normal'}
          />
          <MetricCard
            icon="✅"
            label="ホワイトリストIP"
            value={metrics.whitelistIPs}
            unit="件"
            status="normal"
          />
        </div>
      </section>

      {/* アクセス統計 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アクセス上位IP</h2>
        <Card>
          {metrics.topIPs.length === 0 ? (
            <p className={styles.emptyMessage}>データがありません</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>IPアドレス</th>
                    <th>リクエスト数</th>
                    <th>疑わしさスコア</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topIPs.slice(0, 10).map((ipInfo) => (
                    <tr key={ipInfo.ip}>
                      <td className={styles.ipCell}>{ipInfo.ip}</td>
                      <td>{ipInfo.requestCount}</td>
                      <td>{ipInfo.suspicionScore}</td>
                      <td>
                        {ipInfo.blocked && <span className={styles.badge + ' ' + styles.permanent}>ブロック</span>}
                        {ipInfo.whitelisted && <span className={styles.badge}>ホワイトリスト</span>}
                        {!ipInfo.blocked && !ipInfo.whitelisted && <span>通常</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* 最近のアラート */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>最近のアラート</h2>
        <Card>
          {metrics.recentAlerts.length === 0 ? (
            <p className={styles.emptyMessage}>アラートはありません</p>
          ) : (
            <div className={styles.alertList}>
              {metrics.recentAlerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  className={`${styles.alertItem} ${styles[alert.type === 'error' ? 'critical' : alert.type]}`}
                >
                  <div className={styles.alertHeader}>
                    <span className={styles.alertLevel}>
                      {alert.type === 'error'
                        ? '🔴 エラー'
                        : alert.type === 'warning'
                        ? '🟡 警告'
                        : '🔵 情報'}
                    </span>
                    <span className={styles.alertTime}>
                      {new Date(alert.timestamp).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <p className={styles.alertMessage}>{alert.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
        </>
      )}

      {/* 本サービス（ふくまど）のセキュリティ統計 */}
      {activeTab === 'main-service' && (
        <>
          {/* ヘルスチェック */}
          {mainServiceHealth && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>セキュリティヘルスチェック</h2>
              <Card>
                <div className={styles.healthStatus}>
                  <div className={styles.healthOverall}>
                    <div
                      className={styles.healthIndicator}
                      style={{ backgroundColor: getHealthStatusColor(mainServiceHealth.status) }}
                    >
                      {mainServiceHealth.status === 'healthy' && '✓'}
                      {mainServiceHealth.status === 'warning' && '⚠'}
                      {mainServiceHealth.status === 'critical' && '⨯'}
                    </div>
                    <div>
                      <h3>全体ステータス: {mainServiceHealth.status.toUpperCase()}</h3>
                      <p className={styles.timestamp}>
                        {new Date(mainServiceHealth.timestamp).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  </div>

                  <div className={styles.healthChecks}>
                    <div className={styles.healthCheck}>
                      <span style={{ color: getHealthStatusColor(mainServiceHealth.checks.anomalyDetection.status) }}>
                        ● 異常検知
                      </span>
                      <span>重大: {mainServiceHealth.checks.anomalyDetection.criticalAlerts}, 高: {mainServiceHealth.checks.anomalyDetection.highAlerts}</span>
                    </div>
                    <div className={styles.healthCheck}>
                      <span style={{ color: getHealthStatusColor(mainServiceHealth.checks.websocket.status) }}>
                        ● WebSocket
                      </span>
                      <span>接続数: {mainServiceHealth.checks.websocket.totalConnections}</span>
                    </div>
                    <div className={styles.healthCheck}>
                      <span style={{ color: getHealthStatusColor(mainServiceHealth.checks.ipBlocklist.status) }}>
                        ● IPブロックリスト
                      </span>
                      <span>ブロック中: {mainServiceHealth.checks.ipBlocklist.blockedIPs}</span>
                    </div>
                    <div className={styles.healthCheck}>
                      <span style={{ color: getHealthStatusColor(mainServiceHealth.checks.system.status) }}>
                        ● システム
                      </span>
                      <span>稼働時間: {Math.floor(mainServiceHealth.checks.system.uptime / 60)}分</span>
                    </div>
                  </div>
                </div>
              </Card>
            </section>
          )}

          {/* 異常検知アラート */}
          {mainServiceAlerts && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>異常検知アラート</h2>
              <Card>
                {mainServiceAlerts.alerts.length === 0 ? (
                  <p className={styles.emptyMessage}>アラートはありません</p>
                ) : (
                  <div className={styles.alertList}>
                    {mainServiceAlerts.alerts.map((alert) => (
                      <div key={alert.id} className={styles.anomalyAlert}>
                        <div className={styles.alertHeader}>
                          <span className={styles.severity}>
                            {getSeverityIcon(alert.severity)} {alert.severity}
                          </span>
                          <span className={styles.alertType}>{alert.type}</span>
                          <span className={styles.alertTime}>
                            {new Date(alert.timestamp).toLocaleString('ja-JP')}
                          </span>
                        </div>
                        <p className={styles.alertMessage}>{alert.description}</p>
                        <div className={styles.alertMeta}>
                          <span>IP: {alert.ip}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>
          )}

          {/* 統計情報グリッド */}
          {mainServiceStats && (
            <>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>アクセス統計</h2>
                <div className={styles.metricsGrid}>
                  <MetricCard
                    icon="📊"
                    label="総リクエスト数"
                    value={mainServiceStats.accessLog.totalRequests}
                    unit="件"
                    status="normal"
                  />
                  <MetricCard
                    icon="👥"
                    label="ユニークIP数"
                    value={mainServiceStats.accessLog.uniqueIPs}
                    unit="件"
                    status="normal"
                  />
                  <MetricCard
                    icon="🚫"
                    label="ブロック中IP"
                    value={mainServiceStats.ipBlocklist.blockedCount}
                    unit="件"
                    status={mainServiceStats.ipBlocklist.blockedCount > 0 ? 'warning' : 'normal'}
                  />
                  <MetricCard
                    icon="⚠️"
                    label="違反記録"
                    value={mainServiceStats.ipBlocklist.violationCount}
                    unit="件"
                    status={mainServiceStats.ipBlocklist.violationCount > 5 ? 'warning' : 'normal'}
                  />
                </div>
              </section>

              {/* WebSocket統計 */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>WebSocket接続</h2>
                <Card>
                  <div className={styles.wsStats}>
                    <div className={styles.statItem}>
                      <label>総接続数:</label>
                      <span>{mainServiceStats.websocket.totalConnections}</span>
                    </div>
                    <div className={styles.statItem}>
                      <label>IP別接続上限:</label>
                      <span>{mainServiceStats.websocket.maxConnectionsPerIP}</span>
                    </div>
                  </div>
                  {Object.keys(mainServiceStats.websocket.connectionsPerIP).length > 0 && (
                    <div className={styles.tableContainer}>
                      <h4>IP別接続数</h4>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>IPアドレス</th>
                            <th>接続数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(mainServiceStats.websocket.connectionsPerIP)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 10)
                            .map(([ip, count]) => (
                              <tr key={ip}>
                                <td>{ip}</td>
                                <td>{count}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </section>

              {/* アクセスログ詳細 */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>アクセスログ詳細</h2>
                <div className={styles.statsGrid}>
                  <Card title="人気エンドポイント TOP10">
                    {mainServiceStats.accessLog.topPaths.length === 0 ? (
                      <p className={styles.emptyMessage}>データなし</p>
                    ) : (
                      <div className={styles.tableContainer}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>エンドポイント</th>
                              <th>リクエスト数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mainServiceStats.accessLog.topPaths.map((path) => (
                              <tr key={path.path}>
                                <td>{path.path}</td>
                                <td>{path.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  <Card title="アクセス元IP TOP10">
                    {mainServiceStats.accessLog.topIPs.length === 0 ? (
                      <p className={styles.emptyMessage}>データなし</p>
                    ) : (
                      <div className={styles.tableContainer}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>IPアドレス</th>
                              <th>リクエスト数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mainServiceStats.accessLog.topIPs.map((ip) => (
                              <tr key={ip.ip}>
                                <td>{ip.ip}</td>
                                <td>{ip.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              </section>

              {/* エラー統計 */}
              {mainServiceStats.accessLog.errorBreakdown.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>エラー統計</h2>
                  <Card>
                    <div className={styles.tableContainer}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>ステータスコード</th>
                            <th>発生回数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mainServiceStats.accessLog.errorBreakdown.map((error) => (
                            <tr key={error.statusCode}>
                              <td>
                                <span className={styles.statusCode}>{error.statusCode}</span>
                              </td>
                              <td>{error.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </section>
              )}
            </>
          )}

          {/* セッション統計 */}
          {mainServiceSessions && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>セッション統計</h2>
              <div className={styles.metricsGrid}>
                <MetricCard
                  icon="👤"
                  label="アクティブセッション"
                  value={mainServiceSessions.totalActiveSessions}
                  unit="件"
                  status="normal"
                />
                <MetricCard
                  icon="⏱️"
                  label="最古セッション"
                  value={mainServiceSessions.oldestSessionAge}
                  unit="分"
                  status={mainServiceSessions.oldestSessionAge > 60 ? 'warning' : 'normal'}
                />
                <MetricCard
                  icon="📈"
                  label="平均セッション年齢"
                  value={mainServiceSessions.averageSessionAge}
                  unit="分"
                  status="normal"
                />
              </div>
            </section>
          )}

          {/* セキュリティサマリー */}
          {mainServiceSummary && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>セキュリティサマリー</h2>
              <Card>
                <div className={styles.summary}>
                  <div className={styles.summaryStats}>
                    <div className={styles.summaryItem}>
                      <label>期間:</label>
                      <span>{mainServiceSummary.period}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <label>総リクエスト:</label>
                      <span>{mainServiceSummary.totalRequests}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <label>ブロック:</label>
                      <span>{mainServiceSummary.blockedRequests}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <label>疑わしいIP:</label>
                      <span>{mainServiceSummary.suspiciousIPs}</span>
                    </div>
                  </div>

                  {mainServiceSummary.topThreats?.length > 0 && (
                    <div className={styles.threats}>
                      <h4>主な脅威</h4>
                      <ul>
                        {mainServiceSummary.topThreats.map((threat, i) => (
                          <li key={i}>
                            {getSeverityIcon(threat.severity)} {threat.type}: {threat.count}件
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {mainServiceSummary.recommendations?.length > 0 && (
                    <div className={styles.recommendations}>
                      <h4>推奨事項</h4>
                      <ul>
                        {mainServiceSummary.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
};
