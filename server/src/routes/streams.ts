import { Router } from 'express';
import { streamSyncService } from '../services/streamSyncService';

export const streamsRouter = Router();

/**
 * 手動で配信リスト同期をトリガー
 */
streamsRouter.post('/sync', async (req, res) => {
  try {
    await streamSyncService.manualSync();
    res.json({ success: true, message: 'Sync triggered' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * 同期サービスの状態を取得
 */
streamsRouter.get('/status', (req, res) => {
  const stats = streamSyncService.getStats();
  res.json(stats);
});

/**
 * キャッシュされた配信リストを取得
 */
streamsRouter.get('/cached', async (req, res) => {
  try {
    const cached = await streamSyncService.getCachedStreams();
    if (!cached) {
      return res.status(404).json({ error: 'No cached streams available' });
    }
    res.json(cached);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * 配信の詳細情報を取得（管理画面用）
 */
streamsRouter.get('/details', async (req, res) => {
  try {
    const stats = streamSyncService.getStats();
    const cached = await streamSyncService.getCachedStreams();

    res.json({
      stats: {
        isRunning: stats.isRunning,
        userCount: stats.userCount,
        youtubeStreamCount: stats.youtubeStreamCount,
        twitchStreamCount: stats.twitchStreamCount,
        totalStreamCount: stats.youtubeStreamCount + stats.twitchStreamCount
      },
      streams: cached || { youtube: [], twitch: [] },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
