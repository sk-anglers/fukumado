import React, { useState, useEffect } from 'react';
import { Card, Button, Loader } from '../common';
import {
  getAlerts,
  acknowledgeAlert,
  resolveAlert
} from '../../services/apiClient';
import styles from './Alerts.module.css';

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  details: any;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const SEVERITY_LABELS: Record<string, string> = {
  info: '情報',
  warning: '警告',
  error: 'エラー',
  critical: '緊急'
};

const TYPE_LABELS: Record<string, string> = {
  cpu_high: 'CPU使用率高',
  memory_high: 'メモリ使用率高',
  rate_limit_low: 'レート制限残少',
  quota_low: 'クォータ残少',
  security: 'セキュリティ',
  error_spike: 'エラー急増'
};

export const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  // フィルター
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'unresolved'>('unresolved');

  // 詳細表示
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    loadAlerts();
  }, [offset, limit, typeFilter, severityFilter, statusFilter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);

      const options: any = {
        limit,
        offset
      };

      if (typeFilter) options.type = typeFilter;
      if (severityFilter) options.severity = severityFilter;

      // ステータスフィルター
      if (statusFilter === 'unread') {
        options.acknowledged = false;
      } else if (statusFilter === 'unresolved') {
        options.resolved = false;
      }

      const result = await getAlerts(options);

      setAlerts(result.alerts || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('[Alerts] Failed to load alerts:', error);
      alert('アラートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alert: Alert) => {
    if (!confirm('このアラートを確認済みにしますか？')) {
      return;
    }

    try {
      await acknowledgeAlert(alert.id, 'admin');
      alert('アラートを確認済みにしました');
      loadAlerts();
      if (selectedAlert?.id === alert.id) {
        setSelectedAlert(null);
      }
    } catch (error) {
      console.error('[Alerts] Failed to acknowledge alert:', error);
      alert('アラートの確認に失敗しました');
    }
  };

  const handleResolve = async (alert: Alert) => {
    if (!confirm('このアラートを解決済みにしますか？')) {
      return;
    }

    try {
      await resolveAlert(alert.id);
      alert('アラートを解決済みにしました');
      loadAlerts();
      if (selectedAlert?.id === alert.id) {
        setSelectedAlert(null);
      }
    } catch (error) {
      console.error('[Alerts] Failed to resolve alert:', error);
      alert('アラートの解決に失敗しました');
    }
  };

  const getSeverityClassName = (severity: string) => {
    switch (severity) {
      case 'info': return styles.severityInfo;
      case 'warning': return styles.severityWarning;
      case 'error': return styles.severityError;
      case 'critical': return styles.severityCritical;
      default: return '';
    }
  };

  if (loading) {
    return <Loader text="アラートを読み込んでいます..." />;
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className={styles.alerts}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>アラート一覧</h1>
        <Button onClick={loadAlerts}>更新</Button>
      </div>

      {/* フィルター */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>フィルター</h2>
        <Card>
          <div className={styles.filterGrid}>
            <div className={styles.filterItem}>
              <label>種別</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">すべて</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label>重要度</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">すべて</option>
                {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <label>ステータス</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={styles.filterSelect}
              >
                <option value="all">すべて</option>
                <option value="unread">未確認のみ</option>
                <option value="unresolved">未解決のみ</option>
              </select>
            </div>
          </div>
        </Card>
      </section>

      {/* アラート一覧 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アラート一覧 ({total}件)</h2>
        <Card>
          {alerts.length === 0 ? (
            <p className={styles.emptyMessage}>アラートはありません</p>
          ) : (
            <div className={styles.alertsList}>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`${styles.alertCard} ${
                    selectedAlert?.id === alert.id ? styles.selected : ''
                  }`}
                  onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                >
                  <div className={styles.alertHeader}>
                    <div className={styles.alertTitleRow}>
                      <span className={`${styles.severityBadge} ${getSeverityClassName(alert.severity)}`}>
                        {SEVERITY_LABELS[alert.severity] || alert.severity}
                      </span>
                      <span className={styles.typeBadge}>
                        {TYPE_LABELS[alert.type] || alert.type}
                      </span>
                      <h3 className={styles.alertTitle}>{alert.title}</h3>
                    </div>
                    <div className={styles.alertStatus}>
                      {!alert.acknowledged && (
                        <span className={styles.statusBadge}>未確認</span>
                      )}
                      {alert.resolved && (
                        <span className={`${styles.statusBadge} ${styles.resolved}`}>解決済み</span>
                      )}
                    </div>
                  </div>

                  <p className={styles.alertMessage}>{alert.message}</p>

                  <div className={styles.alertMeta}>
                    <span className={styles.metaItem}>
                      📅 {new Date(alert.createdAt).toLocaleString('ja-JP')}
                    </span>
                    {alert.acknowledgedBy && (
                      <span className={styles.metaItem}>
                        ✓ {alert.acknowledgedBy} が確認
                      </span>
                    )}
                  </div>

                  {selectedAlert?.id === alert.id && (
                    <div className={styles.alertDetails}>
                      {alert.details && (
                        <div className={styles.detailsSection}>
                          <h4>詳細情報</h4>
                          <pre className={styles.jsonDisplay}>
                            {JSON.stringify(alert.details, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className={styles.alertActions}>
                        {!alert.acknowledged && (
                          <Button
                            variant="primary"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledge(alert);
                            }}
                          >
                            確認済みにする
                          </Button>
                        )}
                        {!alert.resolved && (
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolve(alert);
                            }}
                          >
                            解決済みにする
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <Button
                size="small"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                ← 前へ
              </Button>
              <span className={styles.paginationInfo}>
                {currentPage} / {totalPages}
              </span>
              <Button
                size="small"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
              >
                次へ →
              </Button>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
};
