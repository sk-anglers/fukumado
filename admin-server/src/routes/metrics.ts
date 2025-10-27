import { Router } from 'express';
import { metricsCollector } from '../services/metricsCollector';
import { ApiResponse, SystemMetrics } from '../types';

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
 * TODO: 実際のTwitch APIからレート制限情報を取得する実装
 */
metricsRouter.get('/api/twitch', async (req, res) => {
  try {
    // TODO: 既存のふくまどバックエンドから取得
    const rateLimit = {
      remaining: 750,
      limit: 800,
      resetAt: new Date(Date.now() + 60000).toISOString(),
      usagePercent: 6.25
    };

    const response: ApiResponse = {
      success: true,
      data: rateLimit,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting Twitch rate limit:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/metrics/api/youtube
 * YouTube APIクォータ情報取得
 * TODO: 実際のYouTube APIからクォータ情報を取得する実装
 */
metricsRouter.get('/api/youtube', async (req, res) => {
  try {
    // TODO: 既存のふくまどバックエンドから取得
    const quota = {
      used: 1500,
      limit: 10000,
      remaining: 8500,
      usagePercent: 15,
      resetAt: new Date().toISOString()
    };

    const response: ApiResponse = {
      success: true,
      data: quota,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting YouTube quota:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});
