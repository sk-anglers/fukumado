import { redisClient } from './redisClient';
import { SystemMetrics, REDIS_KEYS, TTL } from '../types';
import { env } from '../config/env';

class MetricsCollector {
  private collectInterval: NodeJS.Timeout | null = null;
  private wsConnectionsCount: number = 0;
  // Redis未接続時のフォールバック用メモリストレージ
  private latestMetrics: SystemMetrics | null = null;

  /**
   * メトリクス収集を開始
   */
  start() {
    if (this.collectInterval) {
      console.warn('[MetricsCollector] Already running');
      return;
    }

    // 初回収集
    this.collectSystemMetrics();

    // 5秒間隔で収集
    this.collectInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 5000);

    console.log('[MetricsCollector] Started (interval: 5 seconds)');
  }

  /**
   * メトリクス収集を停止
   */
  stop() {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = null;
      console.log('[MetricsCollector] Stopped');
    }
  }

  /**
   * WebSocket接続数を設定
   */
  setWebSocketConnections(count: number) {
    this.wsConnectionsCount = count;
  }

  /**
   * システムメトリクスを収集
   */
  private async collectSystemMetrics() {
    try {
      // メインサーバーからシステムメトリクスを取得
      const systemMetrics = await this.getSystemMetricsFromMainServer();

      // WebSocket統計を取得
      const wsStats = await this.getWebSocketStats();

      const metrics: SystemMetrics = {
        cpu: systemMetrics.cpu,
        memory: systemMetrics.memory,
        uptime: systemMetrics.uptime,
        wsConnections: wsStats.totalConnections,
        activeWsConnections: wsStats.activeConnections,
        streamSyncCount: await this.getStreamSyncCount(),
        timestamp: new Date().toISOString()
      };

      // メモリに保存（Redis未接続時のフォールバック）
      this.latestMetrics = metrics;

      // Redisに保存（接続している場合のみ）
      if (redisClient.isReady()) {
        await redisClient.set(
          REDIS_KEYS.METRICS_SYSTEM_LATEST,
          JSON.stringify(metrics),
          TTL.METRICS_SHORT
        );

        // 個別のメトリクスも保存（グラフ用）
        await redisClient.set(
          REDIS_KEYS.METRICS_SYSTEM_CPU,
          metrics.cpu.toString(),
          TTL.METRICS_SHORT
        );
        await redisClient.set(
          REDIS_KEYS.METRICS_SYSTEM_MEMORY,
          metrics.memory.toString(),
          TTL.METRICS_SHORT
        );
        await redisClient.set(
          REDIS_KEYS.METRICS_SYSTEM_UPTIME,
          metrics.uptime.toString(),
          TTL.METRICS_SHORT
        );
        await redisClient.set(
          REDIS_KEYS.METRICS_WS_CONNECTIONS,
          metrics.wsConnections.toString(),
          TTL.METRICS_SHORT
        );
      }

      // console.log('[MetricsCollector] Metrics collected:', metrics);
    } catch (error) {
      console.error('[MetricsCollector] Error collecting metrics:', error);
    }
  }

  /**
   * メインサーバーからシステムメトリクス（CPU、メモリ、稼働時間）を取得
   */
  private async getSystemMetricsFromMainServer(): Promise<{ cpu: number; memory: number; uptime: number }> {
    try {
      const response = await fetch(`${env.mainBackendUrl}/api/admin/system/metrics`, {
        headers: {
          'X-Admin-API-Key': env.mainApiKey
        }
      });

      if (!response.ok) {
        console.warn('[MetricsCollector] Failed to fetch system metrics:', response.status);
        return { cpu: 0, memory: 0, uptime: 0 };
      }

      const result = await response.json() as {
        success: boolean;
        data: {
          cpu: number;
          memory: number;
          uptime: number;
        };
      };

      if (!result.success || !result.data) {
        return { cpu: 0, memory: 0, uptime: 0 };
      }

      return {
        cpu: result.data.cpu,
        memory: result.data.memory,
        uptime: result.data.uptime
      };
    } catch (error) {
      console.error('[MetricsCollector] Error getting system metrics from main server:', error);
      return { cpu: 0, memory: 0, uptime: 0 };
    }
  }

  /**
   * 配信同期数を取得（本サービスのAPIから）
   */
  private async getStreamSyncCount(): Promise<number> {
    try {
      // 本サービスの /api/admin/streams から配信数を取得（APIキー認証付き）
      const response = await fetch(`${env.mainBackendUrl}/api/admin/streams`, {
        headers: {
          'X-Admin-API-Key': env.mainApiKey
        }
      });

      if (!response.ok) {
        console.warn('[MetricsCollector] Failed to fetch streams:', response.status);
        return 0;
      }

      const result = await response.json() as {
        success: boolean;
        data: {
          stats: {
            isRunning: boolean;
            userCount: number;
            youtubeStreamCount: number;
            twitchStreamCount: number;
          };
        };
      };

      if (!result.success || !result.data.stats) {
        return 0;
      }

      return result.data.stats.youtubeStreamCount + result.data.stats.twitchStreamCount;
    } catch (error) {
      console.error('[MetricsCollector] Error getting stream sync count:', error);
      return 0;
    }
  }

  /**
   * WebSocket統計を取得（本サービスのAPIから）
   */
  private async getWebSocketStats(): Promise<{ totalConnections: number; activeConnections: number }> {
    try {
      const response = await fetch(`${env.mainBackendUrl}/api/admin/websocket/stats`, {
        headers: {
          'X-Admin-API-Key': env.mainApiKey
        }
      });

      if (!response.ok) {
        console.warn('[MetricsCollector] Failed to fetch WebSocket stats:', response.status);
        return { totalConnections: 0, activeConnections: 0 };
      }

      const result = await response.json() as {
        success: boolean;
        data: {
          totalConnections: number;
          activeConnections: number;
          zombieConnections: number;
        };
      };

      if (!result.success || !result.data) {
        return { totalConnections: 0, activeConnections: 0 };
      }

      return {
        totalConnections: result.data.totalConnections,
        activeConnections: result.data.activeConnections
      };
    } catch (error) {
      console.error('[MetricsCollector] Error getting WebSocket stats:', error);
      return { totalConnections: 0, activeConnections: 0 };
    }
  }

  /**
   * 最新のシステムメトリクスを取得
   */
  async getLatestMetrics(): Promise<SystemMetrics | null> {
    try {
      // まずRedisから取得を試みる
      if (redisClient.isReady()) {
        const data = await redisClient.get(REDIS_KEYS.METRICS_SYSTEM_LATEST);
        if (data) {
          return JSON.parse(data) as SystemMetrics;
        }
      }

      // Redis未接続またはデータがない場合はメモリから返す
      return this.latestMetrics;
    } catch (error) {
      console.error('[MetricsCollector] Error getting latest metrics:', error);
      // エラー時もメモリのデータを返す
      return this.latestMetrics;
    }
  }
}

// シングルトンインスタンス
export const metricsCollector = new MetricsCollector();
