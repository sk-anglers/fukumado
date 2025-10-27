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
 * GET /admin/api/users/sessions
 * セッション一覧を取得
 */
usersRouter.get('/sessions', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        sessions: any[];
        stats: {
          totalSessions: number;
          authenticatedSessions: number;
          youtubeAuthSessions: number;
          twitchAuthSessions: number;
        };
      };
      timestamp: string;
    }>('/api/admin/users/sessions');

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch sessions from main service',
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
    console.error('[API] Error getting sessions:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /admin/api/users/sessions/:sessionId
 * セッションを強制終了
 */
usersRouter.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        sessionId: string;
        destroyed: boolean;
      };
      timestamp: string;
    }>(`/api/admin/users/sessions/${sessionId}`, { method: 'DELETE' });

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to destroy session on main service',
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
    console.error('[API] Error destroying session:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

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
        activeUsers: number;
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
