import { Router, Request, Response } from 'express';
import { followedChannelsCacheService } from '../services/followedChannelsCacheService';
import { emoteCacheService } from '../services/emoteCacheService';
import { apiLogStore } from '../utils/apiLogStore';

export const adminRouter = Router();

/**
 * GET /api/admin/memory-cache/stats
 * メモリキャッシュの統計情報を取得
 */
adminRouter.get('/memory-cache/stats', (req: Request, res: Response) => {
  try {
    const followedChannelsStats = followedChannelsCacheService.getStats();
    const emoteStats = emoteCacheService.getStats();

    res.json({
      success: true,
      data: {
        followedChannels: followedChannelsStats,
        emotes: emoteStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting memory cache stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/memory-cache/clear
 * メモリキャッシュをクリア
 */
adminRouter.delete('/memory-cache/clear', (req: Request, res: Response) => {
  try {
    const clearType = req.query.type as string | undefined;

    if (!clearType || clearType === 'all') {
      // すべてのキャッシュをクリア
      followedChannelsCacheService.clearAll();
      emoteCacheService.clearAll();
      console.log('[Admin] Cleared all memory caches');

      res.json({
        success: true,
        data: {
          cleared: ['followedChannels', 'emotes']
        },
        timestamp: new Date().toISOString()
      });
    } else if (clearType === 'followedChannels') {
      // フォローチャンネルキャッシュのみクリア
      followedChannelsCacheService.clearAll();
      console.log('[Admin] Cleared followed channels cache');

      res.json({
        success: true,
        data: {
          cleared: ['followedChannels']
        },
        timestamp: new Date().toISOString()
      });
    } else if (clearType === 'emotes') {
      // エモートキャッシュのみクリア
      emoteCacheService.clearAll();
      console.log('[Admin] Cleared emotes cache');

      res.json({
        success: true,
        data: {
          cleared: ['emotes']
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid cache type. Use: all, followedChannels, or emotes',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[Admin] Error clearing memory cache:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/memory-cache/cleanup
 * 期限切れエントリをクリーンアップ
 */
adminRouter.post('/memory-cache/cleanup', (req: Request, res: Response) => {
  try {
    const followedChannelsRemoved = followedChannelsCacheService.manualCleanup();
    const emotesRemoved = emoteCacheService.manualCleanup();

    console.log('[Admin] Manual cleanup completed:', {
      followedChannelsRemoved,
      emotesRemoved
    });

    res.json({
      success: true,
      data: {
        followedChannelsRemoved,
        emotesRemoved,
        totalRemoved: followedChannelsRemoved + emotesRemoved
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error during cleanup:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/api-tracking/rate-limit
 * Twitchレート制限情報を取得
 */
adminRouter.get('/api-tracking/rate-limit', (req: Request, res: Response) => {
  try {
    const rateLimit = apiLogStore.getLatestTwitchRateLimit();

    res.json({
      success: true,
      data: rateLimit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting rate limit:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/api-tracking/youtube-quota
 * YouTubeクォータ使用量を取得
 */
adminRouter.get('/api-tracking/youtube-quota', (req: Request, res: Response) => {
  try {
    const quotaUsage = apiLogStore.getTodayYouTubeQuotaUsage();

    res.json({
      success: true,
      data: {
        usedToday: quotaUsage,
        totalQuota: 10000,
        remaining: 10000 - quotaUsage,
        usagePercent: (quotaUsage / 10000) * 100
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting YouTube quota:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/api-monitor/logs
 * API監視ログ一覧を取得
 */
adminRouter.get('/api-monitor/logs', (req: Request, res: Response) => {
  try {
    const service = req.query.service as 'twitch' | 'youtube' | 'other' | undefined;
    const statusCodeStr = req.query.statusCode as string | undefined;
    const statusCode = statusCodeStr ? parseInt(statusCodeStr, 10) : undefined;
    const limitStr = req.query.limit as string | undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const offsetStr = req.query.offset as string | undefined;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    console.log('[Admin] GET /api-monitor/logs - params:', { service, statusCode, limit, offset });

    const result = apiLogStore.getLogs({
      service,
      statusCode,
      limit,
      offset
    });

    console.log('[Admin] Returning', result.logs.length, 'logs, total:', result.total);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting API logs:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/api-monitor/stats
 * API統計情報を取得
 */
adminRouter.get('/api-monitor/stats', (req: Request, res: Response) => {
  try {
    const service = req.query.service as 'twitch' | 'youtube' | 'other' | undefined;

    console.log('[Admin] GET /api-monitor/stats - service:', service);

    const stats = apiLogStore.getStats(service);

    console.log('[Admin] Returning stats:', stats);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting API stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});
