import { Router } from 'express';
import { metricsCollector } from '../services/metricsCollector';
import { ApiResponse, SystemMetrics } from '../types';
import { env } from '../config/env';

// serverのAPIエンドポイントURL
const SERVER_API_BASE = `${env.mainBackendUrl}/api/admin`;

export const metricsRouter = Router();

/**
 * GET /admin/api/metrics/system
 * システムメトリクス取得
 */
metricsRouter.get('/system', async (req, res) => {
  try {
    const metrics = await metricsCollector.getLatestMetrics();

    if (!metrics) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No metrics available',
        timestamp: new Date().toISOString()
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<SystemMetrics> = {
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting system metrics:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/metrics/api/twitch
 * Twitch APIレート制限情報取得
 */
metricsRouter.get('/api/twitch', async (req, res) => {
  try {
    // serverからHTTP経由で取得
    const response = await fetch(`${SERVER_API_BASE}/api-tracking/rate-limit`);
    const data = await response.json() as any;

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch rate limit');
    }

    const rateLimitData = data.data;
    let rateLimit;

    if (rateLimitData) {
      const usagePercent = ((rateLimitData.limit - rateLimitData.remaining) / rateLimitData.limit) * 100;
      rateLimit = {
        remaining: rateLimitData.remaining,
        limit: rateLimitData.limit,
        resetAt: new Date(rateLimitData.reset * 1000).toISOString(),
        usagePercent: parseFloat(usagePercent.toFixed(2))
      };
    } else {
      // データがない場合はデフォルト値
      rateLimit = {
        remaining: 800,
        limit: 800,
        resetAt: new Date(Date.now() + 60000).toISOString(),
        usagePercent: 0
      };
    }

    const apiResponse: ApiResponse = {
      success: true,
      data: rateLimit,
      timestamp: new Date().toISOString()
    };

    res.json(apiResponse);
  } catch (error) {
    console.error('[API] Error getting Twitch rate limit:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * GET /admin/api/metrics/api/youtube
 * YouTube APIクォータ情報取得
 */
metricsRouter.get('/api/youtube', async (req, res) => {
  try {
    // serverからHTTP経由で取得
    const response = await fetch(`${SERVER_API_BASE}/api-tracking/youtube-quota`);
    const data = await response.json() as any;

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch YouTube quota');
    }

    const quotaData = data.data;
    const quota = {
      used: quotaData.usedToday,
      limit: quotaData.totalQuota,
      remaining: quotaData.remaining,
      usagePercent: quotaData.usagePercent,
      resetAt: new Date().toISOString() // 日本時間午前9時にリセット
    };

    const apiResponse: ApiResponse = {
      success: true,
      data: quota,
      timestamp: new Date().toISOString()
    };

    res.json(apiResponse);
  } catch (error) {
    console.error('[API] Error getting YouTube quota:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});
