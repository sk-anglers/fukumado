import os from 'os';
import process from 'process';

export interface SystemMetrics {
  cpu: {
    usage: number; // Node.jsプロセスのCPU使用率（%）
    count: number; // CPU コア数
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
    processUsedMB: number; // Node.jsプロセスのメモリ使用量
    processUsagePercent: number;
  };
  uptime: {
    systemSeconds: number;
    processSeconds: number;
  };
}

export class SystemMetricsService {
  private previousCPUUsage = process.cpuUsage();
  private previousTime = Date.now();

  /**
   * システムメトリクスを取得
   */
  public getSystemMetrics(): SystemMetrics {
    const cpuUsage = this.getCPUUsage();
    const memoryMetrics = this.getMemoryMetrics();
    const loadAverage = os.loadavg();

    return {
      cpu: {
        usage: cpuUsage,
        count: os.cpus().length,
        loadAverage: {
          oneMinute: loadAverage[0],
          fiveMinutes: loadAverage[1],
          fifteenMinutes: loadAverage[2],
        },
      },
      memory: memoryMetrics,
      uptime: {
        systemSeconds: os.uptime(),
        processSeconds: process.uptime(),
      },
    };
  }

  /**
   * Node.jsプロセスのCPU使用率を計算（%）
   */
  private getCPUUsage(): number {
    const currentCPUUsage = process.cpuUsage(this.previousCPUUsage);
    const currentTime = Date.now();
    const elapsedTime = currentTime - this.previousTime;

    // microseconds → milliseconds
    const totalCPUTime = (currentCPUUsage.user + currentCPUUsage.system) / 1000;

    // CPU使用率（%）= (CPU時間 / 経過時間) * 100
    const cpuPercent = (totalCPUTime / elapsedTime) * 100;

    // 次回の計算用に保存
    this.previousCPUUsage = process.cpuUsage();
    this.previousTime = currentTime;

    return Math.min(100, Math.max(0, cpuPercent));
  }

  /**
   * メモリメトリクスを取得
   */
  private getMemoryMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const processMemory = process.memoryUsage();
    const processUsedBytes = processMemory.rss; // Resident Set Size

    return {
      totalMB: Math.round(totalMemory / 1024 / 1024),
      freeMB: Math.round(freeMemory / 1024 / 1024),
      usedMB: Math.round(usedMemory / 1024 / 1024),
      usagePercent: Math.round((usedMemory / totalMemory) * 100 * 100) / 100,
      processUsedMB: Math.round(processUsedBytes / 1024 / 1024),
      processUsagePercent: Math.round((processUsedBytes / totalMemory) * 100 * 100) / 100,
    };
  }
}
