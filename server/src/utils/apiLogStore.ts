/**
 * 外部API呼び出しログストア
 * Twitch, YouTube等の外部APIへのすべてのリクエストを記録
 */

export interface ApiCallLog {
  id: string;
  timestamp: string;
  service: 'twitch' | 'youtube' | 'other';
  endpoint: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestQuery?: Record<string, string>;
  requestBody?: any;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody?: any;
  responseTime: number;
  error?: string;
  // Twitch専用
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  // YouTube専用
  quotaCost?: number;
}

export interface ApiStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
  endpointStats: Record<string, {
    count: number;
    avgResponseTime: number;
    errorCount: number;
  }>;
}

class ApiLogStore {
  private logs: ApiCallLog[] = [];
  private readonly MAX_LOGS = 1000; // メモリ制限

  /**
   * APIログを追加
   */
  public addLog(log: ApiCallLog): void {
    this.logs.unshift(log);

    // 最大数を超えた場合は古いログを削除
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }
  }

  /**
   * ログを取得（フィルタリング付き）
   */
  public getLogs(options: {
    limit?: number;
    offset?: number;
    service?: 'twitch' | 'youtube' | 'other';
    endpoint?: string;
    method?: string;
    statusCode?: number;
    startDate?: string;
    endDate?: string;
  }): { logs: ApiCallLog[]; total: number } {
    let filtered = [...this.logs];

    // サービスフィルター
    if (options.service) {
      filtered = filtered.filter(log => log.service === options.service);
    }

    // エンドポイントフィルター
    if (options.endpoint) {
      filtered = filtered.filter(log => log.endpoint.includes(options.endpoint!));
    }

    // メソッドフィルター
    if (options.method) {
      filtered = filtered.filter(log => log.method === options.method);
    }

    // ステータスコードフィルター
    if (options.statusCode) {
      filtered = filtered.filter(log => log.responseStatus === options.statusCode);
    }

    // 日時範囲フィルター
    if (options.startDate) {
      const start = new Date(options.startDate).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= start);
    }
    if (options.endDate) {
      const end = new Date(options.endDate).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= end);
    }

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return {
      logs: filtered.slice(offset, offset + limit),
      total
    };
  }

  /**
   * 統計情報を取得
   */
  public getStats(service?: 'twitch' | 'youtube' | 'other'): ApiStats {
    let logs = [...this.logs];

    if (service) {
      logs = logs.filter(log => log.service === service);
    }

    const totalCalls = logs.length;
    const successfulCalls = logs.filter(log => log.responseStatus >= 200 && log.responseStatus < 300).length;
    const failedCalls = totalCalls - successfulCalls;

    const totalResponseTime = logs.reduce((sum, log) => sum + log.responseTime, 0);
    const averageResponseTime = totalCalls > 0 ? totalResponseTime / totalCalls : 0;

    // エンドポイント別統計
    const endpointStats: Record<string, { count: number; avgResponseTime: number; errorCount: number }> = {};

    logs.forEach(log => {
      if (!endpointStats[log.endpoint]) {
        endpointStats[log.endpoint] = {
          count: 0,
          avgResponseTime: 0,
          errorCount: 0
        };
      }

      const stat = endpointStats[log.endpoint];
      stat.count++;
      stat.avgResponseTime = (stat.avgResponseTime * (stat.count - 1) + log.responseTime) / stat.count;
      if (log.responseStatus >= 400) {
        stat.errorCount++;
      }
    });

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageResponseTime,
      endpointStats
    };
  }

  /**
   * Twitchの最新レート制限情報を取得
   */
  public getLatestTwitchRateLimit(): ApiCallLog['rateLimit'] | null {
    const twitchLogs = this.logs.filter(log => log.service === 'twitch' && log.rateLimit);
    if (twitchLogs.length === 0) return null;
    return twitchLogs[0].rateLimit || null;
  }

  /**
   * YouTube APIの総クォータ使用量を取得（本日分）
   */
  public getTodayYouTubeQuotaUsage(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const youtubeLogs = this.logs.filter(log =>
      log.service === 'youtube' &&
      log.quotaCost &&
      new Date(log.timestamp).getTime() >= todayTimestamp
    );

    return youtubeLogs.reduce((sum, log) => sum + (log.quotaCost || 0), 0);
  }

  /**
   * 直近N分間のAPI呼び出し数を取得
   */
  public getRecentCallCount(service: 'twitch' | 'youtube' | 'other', minutes: number): number {
    const threshold = Date.now() - (minutes * 60 * 1000);
    return this.logs.filter(log =>
      log.service === service &&
      new Date(log.timestamp).getTime() >= threshold
    ).length;
  }

  /**
   * ログをクリア
   */
  public clearLogs(service?: 'twitch' | 'youtube' | 'other'): void {
    if (service) {
      this.logs = this.logs.filter(log => log.service !== service);
    } else {
      this.logs = [];
    }
  }

  /**
   * ID生成
   */
  public generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// シングルトンインスタンス
export const apiLogStore = new ApiLogStore();
