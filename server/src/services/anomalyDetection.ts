import { SecurityLogger } from '../middleware/logging';
import { ipBlocklist } from '../middleware/security';

/**
 * 異常検知アラート
 */
export interface AnomalyAlert {
  id: string;
  timestamp: Date;
  type: 'traffic_spike' | 'suspicious_pattern' | 'failed_auth' | 'error_spike' | 'unusual_endpoint';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip: string;
  description: string;
  metadata: Record<string, any>;
}

/**
 * トラフィックメトリクス
 */
interface TrafficMetrics {
  requestCount: number;
  errorCount: number;
  timestamp: Date;
}

/**
 * IPアクティビティ
 */
interface IPActivity {
  requestCount: number;
  errorCount: number;
  endpoints: Map<string, number>; // endpoint -> count
  lastRequestTime: Date;
  firstRequestTime: Date;
}

/**
 * 異常検知サービス
 */
export class AnomalyDetectionService {
  // アラート履歴（最大1000件）
  private alerts: AnomalyAlert[] = [];
  private readonly maxAlerts = 1000;

  // トラフィックメトリクス（1分間隔で記録）
  private trafficMetrics: TrafficMetrics[] = [];
  private readonly metricsRetentionMinutes = 60; // 60分間保持

  // IP別アクティビティ
  private ipActivity: Map<string, IPActivity> = new Map();

  // 認証失敗カウント
  private authFailures: Map<string, { count: number; lastFailure: Date }> = new Map();

  // 異常検知の閾値設定
  private readonly thresholds = {
    // トラフィック急増: 1分間のリクエスト数が過去平均の3倍以上
    trafficSpikeMultiplier: 3,

    // エラー急増: 1分間のエラー数が10件以上
    errorSpikeThreshold: 10,

    // 異常なリクエストパターン: 同一IPから1分間に100リクエスト以上
    suspiciousRequestThreshold: 100,

    // 認証失敗: 同一IPから5分間に5回以上
    authFailureThreshold: 5,
    authFailureWindowMinutes: 5,

    // 異常なエンドポイント: 存在しないエンドポイントへのアクセスが10回以上
    unusualEndpointThreshold: 10
  };

  // メトリクス収集インターバル
  private metricsInterval: NodeJS.Timeout | null = null;
  private currentMetrics: TrafficMetrics = {
    requestCount: 0,
    errorCount: 0,
    timestamp: new Date()
  };

  constructor() {
    console.log('[Anomaly Detection] Service initialized');
    this.startMetricsCollection();
    this.startPeriodicCleanup();
  }

  /**
   * メトリクス収集を開始（1分ごと）
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      // 現在のメトリクスを保存
      if (this.currentMetrics.requestCount > 0) {
        this.trafficMetrics.push({ ...this.currentMetrics });

        // 古いメトリクスを削除（60分以上前）
        const cutoffTime = new Date(Date.now() - this.metricsRetentionMinutes * 60 * 1000);
        this.trafficMetrics = this.trafficMetrics.filter(m => m.timestamp > cutoffTime);

        // トラフィック急増をチェック
        this.checkTrafficSpike();
      }

      // 新しいメトリクスをリセット
      this.currentMetrics = {
        requestCount: 0,
        errorCount: 0,
        timestamp: new Date()
      };
    }, 60 * 1000); // 1分
  }

  /**
   * 定期的なクリーンアップ（5分ごと）
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000); // 5分
  }

  /**
   * 古いデータをクリーンアップ
   */
  private cleanupOldData(): void {
    const now = new Date();

    // 古いIPアクティビティを削除（1時間以上前）
    for (const [ip, activity] of this.ipActivity) {
      if (now.getTime() - activity.lastRequestTime.getTime() > 60 * 60 * 1000) {
        this.ipActivity.delete(ip);
      }
    }

    // 古い認証失敗記録を削除
    for (const [ip, failure] of this.authFailures) {
      if (now.getTime() - failure.lastFailure.getTime() > this.thresholds.authFailureWindowMinutes * 60 * 1000) {
        this.authFailures.delete(ip);
      }
    }

    console.log(`[Anomaly Detection] Cleanup completed - Active IPs: ${this.ipActivity.size}`);
  }

  /**
   * リクエストを記録
   */
  public recordRequest(ip: string, path: string, statusCode: number): void {
    // 現在のメトリクスを更新
    this.currentMetrics.requestCount++;
    if (statusCode >= 400) {
      this.currentMetrics.errorCount++;
    }

    // IP別アクティビティを更新
    let activity = this.ipActivity.get(ip);
    if (!activity) {
      activity = {
        requestCount: 0,
        errorCount: 0,
        endpoints: new Map(),
        lastRequestTime: new Date(),
        firstRequestTime: new Date()
      };
      this.ipActivity.set(ip, activity);
    }

    activity.requestCount++;
    activity.lastRequestTime = new Date();

    if (statusCode >= 400) {
      activity.errorCount++;
    }

    // エンドポイント別カウント
    activity.endpoints.set(path, (activity.endpoints.get(path) || 0) + 1);

    // 異常パターンをチェック
    this.checkSuspiciousActivity(ip, activity);

    // 404エラーの場合、異常なエンドポイントアクセスをチェック
    if (statusCode === 404) {
      this.checkUnusualEndpoint(ip, path);
    }
  }

  /**
   * 認証失敗を記録
   */
  public recordAuthFailure(ip: string, username?: string): void {
    const failure = this.authFailures.get(ip) || { count: 0, lastFailure: new Date() };
    failure.count++;
    failure.lastFailure = new Date();
    this.authFailures.set(ip, failure);

    console.warn(`[Anomaly Detection] Auth failure from ${ip} - Count: ${failure.count}`);

    // 閾値を超えた場合
    if (failure.count >= this.thresholds.authFailureThreshold) {
      this.createAlert({
        type: 'failed_auth',
        severity: 'high',
        ip,
        description: `Multiple authentication failures detected (${failure.count} attempts)`,
        metadata: { username, failureCount: failure.count }
      });

      // IPをブロック
      ipBlocklist.recordViolation(ip, 'repeated_auth_failure');
      SecurityLogger.logBlockedRequest(ip, 'Repeated authentication failures', '/auth', { count: failure.count });
    }
  }

  /**
   * トラフィック急増をチェック
   */
  private checkTrafficSpike(): void {
    if (this.trafficMetrics.length < 5) {
      // データが少ない場合はスキップ
      return;
    }

    // 過去10分間の平均リクエスト数を計算
    const recentMetrics = this.trafficMetrics.slice(-10);
    const avgRequests = recentMetrics.reduce((sum, m) => sum + m.requestCount, 0) / recentMetrics.length;

    // 現在のリクエスト数が平均の3倍以上
    if (this.currentMetrics.requestCount > avgRequests * this.thresholds.trafficSpikeMultiplier) {
      this.createAlert({
        type: 'traffic_spike',
        severity: 'medium',
        ip: 'multiple',
        description: `Traffic spike detected: ${this.currentMetrics.requestCount} requests (avg: ${avgRequests.toFixed(0)})`,
        metadata: {
          currentRequests: this.currentMetrics.requestCount,
          averageRequests: avgRequests,
          multiplier: (this.currentMetrics.requestCount / avgRequests).toFixed(2)
        }
      });

      console.warn('[Anomaly Detection] Traffic spike detected!', {
        current: this.currentMetrics.requestCount,
        average: avgRequests.toFixed(0)
      });
    }

    // エラー急増チェック
    if (this.currentMetrics.errorCount >= this.thresholds.errorSpikeThreshold) {
      this.createAlert({
        type: 'error_spike',
        severity: 'high',
        ip: 'multiple',
        description: `Error spike detected: ${this.currentMetrics.errorCount} errors in 1 minute`,
        metadata: {
          errorCount: this.currentMetrics.errorCount
        }
      });

      console.warn('[Anomaly Detection] Error spike detected!', {
        errorCount: this.currentMetrics.errorCount
      });
    }
  }

  /**
   * 不審なアクティビティをチェック
   */
  private checkSuspiciousActivity(ip: string, activity: IPActivity): void {
    // 1分間のリクエスト数を計算
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // 最初のリクエストが1分以内で、かつリクエスト数が閾値以上
    if (activity.firstRequestTime > oneMinuteAgo && activity.requestCount >= this.thresholds.suspiciousRequestThreshold) {
      this.createAlert({
        type: 'suspicious_pattern',
        severity: 'high',
        ip,
        description: `Suspicious request pattern: ${activity.requestCount} requests in 1 minute`,
        metadata: {
          requestCount: activity.requestCount,
          errorCount: activity.errorCount,
          uniqueEndpoints: activity.endpoints.size
        }
      });

      // IPをブロック
      ipBlocklist.recordViolation(ip, 'suspicious_activity');
      SecurityLogger.logAnomalousActivity(ip, 'High request rate', {
        requestCount: activity.requestCount,
        timeWindow: '1 minute'
      });
    }

    // エラー率が高い場合（50%以上）
    const errorRate = activity.errorCount / activity.requestCount;
    if (activity.requestCount >= 10 && errorRate >= 0.5) {
      this.createAlert({
        type: 'suspicious_pattern',
        severity: 'medium',
        ip,
        description: `High error rate: ${(errorRate * 100).toFixed(0)}% (${activity.errorCount}/${activity.requestCount})`,
        metadata: {
          errorRate: errorRate.toFixed(2),
          errorCount: activity.errorCount,
          totalRequests: activity.requestCount
        }
      });

      SecurityLogger.logAnomalousActivity(ip, 'High error rate', {
        errorRate: (errorRate * 100).toFixed(0) + '%'
      });
    }
  }

  /**
   * 異常なエンドポイントアクセスをチェック
   */
  private checkUnusualEndpoint(ip: string, path: string): void {
    const activity = this.ipActivity.get(ip);
    if (!activity) return;

    const endpointCount = activity.endpoints.get(path) || 0;

    if (endpointCount >= this.thresholds.unusualEndpointThreshold) {
      this.createAlert({
        type: 'unusual_endpoint',
        severity: 'medium',
        ip,
        description: `Repeated access to non-existent endpoint: ${path} (${endpointCount} times)`,
        metadata: {
          endpoint: path,
          accessCount: endpointCount
        }
      });

      SecurityLogger.logAnomalousActivity(ip, 'Unusual endpoint access', {
        endpoint: path,
        count: endpointCount
      });
    }
  }

  /**
   * アラートを作成
   */
  private createAlert(params: {
    type: AnomalyAlert['type'];
    severity: AnomalyAlert['severity'];
    ip: string;
    description: string;
    metadata: Record<string, any>;
  }): void {
    const alert: AnomalyAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...params
    };

    this.alerts.push(alert);

    // アラート数が上限を超えたら古いものを削除
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // コンソールに出力
    const severityIcon = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🚨',
      critical: '🔥'
    }[alert.severity];

    console.warn(`[Anomaly Detection] ${severityIcon} ${alert.type.toUpperCase()} - ${alert.description}`, alert.metadata);
  }

  /**
   * アラート履歴を取得
   */
  public getAlerts(limit: number = 50): AnomalyAlert[] {
    return this.alerts.slice(-limit).reverse(); // 新しい順
  }

  /**
   * 特定のIPのアラートを取得
   */
  public getAlertsByIP(ip: string, limit: number = 50): AnomalyAlert[] {
    return this.alerts
      .filter(alert => alert.ip === ip)
      .slice(-limit)
      .reverse();
  }

  /**
   * 統計情報を取得
   */
  public getStats(): {
    totalAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByType: Record<string, number>;
    recentAlerts: number; // 過去1時間のアラート数
    activeIPs: number;
    topSuspiciousIPs: Array<{ ip: string; requestCount: number; errorCount: number }>;
  } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAlerts = this.alerts.filter(a => a.timestamp > oneHourAgo).length;

    const alertsBySeverity: Record<string, number> = {};
    const alertsByType: Record<string, number> = {};

    for (const alert of this.alerts) {
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    }

    // 最も不審なIPトップ10
    const topSuspiciousIPs = Array.from(this.ipActivity.entries())
      .map(([ip, activity]) => ({
        ip,
        requestCount: activity.requestCount,
        errorCount: activity.errorCount
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);

    return {
      totalAlerts: this.alerts.length,
      alertsBySeverity,
      alertsByType,
      recentAlerts,
      activeIPs: this.ipActivity.size,
      topSuspiciousIPs
    };
  }

  /**
   * アラートをクリア
   */
  public clearAlerts(): void {
    this.alerts = [];
    console.log('[Anomaly Detection] Alerts cleared');
  }

  /**
   * サービスをシャットダウン
   */
  public shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    console.log('[Anomaly Detection] Service shutdown');
  }
}

// シングルトンインスタンス
export const anomalyDetectionService = new AnomalyDetectionService();
