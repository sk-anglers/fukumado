"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamsRouter = void 0;
const express_1 = require("express");
const streamSyncService_1 = require("../services/streamSyncService");
exports.streamsRouter = (0, express_1.Router)();
/**
 * 手動で配信リスト同期をトリガー
 */
exports.streamsRouter.post('/sync', async (req, res) => {
    try {
        await streamSyncService_1.streamSyncService.manualSync();
        res.json({ success: true, message: 'Sync triggered' });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});
/**
 * 同期サービスの状態を取得
 */
exports.streamsRouter.get('/status', (req, res) => {
    const stats = streamSyncService_1.streamSyncService.getStats();
    res.json(stats);
});
/**
 * キャッシュされた配信リストを取得
 */
exports.streamsRouter.get('/cached', async (req, res) => {
    try {
        const cached = await streamSyncService_1.streamSyncService.getCachedStreams();
        if (!cached) {
            return res.status(404).json({ error: 'No cached streams available' });
        }
        res.json(cached);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});
/**
 * 配信の詳細情報を取得（管理画面用）
 */
exports.streamsRouter.get('/details', async (req, res) => {
    try {
        console.log('[Streams] GET /details - Fetching stream details');
        const stats = streamSyncService_1.streamSyncService.getStats();
        const cached = await streamSyncService_1.streamSyncService.getCachedStreams();
        console.log('[Streams] Stats:', stats);
        console.log('[Streams] Cached streams:', cached ? `YouTube: ${cached.youtube?.length || 0}, Twitch: ${cached.twitch?.length || 0}` : 'null');
        const response = {
            stats: {
                isRunning: stats.isRunning,
                userCount: stats.userCount,
                youtubeStreamCount: stats.youtubeStreamCount,
                twitchStreamCount: stats.twitchStreamCount,
                totalStreamCount: stats.youtubeStreamCount + stats.twitchStreamCount
            },
            streams: cached || { youtube: [], twitch: [] },
            timestamp: new Date().toISOString()
        };
        console.log('[Streams] Sending response:', JSON.stringify(response, null, 2));
        res.json(response);
    }
    catch (error) {
        console.error('[Streams] Error getting details:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});
//# sourceMappingURL=streams.js.map