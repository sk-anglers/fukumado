import { Router, Request, Response } from 'express';
import type { AnalyticsEvent } from '../types/analytics';

// analyticsTrackerインスタンスは index.ts からインポート
let analyticsTrackerInstance: any = null;

export const setAnalyticsTracker = (tracker: any) => {
  analyticsTrackerInstance = tracker;
};

export const analyticsRouter = Router();

/**
 * POST /api/analytics/track
 * イベントをトラッキング
 */
analyticsRouter.post('/track', async (req: Request, res: Response) => {
  try {
    const event: AnalyticsEvent = req.body;

    if (!event || !event.type) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event data',
        timestamp: new Date().toISOString()
      });
    }

    // クライアントのIPアドレスを取得
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
      : req.ip || req.socket.remoteAddress || 'unknown';

    // User-Agent情報を追加
    if (!event.userAgent && req.headers['user-agent']) {
      event.userAgent = req.headers['user-agent'];
    }

    // イベントを記録
    if (analyticsTrackerInstance) {
      await analyticsTrackerInstance.trackEvent(event, ip);
    } else {
      console.warn('[Analytics] Analytics tracker not initialized');
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/analytics/stats
 * 統計データを取得（管理用）
 */
analyticsRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const daysParam = req.query.days as string | undefined;
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    if (!analyticsTrackerInstance) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available',
        timestamp: new Date().toISOString()
      });
    }

    const stats = await analyticsTrackerInstance.getStats(days);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Analytics] Error getting stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/analytics/export
 * 統計データをエクスポート（CSV/JSON）
 */
analyticsRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'json';
    const daysParam = req.query.days as string | undefined;
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    if (!analyticsTrackerInstance) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const stats = await analyticsTrackerInstance.getStats(days);

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
    console.error('[Analytics] Error exporting stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});
