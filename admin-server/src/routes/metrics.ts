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
    const response = await fetch(`${SERVER_API_BASE}/api-tracking/rate-limit`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
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
 * YouTube APIのクォータリセット時刻を計算
 * YouTube APIは太平洋時間（PST/PDT）の午前0時にリセットされる
 */
function getYouTubeQuotaResetTime(): string {
  const now = new Date();

  // 太平洋時間でのオフセットを計算（PST: UTC-8, PDT: UTC-7）
  // 簡易的にDST判定: 3月第2日曜～11月第1日曜がPDT
  const year = now.getUTCFullYear();
  const march = new Date(Date.UTC(year, 2, 1)); // 3月1日
  const dstStart = new Date(Date.UTC(year, 2, 14 - march.getUTCDay())); // 3月第2日曜
  dstStart.setUTCHours(10, 0, 0, 0); // 太平洋時間午前2時 = UTC午前10時

  const november = new Date(Date.UTC(year, 10, 1)); // 11月1日
  const dstEnd = new Date(Date.UTC(year, 10, 7 - november.getUTCDay())); // 11月第1日曜
  dstEnd.setUTCHours(9, 0, 0, 0); // 太平洋時間午前2時 = UTC午前9時

  const isDST = now >= dstStart && now < dstEnd;
  const ptOffset = isDST ? -7 : -8; // PDT: UTC-7, PST: UTC-8

  // 太平洋時間での今日の午前0時を計算
  const ptNow = new Date(now.getTime() + ptOffset * 60 * 60 * 1000);
  const ptToday = new Date(Date.UTC(
    ptNow.getUTCFullYear(),
    ptNow.getUTCMonth(),
    ptNow.getUTCDate(),
    0, 0, 0, 0
  ));

  // UTCに戻す（太平洋時間0時 = UTC 8時または7時）
  const resetToday = new Date(ptToday.getTime() - ptOffset * 60 * 60 * 1000);

  // 既にリセット時刻を過ぎている場合は明日のリセット時刻
  if (now >= resetToday) {
    const resetTomorrow = new Date(resetToday.getTime() + 24 * 60 * 60 * 1000);
    return resetTomorrow.toISOString();
  }

  return resetToday.toISOString();
}

/**
 * GET /admin/api/metrics/api/youtube
 * YouTube APIクォータ情報取得
 */
metricsRouter.get('/api/youtube', async (req, res) => {
  try {
    // serverからHTTP経由で取得
    const response = await fetch(`${SERVER_API_BASE}/api-tracking/youtube-quota`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
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
      resetAt: getYouTubeQuotaResetTime() // 太平洋時間午前0時（日本時間午後4時/5時）
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

/**
 * GET /admin/api/metrics/system/detailed-metrics
 * 詳細なシステムメトリクス取得（CPU、メモリ、ロードアベレージ）
 */
metricsRouter.get('/system/detailed-metrics', async (req, res) => {
  try {
    const response = await fetch(`${SERVER_API_BASE}/system/detailed-metrics`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[API] Error getting detailed system metrics:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * GET /admin/api/metrics/database/stats
 * データベース統計情報取得
 */
metricsRouter.get('/database/stats', async (req, res) => {
  try {
    const response = await fetch(`${SERVER_API_BASE}/database/stats`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[API] Error getting database stats:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * GET /admin/api/metrics/database/tables
 * テーブル統計情報取得
 */
metricsRouter.get('/database/tables', async (req, res) => {
  try {
    const response = await fetch(`${SERVER_API_BASE}/database/tables`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[API] Error getting database tables:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * GET /admin/api/metrics/database/queries
 * アクティブなクエリを取得
 */
metricsRouter.get('/database/queries', async (req, res) => {
  try {
    const response = await fetch(`${SERVER_API_BASE}/database/queries`, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[API] Error getting active queries:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});
