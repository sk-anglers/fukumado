import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { ApiResponse } from '../types';

export const auditLogsRouter = Router();

/**
 * GET /admin/api/audit-logs
 * 監査ログ一覧を取得（serverにプロキシ）
 */
auditLogsRouter.get('/', async (req: Request, res: Response) => {
  try {
    // クエリパラメータを構築
    const params = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });

    const url = `${env.mainBackendUrl}/api/admin/audit-logs?${params.toString()}`;
    console.log('[AuditLogs] Proxying logs request to:', url);

    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;
    res.json(data);
  } catch (error) {
    console.error('[AuditLogs] Error getting logs:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * GET /admin/api/audit-logs/summary
 * 監査ログサマリーを取得（serverにプロキシ）
 */
auditLogsRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const daysParam = req.query.days ? `?days=${req.query.days}` : '';
    const url = `${env.mainBackendUrl}/api/admin/audit-logs/summary${daysParam}`;
    console.log('[AuditLogs] Proxying summary request to:', url);

    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;
    res.json(data);
  } catch (error) {
    console.error('[AuditLogs] Error getting summary:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * POST /admin/api/audit-logs/cleanup
 * 古い監査ログをクリーンアップ（serverにプロキシ）
 */
auditLogsRouter.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const url = `${env.mainBackendUrl}/api/admin/audit-logs/cleanup`;
    console.log('[AuditLogs] Proxying cleanup request to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json() as any;
    res.json(data);
  } catch (error) {
    console.error('[AuditLogs] Error cleaning up logs:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});
