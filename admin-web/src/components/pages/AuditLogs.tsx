import React, { useState, useEffect } from 'react';
import { Card, Button, Loader } from '../common';
import {
  getAuditLogs,
  getAuditLogSummary,
  cleanupAuditLogs
} from '../../services/apiClient';
import styles from './AuditLogs.module.css';

interface AuditLog {
  id: string;
  action: string;
  actor: string;
  actorIp: string;
  actorAgent: string | null;
  targetType: string;
  targetId: string | null;
  details: any;
  status: 'success' | 'failure';
  errorMessage: string | null;
  createdAt: string;
}

interface AuditLogSummary {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  totalLogs: number;
  successCount: number;
  failureCount: number;
  topActions: Array<{
    action: string;
    count: number;
  }>;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  // フィルター
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');

  // 詳細表示
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadData();
  }, [offset, limit, actionFilter, actorFilter, targetTypeFilter, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);

      const options: any = {
        limit,
        offset
      };
      if (actionFilter) options.action = actionFilter;
      if (actorFilter) options.actor = actorFilter;
      if (targetTypeFilter) options.targetType = targetTypeFilter;
      if (statusFilter !== 'all') options.status = statusFilter;

      const [logsResult, summaryResult] = await Promise.all([
        getAuditLogs(options),
        getAuditLogSummary(7)
      ]);

      setLogs(logsResult.logs || []);
      setTotal(logsResult.total || 0);
      setSummary(summaryResult);
    } catch (error) {
      console.error('[AuditLogs] Failed to load data:', error);
      alert('監査ログの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    const daysInput = prompt('何日より古いログを削除しますか？', '90');
    if (!daysInput) return;

    const days = parseInt(daysInput);
    if (isNaN(days) || days < 1) {
      alert('有効な日数を入力してください');
      return;
    }

    if (!confirm(`${days}日より古い監査ログをすべて削除します。\nこの操作は取り消せません。よろしいですか？`)) {
      return;
    }

    try {
      await cleanupAuditLogs(days);
      alert('クリーンアップが完了しました');
      loadData();
    } catch (error) {
      console.error('[AuditLogs] Failed to cleanup:', error);
      alert('クリーンアップに失敗しました');
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const getStatusBadge = (status: string) => {
    return status === 'success' ? (
      <span className={styles.statusSuccess}>成功</span>
    ) : (
      <span className={styles.statusFailure}>失敗</span>
    );
  };

  if (loading && logs.length === 0) {
    return <Loader text="監査ログを読み込んでいます..." />;
  }

  return (
    <div className={styles.auditLogs}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>監査ログ</h1>
        <div className={styles.headerButtons}>
          <Button variant="secondary" onClick={loadData}>
            🔄 更新
          </Button>
          <Button variant="danger" onClick={handleCleanup}>
            🗑️ クリーンアップ
          </Button>
        </div>
      </div>

      {/* サマリー */}
      {summary && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>サマリー（直近{summary.period.days}日間）</h2>
          <div className={styles.summaryGrid}>
            <Card className={styles.summaryCard}>
              <div className={styles.summaryLabel}>総ログ数</div>
              <div className={styles.summaryValue}>{summary.totalLogs.toLocaleString()}</div>
            </Card>
            <Card className={styles.summaryCard}>
              <div className={styles.summaryLabel}>成功</div>
              <div className={styles.summaryValue + ' ' + styles.successColor}>
                {summary.successCount.toLocaleString()}
              </div>
            </Card>
            <Card className={styles.summaryCard}>
              <div className={styles.summaryLabel}>失敗</div>
              <div className={styles.summaryValue + ' ' + styles.failureColor}>
                {summary.failureCount.toLocaleString()}
              </div>
            </Card>
          </div>

          {summary.topActions.length > 0 && (
            <Card className={styles.topActionsCard}>
              <h3 className={styles.cardTitle}>よく実行される操作 TOP 10</h3>
              <div className={styles.topActionsList}>
                {summary.topActions.map((item, index) => (
                  <div key={index} className={styles.topActionItem}>
                    <span className={styles.topActionRank}>#{index + 1}</span>
                    <span className={styles.topActionName}>{item.action}</span>
                    <span className={styles.topActionCount}>{item.count}回</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
      )}

      {/* フィルター */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>フィルター</h2>
        <Card>
          <div className={styles.filterGrid}>
            <div className={styles.filterItem}>
              <label htmlFor="action">操作種別</label>
              <input
                id="action"
                type="text"
                placeholder="例: maintenance_enabled"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className={styles.filterInput}
              />
            </div>
            <div className={styles.filterItem}>
              <label htmlFor="actor">操作者</label>
              <input
                id="actor"
                type="text"
                placeholder="例: admin"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className={styles.filterInput}
              />
            </div>
            <div className={styles.filterItem}>
              <label htmlFor="targetType">対象種別</label>
              <input
                id="targetType"
                type="text"
                placeholder="例: maintenance, cache"
                value={targetTypeFilter}
                onChange={(e) => setTargetTypeFilter(e.target.value)}
                className={styles.filterInput}
              />
            </div>
            <div className={styles.filterItem}>
              <label htmlFor="status">ステータス</label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={styles.filterSelect}
              >
                <option value="all">すべて</option>
                <option value="success">成功</option>
                <option value="failure">失敗</option>
              </select>
            </div>
          </div>
        </Card>
      </section>

      {/* ログ一覧 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          ログ一覧（{total.toLocaleString()}件）
        </h2>

        <div className={styles.logsList}>
          {logs.length === 0 ? (
            <Card>
              <p className={styles.emptyMessage}>ログが見つかりませんでした</p>
            </Card>
          ) : (
            logs.map((log) => (
              <Card
                key={log.id}
                className={`${styles.logCard} ${selectedLog?.id === log.id ? styles.selected : ''}`}
                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
              >
                <div className={styles.logHeader}>
                  <div className={styles.logAction}>{log.action}</div>
                  {getStatusBadge(log.status)}
                </div>
                <div className={styles.logMeta}>
                  <span className={styles.metaItem}>
                    👤 {log.actor}
                  </span>
                  <span className={styles.metaItem}>
                    🎯 {log.targetType}
                    {log.targetId && ` (${log.targetId})`}
                  </span>
                  <span className={styles.metaItem}>
                    🌐 {log.actorIp}
                  </span>
                  <span className={styles.metaItem}>
                    📅 {formatDate(log.createdAt)}
                  </span>
                </div>

                {selectedLog?.id === log.id && (
                  <div className={styles.logDetails}>
                    <div className={styles.detailsSection}>
                      <h4>User-Agent:</h4>
                      <p>{log.actorAgent || 'なし'}</p>
                    </div>

                    {log.details && (
                      <div className={styles.detailsSection}>
                        <h4>詳細:</h4>
                        <pre className={styles.jsonDisplay}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {log.errorMessage && (
                      <div className={styles.detailsSection}>
                        <h4>エラーメッセージ:</h4>
                        <p className={styles.errorMessage}>{log.errorMessage}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* ページネーション */}
        <div className={styles.pagination}>
          <Button
            onClick={handlePrevPage}
            disabled={offset === 0}
            variant="secondary"
          >
            ← 前へ
          </Button>
          <span className={styles.paginationInfo}>
            {offset + 1} - {Math.min(offset + limit, total)} / {total}
          </span>
          <Button
            onClick={handleNextPage}
            disabled={offset + limit >= total}
            variant="secondary"
          >
            次へ →
          </Button>
        </div>
      </section>
    </div>
  );
};
