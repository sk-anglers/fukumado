import React, { useEffect, useState } from 'react';
import { Card, MetricCard, Loader } from '../common';
import { getServicesStatus } from '../../services/apiClient';
import { ServiceStatus, ServicesStatusResponse } from '../../types';
import styles from './Services.module.css';

export const Services: React.FC = () => {
  const [servicesData, setServicesData] = useState<ServicesStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // サービス状態を取得
  const fetchServicesStatus = async () => {
    try {
      const data = await getServicesStatus();
      setServicesData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[Services] Failed to fetch services status:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初回取得と定期更新
  useEffect(() => {
    fetchServicesStatus();

    // 15秒ごとに自動更新
    const interval = setInterval(fetchServicesStatus, 15000);

    return () => clearInterval(interval);
  }, []);

  // 手動リフレッシュ
  const handleRefresh = () => {
    setLoading(true);
    fetchServicesStatus();
  };

  // ステータスアイコンを取得
  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return '🟢';
      case 'unhealthy':
        return '🔴';
      case 'unknown':
        return '🟡';
      default:
        return '⚪';
    }
  };

  // ステータステキストを取得
  const getStatusText = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return '正常稼働';
      case 'unhealthy':
        return '異常';
      case 'unknown':
        return '不明';
      default:
        return '不明';
    }
  };

  // レスポンスタイムの色を取得
  const getResponseTimeColor = (responseTime?: number) => {
    if (!responseTime) return '#94a3b8';
    if (responseTime < 100) return '#10b981'; // 緑
    if (responseTime < 300) return '#f59e0b'; // 黄色
    return '#ef4444'; // 赤
  };

  if (loading && !servicesData) {
    return <Loader text="サービス状態を読み込んでいます..." />;
  }

  return (
    <div className={styles.services}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>サービス監視</h1>
        <button className={styles.refreshButton} onClick={handleRefresh} disabled={loading}>
          {loading ? '🔄 更新中...' : '🔄 手動更新'}
        </button>
      </div>

      {/* サマリー */}
      {servicesData && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>概要</h2>
          <div className={styles.summaryGrid}>
            <MetricCard
              icon="🖥️"
              label="総サービス数"
              value={servicesData.summary.total}
              unit="件"
              status="normal"
            />
            <MetricCard
              icon="✅"
              label="正常稼働"
              value={servicesData.summary.healthy}
              unit="件"
              status="normal"
            />
            <MetricCard
              icon="⚠️"
              label="異常"
              value={servicesData.summary.unhealthy}
              unit="件"
              status={servicesData.summary.unhealthy > 0 ? 'warning' : 'normal'}
            />
            <MetricCard
              icon="❓"
              label="不明"
              value={servicesData.summary.unknown}
              unit="件"
              status={servicesData.summary.unknown > 0 ? 'warning' : 'normal'}
            />
          </div>
        </section>
      )}

      {/* サービス一覧 */}
      {servicesData && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>サービス詳細</h2>
          <div className={styles.servicesGrid}>
            {servicesData.services.map((service, index) => (
              <Card key={index} className={styles.serviceCard}>
                <div className={styles.serviceHeader}>
                  <div className={styles.serviceName}>
                    {getStatusIcon(service.status)}
                    <h3>{service.name}</h3>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[service.status]}`}>
                    {getStatusText(service.status)}
                  </span>
                </div>

                <div className={styles.serviceDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>URL:</span>
                    <span className={styles.detailValue}>{service.url}</span>
                  </div>

                  {service.responseTime !== undefined && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>レスポンスタイム:</span>
                      <span
                        className={styles.detailValue}
                        style={{ color: getResponseTimeColor(service.responseTime) }}
                      >
                        {service.responseTime.toFixed(0)}ms
                      </span>
                    </div>
                  )}

                  {service.uptime !== undefined && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>稼働時間:</span>
                      <span className={styles.detailValue}>
                        {Math.floor(service.uptime / 3600)}時間
                      </span>
                    </div>
                  )}

                  {service.cpu !== undefined && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>CPU使用率:</span>
                      <span className={styles.detailValue}>
                        {service.cpu.toFixed(2)}%
                      </span>
                    </div>
                  )}

                  {service.memory !== undefined && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>メモリ使用量:</span>
                      <span className={styles.detailValue}>
                        {service.memory.toFixed(0)}MB
                      </span>
                    </div>
                  )}

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>最終チェック:</span>
                    <span className={styles.detailValue}>
                      {new Date(service.lastChecked).toLocaleTimeString('ja-JP')}
                    </span>
                  </div>

                  {service.error && (
                    <div className={styles.errorMessage}>
                      <span className={styles.errorLabel}>エラー:</span>
                      <span className={styles.errorText}>{service.error}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 最終更新時刻 */}
      <div className={styles.footer}>
        <p className={styles.lastUpdate}>
          最終更新: {lastUpdate.toLocaleString('ja-JP')} (自動更新: 15秒ごと)
        </p>
      </div>
    </div>
  );
};
