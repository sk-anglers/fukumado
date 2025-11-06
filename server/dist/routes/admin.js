"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setErrorTestModeStatus = exports.getErrorTestModeStatus = exports.adminRouter = void 0;
const express_1 = require("express");
const followedChannelsCacheService_1 = require("../services/followedChannelsCacheService");
const emoteCacheService_1 = require("../services/emoteCacheService");
const apiLogStore_1 = require("../utils/apiLogStore");
const index_1 = require("../index");
const systemMetricsCollector_1 = require("../services/systemMetricsCollector");
const priorityManager_1 = require("../services/priorityManager");
const security_1 = require("../middleware/security");
const systemMetricsService_1 = require("../services/systemMetricsService");
const databaseMetricsService_1 = require("../services/databaseMetricsService");
const auditLogService_1 = require("../services/auditLogService");
const alertService_1 = require("../services/alertService");
const prismaService_1 = __importDefault(require("../services/prismaService"));
exports.adminRouter = (0, express_1.Router)();
// インスタンス作成
const systemMetricsService = new systemMetricsService_1.SystemMetricsService();
const databaseMetricsService = new databaseMetricsService_1.DatabaseMetricsService();
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
// ========================================
// 動的閾値API
// ========================================
/**
 * GET /api/admin/threshold/info
 * 動的閾値情報を取得
 */
exports.adminRouter.get('/threshold/info', (req, res) => {
    try {
        const thresholdInfo = priorityManager_1.priorityManager.getThresholdInfo();
        const syncStats = index_1.streamSyncService.getStats();
        res.json({
            success: true,
            data: {
                ...thresholdInfo,
                pollingChannels: syncStats.pollingChannels
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting threshold info:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
// ========================================
// セキュリティ管理API
// ========================================
/**
 * GET /api/admin/security/blocked-ips
 * ブロックされているIPリストを取得
 */
exports.adminRouter.get('/security/blocked-ips', (req, res) => {
    try {
        const blockedIPs = security_1.ipBlocklist.getBlockedIPs();
        res.json({
            success: true,
            data: {
                blockedIPs,
                count: blockedIPs.length
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting blocked IPs:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/security/unblock-ip
 * 特定のIPのブロックを解除
 */
exports.adminRouter.post('/security/unblock-ip', (req, res) => {
    try {
        const { ip } = req.body;
        if (!ip) {
            return res.status(400).json({
                success: false,
                error: 'IP address is required',
                timestamp: new Date().toISOString()
            });
        }
        const wasBlocked = security_1.ipBlocklist.unblock(ip);
        res.json({
            success: true,
            data: {
                ip,
                wasBlocked,
                message: wasBlocked ? `IP ${ip} has been unblocked` : `IP ${ip} was not blocked`
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error unblocking IP:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/security/clear-all-blocks
 * すべてのIPブロックを解除
 */
exports.adminRouter.post('/security/clear-all-blocks', (req, res) => {
    try {
        security_1.ipBlocklist.clear();
        res.json({
            success: true,
            data: {
                message: 'All IP blocks have been cleared'
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error clearing all blocks:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/security/whitelisted-ips
 * ホワイトリストに登録されているIPリストを取得
 */
exports.adminRouter.get('/security/whitelisted-ips', (req, res) => {
    try {
        const whitelistedIPs = security_1.ipBlocklist.getWhitelistedIPs();
        res.json({
            success: true,
            data: {
                whitelistedIPs,
                count: whitelistedIPs.length
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting whitelisted IPs:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/security/whitelist-ip
 * IPをホワイトリストに追加
 */
exports.adminRouter.post('/security/whitelist-ip', async (req, res) => {
    try {
        const { ip, reason } = req.body;
        if (!ip) {
            return res.status(400).json({
                success: false,
                error: 'IP address is required',
                timestamp: new Date().toISOString()
            });
        }
        await security_1.ipBlocklist.addToWhitelist(ip, reason);
        res.json({
            success: true,
            data: {
                ip,
                whitelisted: true,
                message: `IP ${ip} has been added to whitelist`
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error whitelisting IP:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/security/remove-from-whitelist
 * IPをホワイトリストから削除
 */
exports.adminRouter.post('/security/remove-from-whitelist', async (req, res) => {
    try {
        const { ip } = req.body;
        if (!ip) {
            return res.status(400).json({
                success: false,
                error: 'IP address is required',
                timestamp: new Date().toISOString()
            });
        }
        const wasWhitelisted = await security_1.ipBlocklist.removeFromWhitelist(ip);
        res.json({
            success: true,
            data: {
                ip,
                wasWhitelisted,
                message: wasWhitelisted ? `IP ${ip} has been removed from whitelist` : `IP ${ip} was not whitelisted`
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error removing IP from whitelist:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
// ========================================
// データベースメトリクスAPI
// ========================================
/**
 * GET /api/admin/database/stats
 * データベース統計情報を取得
 */
exports.adminRouter.get('/database/stats', async (req, res) => {
    try {
        const stats = await databaseMetricsService.getDatabaseStats();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting database stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/database/connections
 * データベース接続情報を取得
 */
exports.adminRouter.get('/database/connections', async (req, res) => {
    try {
        const connections = await databaseMetricsService.getConnectionStats();
        res.json({
            success: true,
            data: connections,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting database connections:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/database/tables
 * テーブル統計情報を取得
 */
exports.adminRouter.get('/database/tables', async (req, res) => {
    try {
        const tables = await databaseMetricsService.getTableStats();
        res.json({
            success: true,
            data: tables,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting database tables:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/database/queries
 * アクティブなクエリを取得
 */
exports.adminRouter.get('/database/queries', async (req, res) => {
    try {
        const queries = await databaseMetricsService.getActiveQueries();
        res.json({
            success: true,
            data: queries,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting active queries:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/system/detailed-metrics
 * 詳細なシステムメトリクスを取得（CPU、メモリ、ロードアベレージ）
 */
exports.adminRouter.get('/system/detailed-metrics', (req, res) => {
    try {
        const metrics = systemMetricsService.getSystemMetrics();
        res.json({
            success: true,
            data: metrics,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting detailed system metrics:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/database/migrate-severity
 * security_logs の severity 制約を修正（warn を許可）
 */
exports.adminRouter.post('/database/migrate-severity', async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    try {
        console.log('[Admin] Running severity constraint migration...');
        // Drop existing constraint
        await prismaService_1.default.$executeRawUnsafe(`
      ALTER TABLE security_logs DROP CONSTRAINT IF EXISTS security_logs_severity_check;
    `);
        console.log('[Admin] ✓ Dropped existing constraint');
        // Add new constraint that allows 'info', 'warn', 'error'
        await prismaService_1.default.$executeRawUnsafe(`
      ALTER TABLE security_logs ADD CONSTRAINT security_logs_severity_check
        CHECK (severity IN ('info', 'warn', 'error'));
    `);
        console.log('[Admin] ✓ Added new constraint (allows: info, warn, error)');
        // 監査ログ記録
        await auditLogService_1.auditLogService.log({
            action: 'database_migration_severity',
            actor: 'admin',
            actorIp: ip,
            actorAgent: userAgent,
            targetType: 'database',
            targetId: 'security_logs',
            details: { migration: 'severity_constraint', allowedValues: ['info', 'warn', 'error'] },
            status: 'success'
        });
        res.json({
            success: true,
            data: {
                message: 'Migration completed successfully',
                allowedValues: ['info', 'warn', 'error']
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error running migration:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        // 監査ログ記録（失敗）
        await auditLogService_1.auditLogService.log({
            action: 'database_migration_severity',
            actor: 'admin',
            actorIp: ip,
            actorAgent: userAgent,
            targetType: 'database',
            targetId: 'security_logs',
            status: 'failure',
            errorMessage: message
        });
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
// ============================================
// 監査ログ (Audit Log)
// ============================================
/**
 * GET /api/admin/audit-logs
 * 監査ログ一覧を取得
 */
exports.adminRouter.get('/audit-logs', async (req, res) => {
    try {
        const { limit, offset, action, actor, actorIp, targetType, status, startDate, endDate } = req.query;
        const options = {};
        if (limit)
            options.limit = parseInt(limit);
        if (offset)
            options.offset = parseInt(offset);
        if (action)
            options.action = action;
        if (actor)
            options.actor = actor;
        if (actorIp)
            options.actorIp = actorIp;
        if (targetType)
            options.targetType = targetType;
        if (status)
            options.status = status;
        if (startDate)
            options.startDate = new Date(startDate);
        if (endDate)
            options.endDate = new Date(endDate);
        const result = await auditLogService_1.auditLogService.getLogs(options);
        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting audit logs:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/audit-logs/summary
 * 監査ログサマリーを取得
 */
exports.adminRouter.get('/audit-logs/summary', async (req, res) => {
    try {
        const days = req.query.days ? parseInt(req.query.days) : 7;
        const summary = await auditLogService_1.auditLogService.getSummary(days);
        res.json({
            success: true,
            data: summary,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting audit log summary:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/audit-logs/cleanup
 * 古い監査ログをクリーンアップ
 */
exports.adminRouter.post('/audit-logs/cleanup', async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    try {
        const { days = 90 } = req.body;
        const deletedCount = await auditLogService_1.auditLogService.cleanup(days);
        // 監査ログ記録
        await auditLogService_1.auditLogService.log({
            action: 'audit_log_cleanup',
            actor: 'admin',
            actorIp: ip,
            actorAgent: userAgent,
            targetType: 'system',
            details: { days, deletedCount },
            status: 'success'
        });
        res.json({
            success: true,
            data: { deletedCount, days },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error cleaning up audit logs:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        // 監査ログ記録（失敗）
        await auditLogService_1.auditLogService.log({
            action: 'audit_log_cleanup',
            actor: 'admin',
            actorIp: ip,
            actorAgent: userAgent,
            targetType: 'system',
            status: 'failure',
            errorMessage: message
        });
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/database/migrate-audit-logs
 * audit_logsテーブルを作成（初回セットアップ用）
 */
exports.adminRouter.post('/database/migrate-audit-logs', async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    try {
        console.log('[Admin] Creating audit_logs table...');
        // テーブル作成SQL実行
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        actor VARCHAR(255) NOT NULL,
        actor_ip VARCHAR(45) NOT NULL,
        actor_agent TEXT,
        target_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(255),
        details JSONB,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('[Admin] ✓ Created audit_logs table');
        // インデックス作成
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON audit_logs(action, created_at DESC);
    `);
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at ON audit_logs(actor, created_at DESC);
    `);
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_ip_created_at ON audit_logs(actor_ip, created_at DESC);
    `);
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type_created_at ON audit_logs(target_type, created_at DESC);
    `);
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `);
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_status_created_at ON audit_logs(status, created_at DESC);
    `);
        console.log('[Admin] ✓ Created indexes');
        // Prisma Clientを再生成（非同期で実行、応答には含めない）
        console.log('[Admin] Note: Run "npx prisma generate" to update Prisma Client');
        // 初回の監査ログを記録（テーブルが作成されたので記録可能）
        await auditLogService_1.auditLogService.log({
            action: 'database_migration_audit_logs',
            actor: 'admin',
            actorIp: ip,
            actorAgent: userAgent,
            targetType: 'database',
            targetId: 'audit_logs',
            details: { migration: 'create_audit_logs_table' },
            status: 'success'
        });
        res.json({
            success: true,
            data: {
                message: 'Audit logs table created successfully',
                note: 'Run "npx prisma generate" to update Prisma Client'
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error creating audit_logs table:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
// ============================================
// アラート・通知 (Alerts & Notifications)
// ============================================
/**
 * GET /api/admin/alerts
 * アラート一覧を取得
 */
exports.adminRouter.get('/alerts', async (req, res) => {
    try {
        const { limit, offset, type, severity, acknowledged, resolved } = req.query;
        const options = {};
        if (limit)
            options.limit = parseInt(limit);
        if (offset)
            options.offset = parseInt(offset);
        if (type)
            options.type = type;
        if (severity)
            options.severity = severity;
        if (acknowledged !== undefined)
            options.acknowledged = acknowledged === 'true';
        if (resolved !== undefined)
            options.resolved = resolved === 'true';
        const result = await alertService_1.alertService.getAlerts(options);
        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting alerts:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/alerts/unread-count
 * 未読アラート数を取得
 */
exports.adminRouter.get('/alerts/unread-count', async (req, res) => {
    try {
        const count = await alertService_1.alertService.getUnreadCount();
        res.json({
            success: true,
            data: { count },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting unread alert count:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/alerts/:id/acknowledge
 * アラートを確認済みにする
 */
exports.adminRouter.post('/alerts/:id/acknowledge', async (req, res) => {
    try {
        const { id } = req.params;
        const { acknowledgedBy } = req.body;
        if (!acknowledgedBy) {
            return res.status(400).json({
                success: false,
                error: 'acknowledgedBy is required',
                timestamp: new Date().toISOString()
            });
        }
        await alertService_1.alertService.acknowledgeAlert(id, acknowledgedBy);
        res.json({
            success: true,
            data: { message: 'Alert acknowledged' },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error acknowledging alert:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/alerts/:id/resolve
 * アラートを解決済みにする
 */
exports.adminRouter.post('/alerts/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        await alertService_1.alertService.resolveAlert(id);
        res.json({
            success: true,
            data: { message: 'Alert resolved' },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error resolving alert:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/alert-settings
 * アラート設定を取得
 */
exports.adminRouter.get('/alert-settings', async (req, res) => {
    try {
        const settings = await alertService_1.alertService.getSettings();
        res.json({
            success: true,
            data: settings,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error getting alert settings:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * PUT /api/admin/alert-settings/:type
 * アラート設定を更新
 */
exports.adminRouter.put('/alert-settings/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { enabled, threshold, notifyEmail, notifySlack, notifyWebhook } = req.body;
        const data = {};
        if (enabled !== undefined)
            data.enabled = enabled;
        if (threshold !== undefined)
            data.threshold = threshold;
        if (notifyEmail !== undefined)
            data.notifyEmail = notifyEmail;
        if (notifySlack !== undefined)
            data.notifySlack = notifySlack;
        if (notifyWebhook !== undefined)
            data.notifyWebhook = notifyWebhook;
        await alertService_1.alertService.updateSetting(type, data);
        res.json({
            success: true,
            data: { message: 'Alert setting updated' },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error updating alert setting:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/database/migrate-alerts
 * alerts と alert_settings テーブルを作成
 */
exports.adminRouter.post('/database/migrate-alerts', async (req, res) => {
    try {
        console.log('[Admin] Creating alerts and alert_settings tables...');
        // alerts テーブル作成
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS alerts (
        id BIGSERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        details JSONB,
        acknowledged BOOLEAN NOT NULL DEFAULT false,
        acknowledged_at TIMESTAMPTZ(6),
        acknowledged_by VARCHAR(255),
        resolved BOOLEAN NOT NULL DEFAULT false,
        resolved_at TIMESTAMPTZ(6),
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('[Admin] ✓ Created alerts table');
        // インデックス作成
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_type_created_at_idx ON alerts (type, created_at DESC);
    `);
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_severity_created_at_idx ON alerts (severity, created_at DESC);
    `);
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_acknowledged_created_at_idx ON alerts (acknowledged, created_at DESC);
    `);
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_resolved_created_at_idx ON alerts (resolved, created_at DESC);
    `);
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts (created_at DESC);
    `);
        console.log('[Admin] ✓ Created alerts indexes');
        // alert_settings テーブル作成
        await prismaService_1.default.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS alert_settings (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) UNIQUE NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        threshold DOUBLE PRECISION,
        notify_email BOOLEAN NOT NULL DEFAULT false,
        notify_slack BOOLEAN NOT NULL DEFAULT false,
        notify_webhook BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('[Admin] ✓ Created alert_settings table');
        // デフォルト設定を挿入
        await prismaService_1.default.$executeRawUnsafe(`
      INSERT INTO alert_settings (type, enabled, threshold, notify_email, notify_slack, notify_webhook) VALUES
        ('cpu_high', true, 80.0, false, false, false),
        ('memory_high', true, 85.0, false, false, false),
        ('rate_limit_low', true, 20.0, false, false, false),
        ('quota_low', true, 10.0, false, false, false),
        ('security', true, NULL, false, false, false),
        ('error_spike', true, NULL, false, false, false)
      ON CONFLICT (type) DO NOTHING;
    `);
        console.log('[Admin] ✓ Inserted default alert settings');
        console.log('[Admin] Alerts tables created successfully');
        // 監査ログに記録
        await auditLogService_1.auditLogService.log({
            action: 'database_migration_alerts',
            actor: 'admin',
            actorIp: req.ip || 'unknown',
            actorAgent: req.headers['user-agent'],
            targetType: 'database',
            targetId: 'alerts',
            details: {
                description: 'Created alerts and alert_settings tables'
            },
            status: 'success'
        });
        res.json({
            success: true,
            data: {
                message: 'Alerts tables created successfully',
                tables: ['alerts', 'alert_settings']
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error creating alerts tables:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * エラーテストモードの状態管理（メモリ）
 */
let errorTestModeEnabled = false;
/**
 * エラーテストモードの状態を取得
 */
const getErrorTestModeStatus = () => {
    return errorTestModeEnabled;
};
exports.getErrorTestModeStatus = getErrorTestModeStatus;
/**
 * エラーテストモードの状態を設定
 */
const setErrorTestModeStatus = (enabled) => {
    errorTestModeEnabled = enabled;
};
exports.setErrorTestModeStatus = setErrorTestModeStatus;
/**
 * GET /api/admin/test/error/status
 * エラーテストモードの状態を取得
 */
exports.adminRouter.get('/test/error/status', (req, res) => {
    res.json({
        success: true,
        data: {
            enabled: (0, exports.getErrorTestModeStatus)()
        },
        timestamp: new Date().toISOString()
    });
});
/**
 * POST /api/admin/test/error/enable
 * エラーテストモードを有効化
 */
exports.adminRouter.post('/test/error/enable', async (req, res) => {
    try {
        (0, exports.setErrorTestModeStatus)(true);
        // 監査ログに記録
        await auditLogService_1.auditLogService.log({
            action: 'enable_error_test_mode',
            actor: 'admin',
            actorIp: req.ip || 'unknown',
            actorAgent: req.headers['user-agent'],
            targetType: 'system',
            targetId: 'error_test_mode',
            details: {
                description: 'Enabled error test mode'
            },
            status: 'success'
        });
        console.log('[Admin] Error test mode enabled');
        res.json({
            success: true,
            data: {
                enabled: true,
                message: 'Error test mode enabled. Main service will throw an error on next page load.'
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error enabling error test mode:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/test/error/disable
 * エラーテストモードを無効化
 */
exports.adminRouter.post('/test/error/disable', async (req, res) => {
    try {
        (0, exports.setErrorTestModeStatus)(false);
        // 監査ログに記録
        await auditLogService_1.auditLogService.log({
            action: 'disable_error_test_mode',
            actor: 'admin',
            actorIp: req.ip || 'unknown',
            actorAgent: req.headers['user-agent'],
            targetType: 'system',
            targetId: 'error_test_mode',
            details: {
                description: 'Disabled error test mode'
            },
            status: 'success'
        });
        console.log('[Admin] Error test mode disabled');
        res.json({
            success: true,
            data: {
                enabled: false,
                message: 'Error test mode disabled'
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin] Error disabling error test mode:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
//# sourceMappingURL=admin.js.map