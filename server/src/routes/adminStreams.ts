import { Router } from 'express';
import { streamSyncService } from '../services/streamSyncService';

export const adminStreamsRouter = Router();

/**
 * GET /api/admin/streams
 * 配信情報の取得
 */
adminStreamsRouter.get('/', async (req, res) => {
  try {
    const streams = await streamSyncService.getCachedStreams();
    const stats = streamSyncService.getStats();

    if (!streams) {
      return res.json({
        success: true,
        data: {
          youtube: [],
          twitch: [],
          stats: {
            ...stats,
            cacheAvailable: false
          }
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: {
        youtube: streams.youtube,
        twitch: streams.twitch,
        stats: {
          ...stats,
          cacheAvailable: true
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Streams] Error getting streams:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
