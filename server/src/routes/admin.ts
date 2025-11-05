import { Router, Request, Response } from 'express';
import { followedChannelsCacheService } from '../services/followedChannelsCacheService';
import { emoteCacheService } from '../services/emoteCacheService';
import { apiLogStore } from '../utils/apiLogStore';
import { getWebSocketStats, pvTracker, analyticsTracker, streamSyncService } from '../index';
import { systemMetricsCollector } from '../services/systemMetricsCollector';
import { priorityManager } from '../services/priorityManager';
import { ipBlocklist } from '../middleware/security';
import { SystemMetricsService } from '../services/systemMetricsService';
import { DatabaseMetricsService } from '../services/databaseMetricsService';
import { auditLogService } from '../services/auditLogService';
import { alertService, AlertType, AlertSeverity } from '../services/alertService';
import prisma from '../services/prismaService';

export const adminRouter = Router();

// インスタンス作成
const systemMetricsService = new SystemMetricsService();
const databaseMetricsService = new DatabaseMetricsService();

/**
 * GET /api/admin/system/metrics
 * システムメトリクス（CPU、メモリ、稼働時間）を取得
 */
adminRouter.get('/system/metrics', (req: Request, res: Response) => {
  try {
    const metrics = systemMetricsCollector.getLatestMetrics();

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'No metrics available',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting system metrics:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/memory-cache/stats
 * メモリキャッシュの統計情報を取得
 */
adminRouter.get('/memory-cache/stats', (req: Request, res: Response) => {
  try {
    const followedChannelsStats = followedChannelsCacheService.getStats();
    const emoteStats = emoteCacheService.getStats();

    res.json({
      success: true,
      data: {
        followedChannels: followedChannelsStats,
        emotes: emoteStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting memory cache stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/memory-cache/clear
 * メモリキャッシュをクリア
 */
adminRouter.delete('/memory-cache/clear', (req: Request, res: Response) => {
  try {
    const clearType = req.query.type as string | undefined;

    if (!clearType || clearType === 'all') {
      // すべてのキャッシュをクリア
      followedChannelsCacheService.clearAll();
      emoteCacheService.clearAll();
      console.log('[Admin] Cleared all memory caches');

      res.json({
        success: true,
        data: {
          cleared: ['followedChannels', 'emotes']
        },
        timestamp: new Date().toISOString()
      });
    } else if (clearType === 'followedChannels') {
      // フォローチャンネルキャッシュのみクリア
      followedChannelsCacheService.clearAll();
      console.log('[Admin] Cleared followed channels cache');

      res.json({
        success: true,
        data: {
          cleared: ['followedChannels']
        },
        timestamp: new Date().toISOString()
      });
    } else if (clearType === 'emotes') {
      // エモートキャッシュのみクリア
      emoteCacheService.clearAll();
      console.log('[Admin] Cleared emotes cache');

      res.json({
        success: true,
        data: {
          cleared: ['emotes']
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid cache type. Use: all, followedChannels, or emotes',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[Admin] Error clearing memory cache:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/memory-cache/cleanup
 * 期限切れエントリをクリーンアップ
 */
adminRouter.post('/memory-cache/cleanup', (req: Request, res: Response) => {
  try {
    const followedChannelsRemoved = followedChannelsCacheService.manualCleanup();
    const emotesRemoved = emoteCacheService.manualCleanup();

    console.log('[Admin] Manual cleanup completed:', {
      followedChannelsRemoved,
      emotesRemoved
    });

    res.json({
      success: true,
      data: {
        followedChannelsRemoved,
        emotesRemoved,
        totalRemoved: followedChannelsRemoved + emotesRemoved
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error during cleanup:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/api-tracking/rate-limit
 * Twitchレート制限情報を取得
 */
adminRouter.get('/api-tracking/rate-limit', (req: Request, res: Response) => {
  try {
    const rateLimit = apiLogStore.getLatestTwitchRateLimit();

    res.json({
      success: true,
      data: rateLimit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting rate limit:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/api-tracking/youtube-quota
 * YouTubeクォータ使用量を取得
 */
adminRouter.get('/api-tracking/youtube-quota', (req: Request, res: Response) => {
  try {
    const quotaUsage = apiLogStore.getTodayYouTubeQuotaUsage();

    res.json({
      success: true,
      data: {
        usedToday: quotaUsage,
        totalQuota: 10000,
        remaining: 10000 - quotaUsage,
        usagePercent: (quotaUsage / 10000) * 100
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting YouTube quota:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/api-monitor/logs
 * API監視ログ一覧を取得
 */
adminRouter.get('/api-monitor/logs', (req: Request, res: Response) => {
  try {
    const service = req.query.service as 'twitch' | 'youtube' | 'other' | undefined;
    const statusCodeStr = req.query.statusCode as string | undefined;
    const statusCode = statusCodeStr ? parseInt(statusCodeStr, 10) : undefined;
    const limitStr = req.query.limit as string | undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const offsetStr = req.query.offset as string | undefined;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    console.log('[Admin] GET /api-monitor/logs - params:', { service, statusCode, limit, offset });

    const result = apiLogStore.getLogs({
      service,
      statusCode,
      limit,
      offset
    });

    console.log('[Admin] Returning', result.logs.length, 'logs, total:', result.total);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting API logs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/api-monitor/stats
 * API統計情報を取得
 */
adminRouter.get('/api-monitor/stats', (req: Request, res: Response) => {
  try {
    const service = req.query.service as 'twitch' | 'youtube' | 'other' | undefined;

    console.log('[Admin] GET /api-monitor/stats - service:', service);

    const stats = apiLogStore.getStats(service);

    console.log('[Admin] Returning stats:', stats);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting API stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/websocket/stats
 * WebSocket接続統計を取得
 */
adminRouter.get('/websocket/stats', (req: Request, res: Response) => {
  try {
    const stats = getWebSocketStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting WebSocket stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/pv/stats
 * PV統計を取得
 */
adminRouter.get('/pv/stats', async (req: Request, res: Response) => {
  try {
    const stats = await pvTracker.getAllStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting PV stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/pv/export
 * PV統計をエクスポート（JSON/CSV）
 */
adminRouter.get('/pv/export', async (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'json';
    const stats = await pvTracker.getAllStats();

    if (format === 'csv') {
      // CSV形式でエクスポート
      let csv = 'Date,PV,Unique Users\n';

      // 日次データ
      stats.daily.forEach((day) => {
        csv += `${day.date},${day.pv},${day.uniqueUsers}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pv-stats-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      // JSON形式でエクスポート
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="pv-stats-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(stats);
    }
  } catch (error) {
    console.error('[Admin] Error exporting PV stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/pv/backup
 * PV統計を手動でバックアップ
 */
adminRouter.post('/pv/backup', async (req: Request, res: Response) => {
  try {
    const filepath = await pvTracker.backupToFile();

    res.json({
      success: true,
      data: {
        filepath,
        message: 'Backup completed successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error backing up PV stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// アナリティクス統計API
// ========================================

/**
 * GET /api/admin/analytics/stats
 * アナリティクス統計を取得
 */
adminRouter.get('/analytics/stats', async (req: Request, res: Response) => {
  try {
    const daysParam = req.query.days as string | undefined;
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    if (!analyticsTracker) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available',
        timestamp: new Date().toISOString()
      });
    }

    const stats = await analyticsTracker.getStats(days);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting analytics stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/analytics/export
 * アナリティクス統計をエクスポート（CSV/JSON）
 */
adminRouter.get('/analytics/export', async (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'json';
    const daysParam = req.query.days as string | undefined;
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    if (!analyticsTracker) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const stats = await analyticsTracker.getStats(days);

    if (format === 'csv') {
      // CSV形式でエクスポート
      let csv = 'Date,Events,Sessions,Unique Users\n';

      stats.timeline.daily.forEach((day: any) => {
        csv += `${day.date},${day.events},${day.sessions},${day.uniqueUsers}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      // JSON形式でエクスポート
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(stats);
    }
  } catch (error) {
    console.error('[Admin] Error exporting analytics stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// 動的閾値API
// ========================================

/**
 * GET /api/admin/threshold/info
 * 動的閾値情報を取得
 */
adminRouter.get('/threshold/info', (req: Request, res: Response) => {
  try {
    const thresholdInfo = priorityManager.getThresholdInfo();
    const syncStats = streamSyncService.getStats();

    res.json({
      success: true,
      data: {
        ...thresholdInfo,
        pollingChannels: syncStats.pollingChannels
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting threshold info:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// セキュリティ管理API
// ========================================

/**
 * GET /api/admin/security/blocked-ips
 * ブロックされているIPリストを取得
 */
adminRouter.get('/security/blocked-ips', (req: Request, res: Response) => {
  try {
    const blockedIPs = ipBlocklist.getBlockedIPs();

    res.json({
      success: true,
      data: {
        blockedIPs,
        count: blockedIPs.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting blocked IPs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/security/unblock-ip
 * 特定のIPのブロックを解除
 */
adminRouter.post('/security/unblock-ip', (req: Request, res: Response) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required',
        timestamp: new Date().toISOString()
      });
    }

    const wasBlocked = ipBlocklist.unblock(ip);

    res.json({
      success: true,
      data: {
        ip,
        wasBlocked,
        message: wasBlocked ? `IP ${ip} has been unblocked` : `IP ${ip} was not blocked`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error unblocking IP:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/security/clear-all-blocks
 * すべてのIPブロックを解除
 */
adminRouter.post('/security/clear-all-blocks', (req: Request, res: Response) => {
  try {
    ipBlocklist.clear();

    res.json({
      success: true,
      data: {
        message: 'All IP blocks have been cleared'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error clearing all blocks:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/security/whitelisted-ips
 * ホワイトリストに登録されているIPリストを取得
 */
adminRouter.get('/security/whitelisted-ips', (req: Request, res: Response) => {
  try {
    const whitelistedIPs = ipBlocklist.getWhitelistedIPs();

    res.json({
      success: true,
      data: {
        whitelistedIPs,
        count: whitelistedIPs.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting whitelisted IPs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/security/whitelist-ip
 * IPをホワイトリストに追加
 */
adminRouter.post('/security/whitelist-ip', async (req: Request, res: Response) => {
  try {
    const { ip, reason } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required',
        timestamp: new Date().toISOString()
      });
    }

    await ipBlocklist.addToWhitelist(ip, reason);

    res.json({
      success: true,
      data: {
        ip,
        whitelisted: true,
        message: `IP ${ip} has been added to whitelist`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error whitelisting IP:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/security/remove-from-whitelist
 * IPをホワイトリストから削除
 */
adminRouter.post('/security/remove-from-whitelist', async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required',
        timestamp: new Date().toISOString()
      });
    }

    const wasWhitelisted = await ipBlocklist.removeFromWhitelist(ip);

    res.json({
      success: true,
      data: {
        ip,
        wasWhitelisted,
        message: wasWhitelisted ? `IP ${ip} has been removed from whitelist` : `IP ${ip} was not whitelisted`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error removing IP from whitelist:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========================================
// データベースメトリクスAPI
// ========================================

/**
 * GET /api/admin/database/stats
 * データベース統計情報を取得
 */
adminRouter.get('/database/stats', async (req: Request, res: Response) => {
  try {
    const stats = await databaseMetricsService.getDatabaseStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting database stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/database/connections
 * データベース接続情報を取得
 */
adminRouter.get('/database/connections', async (req: Request, res: Response) => {
  try {
    const connections = await databaseMetricsService.getConnectionStats();

    res.json({
      success: true,
      data: connections,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting database connections:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/database/tables
 * テーブル統計情報を取得
 */
adminRouter.get('/database/tables', async (req: Request, res: Response) => {
  try {
    const tables = await databaseMetricsService.getTableStats();

    res.json({
      success: true,
      data: tables,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting database tables:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/database/queries
 * アクティブなクエリを取得
 */
adminRouter.get('/database/queries', async (req: Request, res: Response) => {
  try {
    const queries = await databaseMetricsService.getActiveQueries();

    res.json({
      success: true,
      data: queries,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting active queries:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/system/detailed-metrics
 * 詳細なシステムメトリクスを取得（CPU、メモリ、ロードアベレージ）
 */
adminRouter.get('/system/detailed-metrics', (req: Request, res: Response) => {
  try {
    const metrics = systemMetricsService.getSystemMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting detailed system metrics:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/database/migrate-severity
 * security_logs の severity 制約を修正（warn を許可）
 */
adminRouter.post('/database/migrate-severity', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'];

  try {
    console.log('[Admin] Running severity constraint migration...');

    // Drop existing constraint
    await prisma.$executeRawUnsafe(`
      ALTER TABLE security_logs DROP CONSTRAINT IF EXISTS security_logs_severity_check;
    `);
    console.log('[Admin] ✓ Dropped existing constraint');

    // Add new constraint that allows 'info', 'warn', 'error'
    await prisma.$executeRawUnsafe(`
      ALTER TABLE security_logs ADD CONSTRAINT security_logs_severity_check
        CHECK (severity IN ('info', 'warn', 'error'));
    `);
    console.log('[Admin] ✓ Added new constraint (allows: info, warn, error)');

    // 監査ログ記録
    await auditLogService.log({
      action: 'database_migration_severity',
      actor: 'admin',
      actorIp: ip,
      actorAgent: userAgent,
      targetType: 'database',
      targetId: 'security_logs',
      details: { migration: 'severity_constraint', allowedValues: ['info', 'warn', 'error'] },
      status: 'success'
    });

    res.json({
      success: true,
      data: {
        message: 'Migration completed successfully',
        allowedValues: ['info', 'warn', 'error']
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error running migration:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // 監査ログ記録（失敗）
    await auditLogService.log({
      action: 'database_migration_severity',
      actor: 'admin',
      actorIp: ip,
      actorAgent: userAgent,
      targetType: 'database',
      targetId: 'security_logs',
      status: 'failure',
      errorMessage: message
    });

    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// 監査ログ (Audit Log)
// ============================================

/**
 * GET /api/admin/audit-logs
 * 監査ログ一覧を取得
 */
adminRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const {
      limit,
      offset,
      action,
      actor,
      actorIp,
      targetType,
      status,
      startDate,
      endDate
    } = req.query;

    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (offset) options.offset = parseInt(offset as string);
    if (action) options.action = action as string;
    if (actor) options.actor = actor as string;
    if (actorIp) options.actorIp = actorIp as string;
    if (targetType) options.targetType = targetType as string;
    if (status) options.status = status as 'success' | 'failure';
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);

    const result = await auditLogService.getLogs(options);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting audit logs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/audit-logs/summary
 * 監査ログサマリーを取得
 */
adminRouter.get('/audit-logs/summary', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    const summary = await auditLogService.getSummary(days);

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting audit log summary:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/audit-logs/cleanup
 * 古い監査ログをクリーンアップ
 */
adminRouter.post('/audit-logs/cleanup', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'];

  try {
    const { days = 90 } = req.body;
    const deletedCount = await auditLogService.cleanup(days);

    // 監査ログ記録
    await auditLogService.log({
      action: 'audit_log_cleanup',
      actor: 'admin',
      actorIp: ip,
      actorAgent: userAgent,
      targetType: 'system',
      details: { days, deletedCount },
      status: 'success'
    });

    res.json({
      success: true,
      data: { deletedCount, days },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error cleaning up audit logs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // 監査ログ記録（失敗）
    await auditLogService.log({
      action: 'audit_log_cleanup',
      actor: 'admin',
      actorIp: ip,
      actorAgent: userAgent,
      targetType: 'system',
      status: 'failure',
      errorMessage: message
    });

    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/database/migrate-audit-logs
 * audit_logsテーブルを作成（初回セットアップ用）
 */
adminRouter.post('/database/migrate-audit-logs', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'];

  try {
    console.log('[Admin] Creating audit_logs table...');

    // テーブル作成SQL実行
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        actor VARCHAR(255) NOT NULL,
        actor_ip VARCHAR(45) NOT NULL,
        actor_agent TEXT,
        target_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(255),
        details JSONB,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Admin] ✓ Created audit_logs table');

    // インデックス作成
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON audit_logs(action, created_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at ON audit_logs(actor, created_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_ip_created_at ON audit_logs(actor_ip, created_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type_created_at ON audit_logs(target_type, created_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_status_created_at ON audit_logs(status, created_at DESC);
    `);
    console.log('[Admin] ✓ Created indexes');

    // Prisma Clientを再生成（非同期で実行、応答には含めない）
    console.log('[Admin] Note: Run "npx prisma generate" to update Prisma Client');

    // 初回の監査ログを記録（テーブルが作成されたので記録可能）
    await auditLogService.log({
      action: 'database_migration_audit_logs',
      actor: 'admin',
      actorIp: ip,
      actorAgent: userAgent,
      targetType: 'database',
      targetId: 'audit_logs',
      details: { migration: 'create_audit_logs_table' },
      status: 'success'
    });

    res.json({
      success: true,
      data: {
        message: 'Audit logs table created successfully',
        note: 'Run "npx prisma generate" to update Prisma Client'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error creating audit_logs table:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// アラート・通知 (Alerts & Notifications)
// ============================================

/**
 * GET /api/admin/alerts
 * アラート一覧を取得
 */
adminRouter.get('/alerts', async (req: Request, res: Response) => {
  try {
    const {
      limit,
      offset,
      type,
      severity,
      acknowledged,
      resolved
    } = req.query;

    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (offset) options.offset = parseInt(offset as string);
    if (type) options.type = type as AlertType;
    if (severity) options.severity = severity as AlertSeverity;
    if (acknowledged !== undefined) options.acknowledged = acknowledged === 'true';
    if (resolved !== undefined) options.resolved = resolved === 'true';

    const result = await alertService.getAlerts(options);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting alerts:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/alerts/unread-count
 * 未読アラート数を取得
 */
adminRouter.get('/alerts/unread-count', async (req: Request, res: Response) => {
  try {
    const count = await alertService.getUnreadCount();

    res.json({
      success: true,
      data: { count },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting unread alert count:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/alerts/:id/acknowledge
 * アラートを確認済みにする
 */
adminRouter.post('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;

    if (!acknowledgedBy) {
      return res.status(400).json({
        success: false,
        error: 'acknowledgedBy is required',
        timestamp: new Date().toISOString()
      });
    }

    await alertService.acknowledgeAlert(id, acknowledgedBy);

    res.json({
      success: true,
      data: { message: 'Alert acknowledged' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error acknowledging alert:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/alerts/:id/resolve
 * アラートを解決済みにする
 */
adminRouter.post('/alerts/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await alertService.resolveAlert(id);

    res.json({
      success: true,
      data: { message: 'Alert resolved' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error resolving alert:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/alert-settings
 * アラート設定を取得
 */
adminRouter.get('/alert-settings', async (req: Request, res: Response) => {
  try {
    const settings = await alertService.getSettings();

    res.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting alert settings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/admin/alert-settings/:type
 * アラート設定を更新
 */
adminRouter.put('/alert-settings/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { enabled, threshold, notifyEmail, notifySlack, notifyWebhook } = req.body;

    const data: any = {};
    if (enabled !== undefined) data.enabled = enabled;
    if (threshold !== undefined) data.threshold = threshold;
    if (notifyEmail !== undefined) data.notifyEmail = notifyEmail;
    if (notifySlack !== undefined) data.notifySlack = notifySlack;
    if (notifyWebhook !== undefined) data.notifyWebhook = notifyWebhook;

    await alertService.updateSetting(type as AlertType, data);

    res.json({
      success: true,
      data: { message: 'Alert setting updated' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error updating alert setting:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/database/migrate-alerts
 * alerts と alert_settings テーブルを作成
 */
adminRouter.post('/database/migrate-alerts', async (req: Request, res: Response) => {
  try {
    console.log('[Admin] Creating alerts and alert_settings tables...');

    // alerts テーブル作成
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS alerts (
        id BIGSERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        details JSONB,
        acknowledged BOOLEAN NOT NULL DEFAULT false,
        acknowledged_at TIMESTAMPTZ(6),
        acknowledged_by VARCHAR(255),
        resolved BOOLEAN NOT NULL DEFAULT false,
        resolved_at TIMESTAMPTZ(6),
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Admin] ✓ Created alerts table');

    // インデックス作成
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_type_created_at_idx ON alerts (type, created_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_severity_created_at_idx ON alerts (severity, created_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_acknowledged_created_at_idx ON alerts (acknowledged, created_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_resolved_created_at_idx ON alerts (resolved, created_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts (created_at DESC);
    `);
    console.log('[Admin] ✓ Created alerts indexes');

    // alert_settings テーブル作成
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS alert_settings (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) UNIQUE NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        threshold DOUBLE PRECISION,
        notify_email BOOLEAN NOT NULL DEFAULT false,
        notify_slack BOOLEAN NOT NULL DEFAULT false,
        notify_webhook BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Admin] ✓ Created alert_settings table');

    // デフォルト設定を挿入
    await prisma.$executeRawUnsafe(`
      INSERT INTO alert_settings (type, enabled, threshold, notify_email, notify_slack, notify_webhook) VALUES
        ('cpu_high', true, 80.0, false, false, false),
        ('memory_high', true, 85.0, false, false, false),
        ('rate_limit_low', true, 20.0, false, false, false),
        ('quota_low', true, 10.0, false, false, false),
        ('security', true, NULL, false, false, false),
        ('error_spike', true, NULL, false, false, false)
      ON CONFLICT (type) DO NOTHING;
    `);
    console.log('[Admin] ✓ Inserted default alert settings');

    console.log('[Admin] Alerts tables created successfully');

    // 監査ログに記録
    await auditLogService.log({
      action: 'database_migration_alerts',
      actor: 'admin',
      actorIp: req.ip || 'unknown',
      actorAgent: req.headers['user-agent'],
      targetType: 'database',
      targetId: 'alerts',
      details: {
        description: 'Created alerts and alert_settings tables'
      },
      status: 'success'
    });

    res.json({
      success: true,
      data: {
        message: 'Alerts tables created successfully',
        tables: ['alerts', 'alert_settings']
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error creating alerts tables:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * エラーテストモードの状態管理（メモリ）
 */
let errorTestModeEnabled = false;

/**
 * GET /api/admin/test/error/status
 * エラーテストモードの状態を取得
 */
adminRouter.get('/test/error/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: errorTestModeEnabled
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/admin/test/error/enable
 * エラーテストモードを有効化
 */
adminRouter.post('/test/error/enable', async (req: Request, res: Response) => {
  try {
    errorTestModeEnabled = true;

    // 監査ログに記録
    await auditLogService.log({
      action: 'enable_error_test_mode',
      actor: 'admin',
      actorIp: req.ip || 'unknown',
      actorAgent: req.headers['user-agent'],
      targetType: 'system',
      targetId: 'error_test_mode',
      details: {
        description: 'Enabled error test mode'
      },
      status: 'success'
    });

    console.log('[Admin] Error test mode enabled');

    res.json({
      success: true,
      data: {
        enabled: true,
        message: 'Error test mode enabled. Main service will throw an error on next page load.'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error enabling error test mode:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/test/error/disable
 * エラーテストモードを無効化
 */
adminRouter.post('/test/error/disable', async (req: Request, res: Response) => {
  try {
    errorTestModeEnabled = false;

    // 監査ログに記録
    await auditLogService.log({
      action: 'disable_error_test_mode',
      actor: 'admin',
      actorIp: req.ip || 'unknown',
      actorAgent: req.headers['user-agent'],
      targetType: 'system',
      targetId: 'error_test_mode',
      details: {
        description: 'Disabled error test mode'
      },
      status: 'success'
    });

    console.log('[Admin] Error test mode disabled');

    res.json({
      success: true,
      data: {
        enabled: false,
        message: 'Error test mode disabled'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error disabling error test mode:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});
