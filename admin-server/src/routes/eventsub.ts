import { Router } from 'express';
import { ApiResponse } from '../types';
import { env } from '../config/env';

export const eventsubRouter = Router();

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
 * GET /admin/api/eventsub/stats
 * EventSub統計取得
 */
eventsubRouter.get('/stats', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        stats: any;
        capacity: any;
      };
      timestamp: string;
    }>('/api/admin/eventsub/stats');

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch EventSub stats from main service',
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
    console.error('[API] Error getting EventSub stats:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/eventsub/subscriptions
 * 購読チャンネル一覧取得
 */
eventsubRouter.get('/subscriptions', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        totalChannels: number;
        channelIds: string[];
        subscriptions: any[];
      };
      timestamp: string;
    }>('/api/admin/eventsub/subscriptions');

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch EventSub subscriptions from main service',
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
    console.error('[API] Error getting EventSub subscriptions:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /admin/api/eventsub/subscriptions/:userId
 * 特定チャンネルの購読解除
 */
eventsubRouter.delete('/subscriptions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        userId: string;
        unsubscribed: boolean;
      };
      timestamp: string;
    }>(`/api/admin/eventsub/subscriptions/${userId}`, { method: 'DELETE' });

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to unsubscribe channel on main service',
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
    console.error('[API] Error unsubscribing channel:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/eventsub/reconnect
 * 全接続を再接続
 */
eventsubRouter.post('/reconnect', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        reconnected: boolean;
      };
      timestamp: string;
    }>('/api/admin/eventsub/reconnect', { method: 'POST' });

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to reconnect EventSub on main service',
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
    console.error('[API] Error reconnecting EventSub:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/eventsub/events
 * EventSubイベント履歴取得
 */
eventsubRouter.get('/events', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        events: any[];
        totalEvents: number;
      };
      timestamp: string;
    }>(`/api/admin/eventsub/events?limit=${limit}`);

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch EventSub events from main service',
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
    console.error('[API] Error getting EventSub events:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});
