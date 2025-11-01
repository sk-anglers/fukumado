"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const followedChannelsCacheService_1 = require("../services/followedChannelsCacheService");
const emoteCacheService_1 = require("../services/emoteCacheService");
const apiLogStore_1 = require("../utils/apiLogStore");
const index_1 = require("../index");
const systemMetricsCollector_1 = require("../services/systemMetricsCollector");
exports.adminRouter = (0, express_1.Router)();
/**
 * GET /api/admin/system/metrics
 * システムメトリクス（CPU、メモリ、稼働時間）を取得
 */
exports.adminRouter.get('/system/metrics', (req, res) => {
    try {
        const metrics = systemMetricsCollector_1.systemMetricsCollector.getLatestMetrics();
        if (!metrics) {
            return res.status(404).json({
                success: false,
                error: 'No metrics available',
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            success: true,
            data: metrics,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting system metrics:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/memory-cache/stats
 * メモリキャッシュの統計情報を取得
 */
exports.adminRouter.get('/memory-cache/stats', (req, res) => {
    try {
        const followedChannelsStats = followedChannelsCacheService_1.followedChannelsCacheService.getStats();
        const emoteStats = emoteCacheService_1.emoteCacheService.getStats();
        res.json({
            success: true,
            data: {
                followedChannels: followedChannelsStats,
                emotes: emoteStats
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
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
exports.adminRouter.delete('/memory-cache/clear', (req, res) => {
    try {
        const clearType = req.query.type;
        if (!clearType || clearType === 'all') {
            // すべてのキャッシュをクリア
            followedChannelsCacheService_1.followedChannelsCacheService.clearAll();
            emoteCacheService_1.emoteCacheService.clearAll();
            console.log('[Admin] Cleared all memory caches');
            res.json({
                success: true,
                data: {
                    cleared: ['followedChannels', 'emotes']
                },
                timestamp: new Date().toISOString()
            });
        }
        else if (clearType === 'followedChannels') {
            // フォローチャンネルキャッシュのみクリア
            followedChannelsCacheService_1.followedChannelsCacheService.clearAll();
            console.log('[Admin] Cleared followed channels cache');
            res.json({
                success: true,
                data: {
                    cleared: ['followedChannels']
                },
                timestamp: new Date().toISOString()
            });
        }
        else if (clearType === 'emotes') {
            // エモートキャッシュのみクリア
            emoteCacheService_1.emoteCacheService.clearAll();
            console.log('[Admin] Cleared emotes cache');
            res.json({
                success: true,
                data: {
                    cleared: ['emotes']
                },
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Invalid cache type. Use: all, followedChannels, or emotes',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
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
exports.adminRouter.post('/memory-cache/cleanup', (req, res) => {
    try {
        const followedChannelsRemoved = followedChannelsCacheService_1.followedChannelsCacheService.manualCleanup();
        const emotesRemoved = emoteCacheService_1.emoteCacheService.manualCleanup();
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
    }
    catch (error) {
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
exports.adminRouter.get('/api-tracking/rate-limit', (req, res) => {
    try {
        const rateLimit = apiLogStore_1.apiLogStore.getLatestTwitchRateLimit();
        res.json({
            success: true,
            data: rateLimit,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
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
exports.adminRouter.get('/api-tracking/youtube-quota', (req, res) => {
    try {
        const quotaUsage = apiLogStore_1.apiLogStore.getTodayYouTubeQuotaUsage();
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
    }
    catch (error) {
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
exports.adminRouter.get('/api-monitor/logs', (req, res) => {
    try {
        const service = req.query.service;
        const statusCodeStr = req.query.statusCode;
        const statusCode = statusCodeStr ? parseInt(statusCodeStr, 10) : undefined;
        const limitStr = req.query.limit;
        const limit = limitStr ? parseInt(limitStr, 10) : 100;
        const offsetStr = req.query.offset;
        const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
        console.log('[Admin] GET /api-monitor/logs - params:', { service, statusCode, limit, offset });
        const result = apiLogStore_1.apiLogStore.getLogs({
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
    }
    catch (error) {
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
exports.adminRouter.get('/api-monitor/stats', (req, res) => {
    try {
        const service = req.query.service;
        console.log('[Admin] GET /api-monitor/stats - service:', service);
        const stats = apiLogStore_1.apiLogStore.getStats(service);
        console.log('[Admin] Returning stats:', stats);
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting API stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/websocket/stats
 * WebSocket接続統計を取得
 */
exports.adminRouter.get('/websocket/stats', (req, res) => {
    try {
        const stats = (0, index_1.getWebSocketStats)();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting WebSocket stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/pv/stats
 * PV統計を取得
 */
exports.adminRouter.get('/pv/stats', async (req, res) => {
    try {
        const stats = await index_1.pvTracker.getAllStats();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting PV stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/pv/export
 * PV統計をエクスポート（JSON/CSV）
 */
exports.adminRouter.get('/pv/export', async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const stats = await index_1.pvTracker.getAllStats();
        if (format === 'csv') {
            // CSV形式でエクスポート
            let csv = 'Date,PV,Unique Users\n';
            // 日次データ
            stats.daily.forEach((day) => {
                csv += `${day.date},${day.pv},${day.uniqueUsers}\n`;
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="pv-stats-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csv);
        }
        else {
            // JSON形式でエクスポート
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="pv-stats-${new Date().toISOString().split('T')[0]}.json"`);
            res.json(stats);
        }
    }
    catch (error) {
        console.error('[Admin] Error exporting PV stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/pv/backup
 * PV統計を手動でバックアップ
 */
exports.adminRouter.post('/pv/backup', async (req, res) => {
    try {
        const filepath = await index_1.pvTracker.backupToFile();
        res.json({
            success: true,
            data: {
                filepath,
                message: 'Backup completed successfully'
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error backing up PV stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
// ========================================
// アナリティクス統計API
// ========================================
/**
 * GET /api/admin/analytics/stats
 * アナリティクス統計を取得
 */
exports.adminRouter.get('/analytics/stats', async (req, res) => {
    try {
        const daysParam = req.query.days;
        const days = daysParam ? parseInt(daysParam, 10) : 30;
        if (!index_1.analyticsTracker) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service not available',
                timestamp: new Date().toISOString()
            });
        }
        const stats = await index_1.analyticsTracker.getStats(days);
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting analytics stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/analytics/export
 * アナリティクス統計をエクスポート（CSV/JSON）
 */
exports.adminRouter.get('/analytics/export', async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const daysParam = req.query.days;
        const days = daysParam ? parseInt(daysParam, 10) : 30;
        if (!index_1.analyticsTracker) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service not available'
            });
        }
        const stats = await index_1.analyticsTracker.getStats(days);
        if (format === 'csv') {
            // CSV形式でエクスポート
            let csv = 'Date,Events,Sessions,Unique Users\n';
            stats.timeline.daily.forEach((day) => {
                csv += `${day.date},${day.events},${day.sessions},${day.uniqueUsers}\n`;
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csv);
        }
        else {
            // JSON形式でエクスポート
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.json"`);
            res.json(stats);
        }
    }
    catch (error) {
        console.error('[Admin] Error exporting analytics stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
//# sourceMappingURL=admin.js.map