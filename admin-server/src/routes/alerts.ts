import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { ApiResponse } from '../types';

export const alertsRouter = Router();

/**
 * GET /admin/api/alerts
 * アラート一覧を取得（serverにプロキシ）
 */
alertsRouter.get('/', async (req: Request, res: Response) => {
  try {
    // クエリパラメータを構築
    const params = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });

    const url = `${env.mainBackendUrl}/api/admin/alerts?${params.toString()}`;
    console.log('[Alerts] Proxying alerts request to:', url);

    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;
    res.json(data);
  } catch (error) {
    console.error('[Alerts] Error getting alerts:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * GET /admin/api/alerts/unread-count
 * 未読アラート数を取得（serverにプロキシ）
 */
alertsRouter.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const url = `${env.mainBackendUrl}/api/admin/alerts/unread-count`;
    console.log('[Alerts] Proxying unread count request to:', url);

    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;
    res.json(data);
  } catch (error) {
    console.error('[Alerts] Error getting unread count:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * POST /admin/api/alerts/:id/acknowledge
 * アラートを確認済みにする（serverにプロキシ）
 */
alertsRouter.post('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const url = `${env.mainBackendUrl}/api/admin/alerts/${id}/acknowledge`;
    console.log('[Alerts] Proxying acknowledge request to:', url);

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
    console.error('[Alerts] Error acknowledging alert:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * POST /admin/api/alerts/:id/resolve
 * アラートを解決済みにする（serverにプロキシ）
 */
alertsRouter.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const url = `${env.mainBackendUrl}/api/admin/alerts/${id}/resolve`;
    console.log('[Alerts] Proxying resolve request to:', url);

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
    console.error('[Alerts] Error resolving alert:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * GET /admin/api/alert-settings
 * アラート設定を取得（serverにプロキシ）
 */
alertsRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const url = `${env.mainBackendUrl}/api/admin/alert-settings`;
    console.log('[Alerts] Proxying alert settings request to:', url);

    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;
    res.json(data);
  } catch (error) {
    console.error('[Alerts] Error getting alert settings:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * PUT /admin/api/alert-settings/:type
 * アラート設定を更新（serverにプロキシ）
 */
alertsRouter.put('/settings/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const url = `${env.mainBackendUrl}/api/admin/alert-settings/${type}`;
    console.log('[Alerts] Proxying update settings request to:', url);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json() as any;
    res.json(data);
  } catch (error) {
    console.error('[Alerts] Error updating alert setting:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});
