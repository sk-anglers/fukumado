import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import type { PVStats } from '../types';

const router = Router();

/**
 * GET /api/pv/stats
 * 本サービスからPV統計を取得
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${env.mainBackendUrl}/api/admin/pv/stats`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    if (!response.ok) {
      console.error('[PV] Failed to fetch PV stats:', response.status);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch PV stats from main service'
      });
    }

    const result = await response.json() as {
      success: boolean;
      data: PVStats;
      timestamp: string;
    };

    res.json(result);
  } catch (error) {
    console.error('[PV] Error fetching PV stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

/**
 * GET /api/pv/export
 * PV統計をエクスポート（プロキシ）
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'json';

    const response = await fetch(`${env.mainBackendUrl}/api/admin/pv/export?format=${format}`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    if (!response.ok) {
      console.error('[PV] Failed to export PV stats:', response.status);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to export PV stats from main service'
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
    console.error('[PV] Error exporting PV stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

/**
 * POST /api/pv/backup
 * PV統計を手動でバックアップ（プロキシ）
 */
router.post('/backup', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${env.mainBackendUrl}/api/admin/pv/backup`, {
      method: 'POST',
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    if (!response.ok) {
      console.error('[PV] Failed to backup PV stats:', response.status);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to backup PV stats from main service'
      });
    }

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('[PV] Error backing up PV stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

export default router;
