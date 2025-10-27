import { Router, Request, Response } from 'express';
import { ipBlocklist } from '../middleware/security';
import { wsConnectionManager } from '../middleware/websocketSecurity';
import { anomalyDetectionService } from '../services/anomalyDetection';
import { accessLogStats } from '../middleware/logging';
import { query } from 'express-validator';
import { handleValidationErrors, validateNumberRange } from '../middleware/validation';
import { metricsCollector } from '../services/metricsCollector';
import { securityReporter } from '../services/securityReporter';
import { sessionStats } from '../middleware/sessionSecurity';
import { emoteCacheService } from '../services/emoteCacheService';
import { followedChannelsCacheService } from '../services/followedChannelsCacheService';

export const securityRouter = Router();

/**
 * GET /api/security/stats
 * セキュリティ統計情報を取得
 */
securityRouter.get('/stats', (req: Request, res: Response) => {
  try {
    // IP Blocklist統計
    const blocklistStats = ipBlocklist.getStats();

    // WebSocket接続統計
    const wsStats = wsConnectionManager.getStats();

    // 異常検知統計
    const anomalyStats = anomalyDetectionService.getStats();

    // アクセスログ統計
    const accessStats = accessLogStats.getStats();

    const stats = {
      timestamp: new Date().toISOString(),
      ipBlocklist: blocklistStats,
      websocket: wsStats,
      anomalyDetection: anomalyStats,
      accessLog: accessStats,
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('[Security API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch security statistics' });
  }
});

/**
 * GET /api/security/alerts
 * 異常検知アラート一覧を取得
 */
securityRouter.get(
  '/alerts',
  [
    validateNumberRange('limit', 1, 100, 'query'),
    handleValidationErrors
  ],
  (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const alerts = anomalyDetectionService.getAlerts(limit);

      res.json({
        total: alerts.length,
        limit,
        alerts
      });
    } catch (error) {
      console.error('[Security API] Error fetching alerts:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  }
);

/**
 * GET /api/security/alerts/:ip
 * 特定のIPのアラートを取得
 */
securityRouter.get(
  '/alerts/:ip',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    handleValidationErrors
  ],
  (req: Request, res: Response) => {
    try {
      const ip = req.params.ip;
      const limit = parseInt(req.query.limit as string) || 50;

      const alerts = anomalyDetectionService.getAlertsByIP(ip, limit);

      res.json({
        ip,
        total: alerts.length,
        limit,
        alerts
      });
    } catch (error) {
      console.error('[Security API] Error fetching alerts for IP:', error);
      res.status(500).json({ error: 'Failed to fetch alerts for IP' });
    }
  }
);

/**
 * POST /api/security/alerts/clear
 * アラートをクリア（管理者用）
 */
securityRouter.post('/alerts/clear', (req: Request, res: Response) => {
  try {
    anomalyDetectionService.clearAlerts();
    res.json({ success: true, message: 'Alerts cleared successfully' });
  } catch (error) {
    console.error('[Security API] Error clearing alerts:', error);
    res.status(500).json({ error: 'Failed to clear alerts' });
  }
});

/**
 * GET /api/security/blocked-ips
 * ブロックされたIPの一覧を取得
 */
securityRouter.get('/blocked-ips', (req: Request, res: Response) => {
  try {
    const stats = ipBlocklist.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[Security API] Error fetching blocked IPs:', error);
    res.status(500).json({ error: 'Failed to fetch blocked IPs' });
  }
});

/**
 * GET /api/security/websocket-connections
 * WebSocket接続状況を取得
 */
securityRouter.get('/websocket-connections', (req: Request, res: Response) => {
  try {
    const stats = wsConnectionManager.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[Security API] Error fetching WebSocket stats:', error);
    res.status(500).json({ error: 'Failed to fetch WebSocket statistics' });
  }
});

/**
 * GET /api/security/access-logs
 * アクセスログ統計を取得
 */
securityRouter.get('/access-logs', (req: Request, res: Response) => {
  try {
    const stats = accessLogStats.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[Security API] Error fetching access log stats:', error);
    res.status(500).json({ error: 'Failed to fetch access log statistics' });
  }
});

/**
 * POST /api/security/access-logs/reset
 * アクセスログ統計をリセット
 */
securityRouter.post('/access-logs/reset', (req: Request, res: Response) => {
  try {
    accessLogStats.reset();
    res.json({ success: true, message: 'Access log statistics reset successfully' });
  } catch (error) {
    console.error('[Security API] Error resetting access logs:', error);
    res.status(500).json({ error: 'Failed to reset access log statistics' });
  }
});

/**
 * GET /api/security/health
 * セキュリティシステムのヘルスチェック
 */
securityRouter.get('/health', (req: Request, res: Response) => {
  try {
    const anomalyStats = anomalyDetectionService.getStats();
    const wsStats = wsConnectionManager.getStats();
    const blocklistStats = ipBlocklist.getStats();

    // 重大なアラートがあるかチェック
    const criticalAlerts = anomalyStats.alertsBySeverity['critical'] || 0;
    const highAlerts = anomalyStats.alertsBySeverity['high'] || 0;

    const status = criticalAlerts > 0 ? 'critical' : highAlerts > 5 ? 'warning' : 'healthy';

    res.json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        anomalyDetection: {
          status: criticalAlerts === 0 ? 'ok' : 'alert',
          criticalAlerts,
          highAlerts,
          recentAlerts: anomalyStats.recentAlerts
        },
        websocket: {
          status: wsStats.totalConnections < wsStats.maxConnectionsPerIP * 100 ? 'ok' : 'warning',
          totalConnections: wsStats.totalConnections,
          maxPerIP: wsStats.maxConnectionsPerIP
        },
        ipBlocklist: {
          status: 'ok',
          blockedIPs: blocklistStats.blockedCount,
          violationRecords: blocklistStats.violationCount
        },
        system: {
          status: 'ok',
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
        }
      }
    });
  } catch (error) {
    console.error('[Security API] Error checking health:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to check security system health'
    });
  }
});

/**
 * GET /api/security/metrics
 * Prometheus形式のメトリクス（強化版）
 */
securityRouter.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = metricsCollector.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics);
  } catch (error) {
    console.error('[Security API] Error generating metrics:', error);
    res.status(500).send('Failed to generate metrics');
  }
});

/**
 * GET /api/security/metrics/json
 * JSON形式のメトリクス
 */
securityRouter.get('/metrics/json', (req: Request, res: Response) => {
  try {
    const metrics = metricsCollector.getMetricsJSON();
    res.json(metrics);
  } catch (error) {
    console.error('[Security API] Error generating JSON metrics:', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

/**
 * GET /api/security/report/daily
 * 日次セキュリティレポートを生成
 */
securityRouter.get('/report/daily', (req: Request, res: Response) => {
  try {
    const report = securityReporter.generateDailyReport();
    res.json(report);
  } catch (error) {
    console.error('[Security API] Error generating daily report:', error);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

/**
 * GET /api/security/report/weekly
 * 週次セキュリティレポートを生成
 */
securityRouter.get('/report/weekly', (req: Request, res: Response) => {
  try {
    const report = securityReporter.generateWeeklyReport();
    res.json(report);
  } catch (error) {
    console.error('[Security API] Error generating weekly report:', error);
    res.status(500).json({ error: 'Failed to generate weekly report' });
  }
});

/**
 * GET /api/security/report/summary
 * セキュリティサマリー（軽量版）
 */
securityRouter.get('/report/summary', (req: Request, res: Response) => {
  try {
    const summary = securityReporter.getQuickSummary();
    res.json(summary);
  } catch (error) {
    console.error('[Security API] Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

/**
 * GET /api/security/report/export
 * レポートをMarkdown形式でエクスポート
 */
securityRouter.get('/report/export', (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'markdown';
    const period = req.query.period as string || 'daily';

    let report;
    if (period === 'weekly') {
      report = securityReporter.generateWeeklyReport();
    } else {
      report = securityReporter.generateDailyReport();
    }

    switch (format) {
      case 'json':
        res.set('Content-Type', 'application/json');
        res.set('Content-Disposition', `attachment; filename="security-report-${Date.now()}.json"`);
        res.send(securityReporter.exportJSON(report));
        break;

      case 'csv':
        res.set('Content-Type', 'text/csv');
        res.set('Content-Disposition', `attachment; filename="security-report-${Date.now()}.csv"`);
        res.send(securityReporter.exportCSV(report));
        break;

      case 'markdown':
      default:
        res.set('Content-Type', 'text/markdown');
        res.set('Content-Disposition', `attachment; filename="security-report-${Date.now()}.md"`);
        res.send(securityReporter.exportMarkdown(report));
        break;
    }
  } catch (error) {
    console.error('[Security API] Error exporting report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

/**
 * GET /api/security/sessions
 * セッション統計情報を取得
 */
securityRouter.get('/sessions', (req: Request, res: Response) => {
  try {
    const stats = sessionStats.getStats();
    res.json(stats);
  } catch (error) {
    console.error('[Security API] Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session statistics' });
  }
});

/**
 * GET /api/security/cache/emotes
 * エモートキャッシュ統計情報を取得
 */
securityRouter.get('/cache/emotes', (req: Request, res: Response) => {
  try {
    const stats = emoteCacheService.getStats();
    res.json({
      timestamp: new Date().toISOString(),
      cache: stats
    });
  } catch (error) {
    console.error('[Security API] Error fetching emote cache stats:', error);
    res.status(500).json({ error: 'Failed to fetch emote cache statistics' });
  }
});

/**
 * POST /api/security/cache/emotes/clear
 * エモートキャッシュをクリア（管理者用）
 */
securityRouter.post('/cache/emotes/clear', (req: Request, res: Response) => {
  try {
    emoteCacheService.clearAll();
    res.json({ success: true, message: 'Emote cache cleared successfully' });
  } catch (error) {
    console.error('[Security API] Error clearing emote cache:', error);
    res.status(500).json({ error: 'Failed to clear emote cache' });
  }
});

/**
 * POST /api/security/cache/emotes/cleanup
 * エモートキャッシュの期限切れエントリをクリーンアップ（管理者用）
 */
securityRouter.post('/cache/emotes/cleanup', (req: Request, res: Response) => {
  try {
    const removed = emoteCacheService.manualCleanup();
    res.json({
      success: true,
      message: `Cleaned up ${removed} expired entries`,
      removed
    });
  } catch (error) {
    console.error('[Security API] Error cleaning up emote cache:', error);
    res.status(500).json({ error: 'Failed to cleanup emote cache' });
  }
});

/**
 * GET /api/security/cache/followed-channels
 * フォローチャンネルキャッシュ統計情報を取得
 */
securityRouter.get('/cache/followed-channels', (req: Request, res: Response) => {
  try {
    const stats = followedChannelsCacheService.getStats();
    res.json({
      timestamp: new Date().toISOString(),
      cache: stats
    });
  } catch (error) {
    console.error('[Security API] Error fetching followed channels cache stats:', error);
    res.status(500).json({ error: 'Failed to fetch followed channels cache statistics' });
  }
});

/**
 * POST /api/security/cache/followed-channels/clear
 * フォローチャンネルキャッシュをクリア（管理者用）
 */
securityRouter.post('/cache/followed-channels/clear', (req: Request, res: Response) => {
  try {
    followedChannelsCacheService.clearAll();
    res.json({ success: true, message: 'Followed channels cache cleared successfully' });
  } catch (error) {
    console.error('[Security API] Error clearing followed channels cache:', error);
    res.status(500).json({ error: 'Failed to clear followed channels cache' });
  }
});

/**
 * POST /api/security/cache/followed-channels/cleanup
 * フォローチャンネルキャッシュの期限切れエントリをクリーンアップ（管理者用）
 */
securityRouter.post('/cache/followed-channels/cleanup', (req: Request, res: Response) => {
  try {
    const removed = followedChannelsCacheService.manualCleanup();
    res.json({
      success: true,
      message: `Cleaned up ${removed} expired entries`,
      removed
    });
  } catch (error) {
    console.error('[Security API] Error cleaning up followed channels cache:', error);
    res.status(500).json({ error: 'Failed to cleanup followed channels cache' });
  }
});
