/**
 * システムメトリクス収集サービス
 * CPU使用率、メモリ使用量、稼働時間を定期的に収集
 */

export interface SystemMetrics {
  cpu: number; // CPU使用率（%）
  memory: number; // メモリ使用量（MB）
  uptime: number; // 稼働時間（秒）
  timestamp: string;
}

class SystemMetricsCollector {
  private collectInterval: NodeJS.Timeout | null = null;
  private latestMetrics: SystemMetrics | null = null;

  // CPU使用率計算用の前回値
  private previousCpuUsage: NodeJS.CpuUsage | null = null;
  private previousTime: number | null = null;

  /**
   * メトリクス収集を開始
   */
  start() {
    if (this.collectInterval) {
      console.warn('[SystemMetricsCollector] Already running');
      return;
    }

    // 初回収集
    this.collectMetrics();

    // 5秒間隔で収集
    this.collectInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000);

    console.log('[SystemMetricsCollector] Started (interval: 5 seconds)');
  }

  /**
   * メトリクス収集を停止
   */
  stop() {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = null;
      console.log('[SystemMetricsCollector] Stopped');
    }
  }

  /**
   * システムメトリクスを収集
   */
  private collectMetrics() {
    try {
      // CPU使用率を計算
      const cpuPercent = this.calculateCpuUsage();

      // メモリ使用量を取得
      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;

      // 稼働時間を取得
      const uptime = Math.round(process.uptime());

      this.latestMetrics = {
        cpu: Math.round(cpuPercent * 100) / 100, // 小数点2桁
        memory: memoryMB,
        uptime: uptime,
        timestamp: new Date().toISOString()
      };

      // console.log('[SystemMetricsCollector] Metrics collected:', this.latestMetrics);
    } catch (error) {
      console.error('[SystemMetricsCollector] Error collecting metrics:', error);
    }
  }

  /**
   * CPU使用率を計算（差分方式）
   * @returns CPU使用率（%）
   */
  private calculateCpuUsage(): number {
    const currentTime = Date.now();
    const currentCpuUsage = process.cpuUsage();

    // 初回実行時は0を返す
    if (this.previousCpuUsage === null || this.previousTime === null) {
      this.previousCpuUsage = currentCpuUsage;
      this.previousTime = currentTime;
      return 0;
    }

    // 経過時間を計算（ミリ秒 → 秒）
    const elapsedTime = (currentTime - this.previousTime) / 1000;

    // CPU時間の差分を計算（マイクロ秒 → 秒）
    const cpuTimeDelta =
      (currentCpuUsage.user - this.previousCpuUsage.user +
       currentCpuUsage.system - this.previousCpuUsage.system) / 1000000;

    // CPU使用率を計算（%）
    // cpuTimeDelta: プロセスが実際にCPUを使用した時間（秒）
    // elapsedTime: 経過した実時間（秒）
    // 使用率 = (CPU使用時間 / 経過時間) * 100
    const cpuPercent = (cpuTimeDelta / elapsedTime) * 100;

    // 次回のために保存
    this.previousCpuUsage = currentCpuUsage;
    this.previousTime = currentTime;

    // 0%未満や100%以上の異常値をクランプ
    return Math.max(0, Math.min(100, cpuPercent));
  }

  /**
   * 最新のシステムメトリクスを取得
   */
  getLatestMetrics(): SystemMetrics | null {
    return this.latestMetrics;
  }
}

// シングルトンインスタンス
export const systemMetricsCollector = new SystemMetricsCollector();
