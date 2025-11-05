import { Router } from 'express';
import { ApiResponse } from '../types';
import { env } from '../config/env';

export const usersRouter = Router();

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
 * GET /admin/api/users/stats
 * ユーザー統計を取得
 */
usersRouter.get('/stats', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        totalUsers: number;
        youtubeUsers: number;
        twitchUsers: number;
        recentLogins: any[];
      };
      timestamp: string;
    }>('/api/admin/users/stats');

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch user stats from main service',
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
    console.error('[API] Error getting user stats:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});
