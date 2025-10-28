/**
 * Prometheusメトリクス収集サービス
 * アプリケーションの各種メトリクスを収集し、Prometheus形式で出力
 */

/**
 * メトリクスの種類
 */
interface Counter {
  value: number;
  labels: Map<string, number>; // ラベル付きカウンター
}

interface Gauge {
  value: number;
  labels: Map<string, number>;
}

interface Histogram {
  sum: number;
  count: number;
  buckets: Map<number, number>; // bucket上限 -> カウント
}

/**
 * メトリクス収集サービス
 */
export class MetricsCollector {
  // カウンター: 増加のみ（リクエスト数、エラー数など）
  private counters: Map<string, Counter> = new Map();

  // ゲージ: 増減する値（接続数、メモリ使用量など）
  private gauges: Map<string, Gauge> = new Map();

  // ヒストグラム: 分布を記録（レスポンス時間など）
  private histograms: Map<string, Histogram> = new Map();

  // ヒストグラムのバケット定義（ミリ秒）
  private readonly responseBuckets = [10, 50, 100, 200, 500, 1000, 2000, 5000];

  constructor() {
    console.log('[Metrics Collector] Initialized');
    this.initializeMetrics();
  }

  /**
   * メトリクスを初期化
   */
  private initializeMetrics(): void {
    // HTTPリクエストカウンター
    this.counters.set('http_requests_total', {
      value: 0,
      labels: new Map()
    });

    // HTTPエラーカウンター
    this.counters.set('http_errors_total', {
      value: 0,
      labels: new Map()
    });

    // WebSocket接続ゲージ
    this.gauges.set('websocket_connections', {
      value: 0,
      labels: new Map()
    });

    // WebSocketメッセージカウンター
    this.counters.set('websocket_messages_total', {
      value: 0,
      labels: new Map()
    });

    // セキュリティアラートカウンター
    this.counters.set('security_alerts_total', {
      value: 0,
      labels: new Map()
    });

    // レート制限違反カウンター
    this.counters.set('rate_limit_violations_total', {
      value: 0,
      labels: new Map()
    });

    // Twitch API呼び出しカウンター
    this.counters.set('twitch_api_calls_total', {
      value: 0,
      labels: new Map()
    });

    // Twitch APIエラーカウンター
    this.counters.set('twitch_api_errors_total', {
      value: 0,
      labels: new Map()
    });

    // EventSub WebSocketエラーカウンター
    this.counters.set('eventsub_websocket_errors_total', {
      value: 0,
      labels: new Map()
    });

    // EventSubサブスクリプション試行カウンター
    this.counters.set('eventsub_subscription_attempts_total', {
      value: 0,
      labels: new Map()
    });

    // EventSubサブスクリプション失敗カウンター
    this.counters.set('eventsub_subscription_failures_total', {
      value: 0,
      labels: new Map()
    });

    // レスポンス時間ヒストグラム
    this.histograms.set('http_request_duration_ms', {
      sum: 0,
      count: 0,
      buckets: new Map(this.responseBuckets.map(b => [b, 0]))
    });
  }

  /**
   * カウンターを増加
   */
  public incrementCounter(name: string, labels?: Record<string, string>): void {
    const counter = this.counters.get(name);
    if (!counter) {
      console.warn(`[Metrics] Counter not found: ${name}`);
      return;
    }

    counter.value++;

    if (labels) {
      const labelKey = this.getLabelKey(labels);
      counter.labels.set(labelKey, (counter.labels.get(labelKey) || 0) + 1);
    }
  }

  /**
   * ゲージを設定
   */
  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const gauge = this.gauges.get(name);
    if (!gauge) {
      console.warn(`[Metrics] Gauge not found: ${name}`);
      return;
    }

    gauge.value = value;

    if (labels) {
      const labelKey = this.getLabelKey(labels);
      gauge.labels.set(labelKey, value);
    }
  }

  /**
   * ゲージを増加
   */
  public incrementGauge(name: string, delta: number = 1, labels?: Record<string, string>): void {
    const gauge = this.gauges.get(name);
    if (!gauge) {
      console.warn(`[Metrics] Gauge not found: ${name}`);
      return;
    }

    gauge.value += delta;

    if (labels) {
      const labelKey = this.getLabelKey(labels);
      gauge.labels.set(labelKey, (gauge.labels.get(labelKey) || 0) + delta);
    }
  }

  /**
   * ゲージを減少
   */
  public decrementGauge(name: string, delta: number = 1, labels?: Record<string, string>): void {
    this.incrementGauge(name, -delta, labels);
  }

  /**
   * ヒストグラムに値を記録
   */
  public observeHistogram(name: string, value: number): void {
    const histogram = this.histograms.get(name);
    if (!histogram) {
      console.warn(`[Metrics] Histogram not found: ${name}`);
      return;
    }

    histogram.sum += value;
    histogram.count++;

    // 適切なバケットに記録
    for (const bucket of this.responseBuckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
      }
    }
  }

  /**
   * HTTPリクエストを記録
   */
  public recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
  ): void {
    // リクエストカウンター
    this.incrementCounter('http_requests_total', {
      method,
      path,
      status: statusCode.toString()
    });

    // エラーカウンター
    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', {
        method,
        path,
        status: statusCode.toString()
      });
    }

    // レスポンス時間ヒストグラム
    this.observeHistogram('http_request_duration_ms', durationMs);
  }

  /**
   * WebSocket接続を記録
   */
  public recordWebSocketConnection(connected: boolean): void {
    if (connected) {
      this.incrementGauge('websocket_connections');
    } else {
      this.decrementGauge('websocket_connections');
    }
  }

  /**
   * WebSocketメッセージを記録
   */
  public recordWebSocketMessage(type: string, direction: 'in' | 'out'): void {
    this.incrementCounter('websocket_messages_total', {
      type,
      direction
    });
  }

  /**
   * セキュリティアラートを記録
   */
  public recordSecurityAlert(severity: string, type: string): void {
    this.incrementCounter('security_alerts_total', {
      severity,
      type
    });
  }

  /**
   * レート制限違反を記録
   */
  public recordRateLimitViolation(endpoint: string, ip: string): void {
    this.incrementCounter('rate_limit_violations_total', {
      endpoint
    });
  }

  /**
   * Twitch API呼び出しを記録
   */
  public recordTwitchApiCall(endpoint: string, method: string): void {
    this.incrementCounter('twitch_api_calls_total', {
      endpoint,
      method
    });
  }

  /**
   * Twitch APIエラーを記録
   */
  public recordTwitchApiError(endpoint: string, statusCode: number, errorType: string): void {
    this.incrementCounter('twitch_api_errors_total', {
      endpoint,
      status: statusCode.toString(),
      type: errorType
    });
  }

  /**
   * EventSub WebSocketエラーを記録
   */
  public recordEventSubWebSocketError(connectionIndex: number, errorCode: number): void {
    this.incrementCounter('eventsub_websocket_errors_total', {
      connection: connectionIndex.toString(),
      code: errorCode.toString()
    });
  }

  /**
   * EventSubサブスクリプション試行を記録
   */
  public recordEventSubSubscriptionAttempt(userId: string): void {
    this.incrementCounter('eventsub_subscription_attempts_total');
  }

  /**
   * EventSubサブスクリプション失敗を記録
   */
  public recordEventSubSubscriptionFailure(userId: string, reason: string, statusCode?: number): void {
    this.incrementCounter('eventsub_subscription_failures_total', {
      reason,
      status: statusCode ? statusCode.toString() : 'unknown'
    });
  }

  /**
   * ラベルからキーを生成
   */
  private getLabelKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  /**
   * Prometheus形式のメトリクスを生成
   */
  public getPrometheusMetrics(): string {
    const lines: string[] = [];

    // カウンター
    for (const [name, counter] of this.counters) {
      lines.push(`# HELP ${name} Total count of ${name.replace(/_/g, ' ')}`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${counter.value}`);

      // ラベル付きメトリクス
      for (const [labelKey, value] of counter.labels) {
        lines.push(`${name}{${labelKey}} ${value}`);
      }

      lines.push('');
    }

    // ゲージ
    for (const [name, gauge] of this.gauges) {
      lines.push(`# HELP ${name} Current value of ${name.replace(/_/g, ' ')}`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${gauge.value}`);

      // ラベル付きメトリクス
      for (const [labelKey, value] of gauge.labels) {
        lines.push(`${name}{${labelKey}} ${value}`);
      }

      lines.push('');
    }

    // ヒストグラム
    for (const [name, histogram] of this.histograms) {
      lines.push(`# HELP ${name} Distribution of ${name.replace(/_/g, ' ')}`);
      lines.push(`# TYPE ${name} histogram`);

      // バケット
      for (const [bucket, count] of histogram.buckets) {
        lines.push(`${name}_bucket{le="${bucket}"} ${count}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${histogram.count}`);

      // 合計と件数
      lines.push(`${name}_sum ${histogram.sum}`);
      lines.push(`${name}_count ${histogram.count}`);

      lines.push('');
    }

    // システムメトリクス
    const memUsage = process.memoryUsage();
    lines.push('# HELP process_memory_bytes Process memory usage in bytes');
    lines.push('# TYPE process_memory_bytes gauge');
    lines.push(`process_memory_bytes{type="rss"} ${memUsage.rss}`);
    lines.push(`process_memory_bytes{type="heap_total"} ${memUsage.heapTotal}`);
    lines.push(`process_memory_bytes{type="heap_used"} ${memUsage.heapUsed}`);
    lines.push(`process_memory_bytes{type="external"} ${memUsage.external}`);
    lines.push('');

    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${process.uptime()}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * JSON形式のメトリクスを取得
   */
  public getMetricsJSON(): any {
    const metrics: any = {
      counters: {},
      gauges: {},
      histograms: {},
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    };

    // カウンター
    for (const [name, counter] of this.counters) {
      metrics.counters[name] = {
        value: counter.value,
        labels: Object.fromEntries(counter.labels)
      };
    }

    // ゲージ
    for (const [name, gauge] of this.gauges) {
      metrics.gauges[name] = {
        value: gauge.value,
        labels: Object.fromEntries(gauge.labels)
      };
    }

    // ヒストグラム
    for (const [name, histogram] of this.histograms) {
      const buckets: any = {};
      for (const [bucket, count] of histogram.buckets) {
        buckets[bucket] = count;
      }

      metrics.histograms[name] = {
        sum: histogram.sum,
        count: histogram.count,
        average: histogram.count > 0 ? histogram.sum / histogram.count : 0,
        buckets
      };
    }

    return metrics;
  }

  /**
   * 統計情報を取得
   */
  public getStats(): {
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    websocketConnections: number;
    securityAlerts: number;
    rateLimitViolations: number;
    twitchApiCalls: number;
    twitchApiErrors: number;
    eventsubWebSocketErrors: number;
    eventsubSubscriptionAttempts: number;
    eventsubSubscriptionFailures: number;
  } {
    const httpRequests = this.counters.get('http_requests_total')?.value || 0;
    const httpErrors = this.counters.get('http_errors_total')?.value || 0;
    const histogram = this.histograms.get('http_request_duration_ms');
    const avgResponseTime = histogram && histogram.count > 0
      ? histogram.sum / histogram.count
      : 0;

    return {
      totalRequests: httpRequests,
      totalErrors: httpErrors,
      averageResponseTime: Math.round(avgResponseTime * 100) / 100,
      websocketConnections: this.gauges.get('websocket_connections')?.value || 0,
      securityAlerts: this.counters.get('security_alerts_total')?.value || 0,
      rateLimitViolations: this.counters.get('rate_limit_violations_total')?.value || 0,
      twitchApiCalls: this.counters.get('twitch_api_calls_total')?.value || 0,
      twitchApiErrors: this.counters.get('twitch_api_errors_total')?.value || 0,
      eventsubWebSocketErrors: this.counters.get('eventsub_websocket_errors_total')?.value || 0,
      eventsubSubscriptionAttempts: this.counters.get('eventsub_subscription_attempts_total')?.value || 0,
      eventsubSubscriptionFailures: this.counters.get('eventsub_subscription_failures_total')?.value || 0
    };
  }

  /**
   * メトリクスをリセット
   */
  public reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.initializeMetrics();
    console.log('[Metrics Collector] Metrics reset');
  }
}

// シングルトンインスタンス
export const metricsCollector = new MetricsCollector();
