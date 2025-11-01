import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import type { AnalyticsStats } from '../types';

const router = Router();

/**
 * GET /analytics/stats
 * 本サービスからアナリティクス統計を取得
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const daysParam = req.query.days as string | undefined;
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    const response = await fetch(`${env.mainBackendUrl}/api/admin/analytics/stats?days=${days}`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    if (!response.ok) {
      console.error('[Analytics] Failed to fetch analytics stats:', response.status);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch analytics stats from main service'
      });
    }

    const result = await response.json() as {
      success: boolean;
      data: AnalyticsStats;
      timestamp: string;
    };

    res.json(result);
  } catch (error) {
    console.error('[Analytics] Error fetching analytics stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

/**
 * GET /analytics/export
 * アナリティクス統計をエクスポート（プロキシ）
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'json';
    const daysParam = req.query.days as string | undefined;
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    const response = await fetch(`${env.mainBackendUrl}/api/admin/analytics/export?format=${format}&days=${days}`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    if (!response.ok) {
      console.error('[Analytics] Failed to export analytics stats:', response.status);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to export analytics stats from main service'
      });
    }

    // Content-Typeとファイル名をそのまま転送
    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }

    if (format === 'csv') {
      const csv = await response.text();
      res.send(csv);
    } else {
      const json = await response.json();
      res.json(json);
    }
  } catch (error) {
    console.error('[Analytics] Error exporting analytics stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

export default router;
