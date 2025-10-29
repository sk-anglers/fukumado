import { Router } from 'express';
import { ApiResponse } from '../types';
import { env } from '../config/env';

export const streamsRouter = Router();

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
 * GET /admin/api/streams
 * 配信情報を取得
 */
streamsRouter.get('/', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        youtube: any[];
        twitch: any[];
        stats: {
          isRunning: boolean;
          userCount: number;
          youtubeStreamCount: number;
          twitchStreamCount: number;
          cacheAvailable: boolean;
        };
      };
      timestamp: string;
    }>('/api/admin/streams');

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch streams from main service',
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
    console.error('[API] Error getting streams:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/streams/details
 * 配信詳細情報を取得
 */
streamsRouter.get('/details', async (req, res) => {
  try {
    console.log('[Streams] Fetching details from main service:', `${env.mainBackendUrl}/api/streams/details`);
    const data = await fetchMainServiceAPI<{
      stats: {
        isRunning: boolean;
        userCount: number;
        youtubeStreamCount: number;
        twitchStreamCount: number;
        totalStreamCount: number;
      };
      streams: {
        youtube: any[];
        twitch: any[];
      };
      timestamp: string;
    }>('/api/streams/details');

    console.log('[Streams] Received data:', data ? 'Success' : 'Null');
    if (data) {
      console.log('[Streams] Stats:', data.stats);
      console.log('[Streams] YouTube streams:', data.streams?.youtube?.length || 0);
      console.log('[Streams] Twitch streams:', data.streams?.twitch?.length || 0);
    }

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch stream details from main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting stream details:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/streams/sync
 * 手動同期をトリガー
 */
streamsRouter.post('/sync', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{ success: boolean; message: string }>(
      '/api/streams/sync',
      { method: 'POST' }
    );

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to trigger sync on main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error triggering sync:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});
