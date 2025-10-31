import { Router } from 'express';
import { ApiResponse } from '../types';
import { env } from '../config/env';

export const logsRouter = Router();

/**
 * 本サービスのAPIを呼び出すヘルパー関数
 */
async function fetchMainServiceAPI<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const url = `${env.mainBackendUrl}${endpoint}`;
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey,
        ...options?.headers
      },
      ...options
    });

    if (!response.ok) {
      console.error(`[Main Service API] Error fetching ${endpoint}: ${response.statusText}`);
      return null;
    }

    return await response.json() as T;
  } catch (error) {
    console.error(`[Main Service API] Failed to fetch ${endpoint}:`, error);
    return null;
  }
}

/**
 * GET /admin/api/logs/access
 * アクセスログ取得
 */
logsRouter.get('/access', async (req, res) => {
  try {
    // クエリパラメータを構築
    const queryParams = new URLSearchParams();
    if (req.query.limit) queryParams.set('limit', req.query.limit as string);
    if (req.query.offset) queryParams.set('offset', req.query.offset as string);
    if (req.query.method) queryParams.set('method', req.query.method as string);
    if (req.query.statusCode) queryParams.set('statusCode', req.query.statusCode as string);
    if (req.query.searchPath) queryParams.set('searchPath', req.query.searchPath as string);
    if (req.query.startDate) queryParams.set('startDate', req.query.startDate as string);
    if (req.query.endDate) queryParams.set('endDate', req.query.endDate as string);

    const endpoint = `/api/admin/logs/access?${queryParams.toString()}`;
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        logs: any[];
        total: number;
      };
      timestamp: string;
    }>(endpoint);

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch access logs from main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting access logs:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/logs/error
 * エラーログ取得
 */
logsRouter.get('/error', async (req, res) => {
  try {
    const queryParams = new URLSearchParams();
    if (req.query.limit) queryParams.set('limit', req.query.limit as string);
    if (req.query.offset) queryParams.set('offset', req.query.offset as string);
    if (req.query.level) queryParams.set('level', req.query.level as string);
    if (req.query.searchMessage) queryParams.set('searchMessage', req.query.searchMessage as string);

    const endpoint = `/api/admin/logs/error?${queryParams.toString()}`;
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        logs: any[];
        total: number;
      };
      timestamp: string;
    }>(endpoint);

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch error logs from main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting error logs:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/logs/security
 * セキュリティログ取得
 */
logsRouter.get('/security', async (req, res) => {
  try {
    const queryParams = new URLSearchParams();
    if (req.query.limit) queryParams.set('limit', req.query.limit as string);
    if (req.query.offset) queryParams.set('offset', req.query.offset as string);
    if (req.query.type) queryParams.set('type', req.query.type as string);
    if (req.query.searchIp) queryParams.set('searchIp', req.query.searchIp as string);

    const endpoint = `/api/admin/logs/security?${queryParams.toString()}`;
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        logs: any[];
        total: number;
      };
      timestamp: string;
    }>(endpoint);

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch security logs from main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting security logs:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/logs/summary
 * ログサマリー取得
 */
logsRouter.get('/summary', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        totalAccessLogs: number;
        totalErrorLogs: number;
        totalSecurityLogs: number;
        recentErrors: number;
        recentSecurityEvents: number;
      };
      timestamp: string;
    }>('/api/admin/logs/summary');

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch log summary from main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting log summary:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /admin/api/logs/:type
 * ログクリア
 */
logsRouter.delete('/:type', async (req, res) => {
  try {
    const { type } = req.params;

    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        type: string;
        cleared: boolean;
      };
      timestamp: string;
    }>(`/api/admin/logs/${type}`, { method: 'DELETE' });

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to clear logs on main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error clearing logs:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});
