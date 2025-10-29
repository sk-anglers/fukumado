"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityRouter = void 0;
const express_1 = require("express");
const security_1 = require("../middleware/security");
const websocketSecurity_1 = require("../middleware/websocketSecurity");
const anomalyDetection_1 = require("../services/anomalyDetection");
const logging_1 = require("../middleware/logging");
const express_validator_1 = require("express-validator");
const validation_1 = require("../middleware/validation");
const metricsCollector_1 = require("../services/metricsCollector");
const securityReporter_1 = require("../services/securityReporter");
const sessionSecurity_1 = require("../middleware/sessionSecurity");
const emoteCacheService_1 = require("../services/emoteCacheService");
const followedChannelsCacheService_1 = require("../services/followedChannelsCacheService");
exports.securityRouter = (0, express_1.Router)();
/**
 * GET /api/security/stats
 * セキュリティ統計情報を取得
 */
exports.securityRouter.get('/stats', (req, res) => {
    try {
        // IP Blocklist統計
        const blocklistStats = security_1.ipBlocklist.getStats();
        // WebSocket接続統計
        const wsStats = websocketSecurity_1.wsConnectionManager.getStats();
        // 異常検知統計
        const anomalyStats = anomalyDetection_1.anomalyDetectionService.getStats();
        // アクセスログ統計
        const accessStats = logging_1.accessLogStats.getStats();
        const stats = {
            timestamp: new Date().toISOString(),
            ipBlocklist: blocklistStats,
            websocket: wsStats,
            anomalyDetection: anomalyStats,
            accessLog: accessStats,
            system: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage()
            }
        };
        res.json(stats);
    }
    catch (error) {
        console.error('[Security API] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch security statistics' });
    }
});
/**
 * GET /api/security/alerts
 * 異常検知アラート一覧を取得
 */
exports.securityRouter.get('/alerts', [
    (0, validation_1.validateNumberRange)('limit', 1, 100, 'query'),
    validation_1.handleValidationErrors
], (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const alerts = anomalyDetection_1.anomalyDetectionService.getAlerts(limit);
        res.json({
            total: alerts.length,
            limit,
            alerts
        });
    }
    catch (error) {
        console.error('[Security API] Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});
/**
 * GET /api/security/alerts/:ip
 * 特定のIPのアラートを取得
 */
exports.securityRouter.get('/alerts/:ip', [
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validation_1.handleValidationErrors
], (req, res) => {
    try {
        const ip = req.params.ip;
        const limit = parseInt(req.query.limit) || 50;
        const alerts = anomalyDetection_1.anomalyDetectionService.getAlertsByIP(ip, limit);
        res.json({
            ip,
            total: alerts.length,
            limit,
            alerts
        });
    }
    catch (error) {
        console.error('[Security API] Error fetching alerts for IP:', error);
        res.status(500).json({ error: 'Failed to fetch alerts for IP' });
    }
});
/**
 * POST /api/security/alerts/clear
 * アラートをクリア（管理者用）
 */
exports.securityRouter.post('/alerts/clear', (req, res) => {
    try {
        anomalyDetection_1.anomalyDetectionService.clearAlerts();
        res.json({ success: true, message: 'Alerts cleared successfully' });
    }
    catch (error) {
        console.error('[Security API] Error clearing alerts:', error);
        res.status(500).json({ error: 'Failed to clear alerts' });
    }
});
/**
 * GET /api/security/blocked-ips
 * ブロックされたIPの一覧を取得
 */
exports.securityRouter.get('/blocked-ips', (req, res) => {
    try {
        const stats = security_1.ipBlocklist.getStats();
        res.json(stats);
    }
    catch (error) {
        console.error('[Security API] Error fetching blocked IPs:', error);
        res.status(500).json({ error: 'Failed to fetch blocked IPs' });
    }
});
/**
 * GET /api/security/websocket-connections
 * WebSocket接続状況を取得
 */
exports.securityRouter.get('/websocket-connections', (req, res) => {
    try {
        const stats = websocketSecurity_1.wsConnectionManager.getStats();
        res.json(stats);
    }
    catch (error) {
        console.error('[Security API] Error fetching WebSocket stats:', error);
        res.status(500).json({ error: 'Failed to fetch WebSocket statistics' });
    }
});
/**
 * GET /api/security/access-logs
 * アクセスログ統計を取得
 */
exports.securityRouter.get('/access-logs', (req, res) => {
    try {
        const stats = logging_1.accessLogStats.getStats();
        res.json(stats);
    }
    catch (error) {
        console.error('[Security API] Error fetching access log stats:', error);
        res.status(500).json({ error: 'Failed to fetch access log statistics' });
    }
});
/**
 * POST /api/security/access-logs/reset
 * アクセスログ統計をリセット
 */
exports.securityRouter.post('/access-logs/reset', (req, res) => {
    try {
        logging_1.accessLogStats.reset();
        res.json({ success: true, message: 'Access log statistics reset successfully' });
    }
    catch (error) {
        console.error('[Security API] Error resetting access logs:', error);
        res.status(500).json({ error: 'Failed to reset access log statistics' });
    }
});
/**
 * GET /api/security/health
 * セキュリティシステムのヘルスチェック
 */
exports.securityRouter.get('/health', (req, res) => {
    try {
        const anomalyStats = anomalyDetection_1.anomalyDetectionService.getStats();
        const wsStats = websocketSecurity_1.wsConnectionManager.getStats();
        const blocklistStats = security_1.ipBlocklist.getStats();
        // 重大なアラートがあるかチェック
        const criticalAlerts = anomalyStats.alertsBySeverity['critical'] || 0;
        const highAlerts = anomalyStats.alertsBySeverity['high'] || 0;
        const status = criticalAlerts > 0 ? 'critical' : highAlerts > 5 ? 'warning' : 'healthy';
        res.json({
            status,
            timestamp: new Date().toISOString(),
            checks: {
                anomalyDetection: {
                    status: criticalAlerts === 0 ? 'ok' : 'alert',
                    criticalAlerts,
                    highAlerts,
                    recentAlerts: anomalyStats.recentAlerts
                },
                websocket: {
                    status: wsStats.totalConnections < wsStats.maxConnectionsPerIP * 100 ? 'ok' : 'warning',
                    totalConnections: wsStats.totalConnections,
                    maxPerIP: wsStats.maxConnectionsPerIP
                },
                ipBlocklist: {
                    status: 'ok',
                    blockedIPs: blocklistStats.blockedCount,
                    violationRecords: blocklistStats.violationCount
                },
                system: {
                    status: 'ok',
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
                }
            }
        });
    }
    catch (error) {
        console.error('[Security API] Error checking health:', error);
        res.status(500).json({
            status: 'error',
            error: 'Failed to check security system health'
        });
    }
});
/**
 * GET /api/security/metrics
 * Prometheus形式のメトリクス（強化版）
 */
exports.securityRouter.get('/metrics', (req, res) => {
    try {
        const metrics = metricsCollector_1.metricsCollector.getPrometheusMetrics();
        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(metrics);
    }
    catch (error) {
        console.error('[Security API] Error generating metrics:', error);
        res.status(500).send('Failed to generate metrics');
    }
});
/**
 * GET /api/security/metrics/json
 * JSON形式のメトリクス
 */
exports.securityRouter.get('/metrics/json', (req, res) => {
    try {
        const metrics = metricsCollector_1.metricsCollector.getMetricsJSON();
        res.json(metrics);
    }
    catch (error) {
        console.error('[Security API] Error generating JSON metrics:', error);
        res.status(500).json({ error: 'Failed to generate metrics' });
    }
});
/**
 * GET /api/security/report/daily
 * 日次セキュリティレポートを生成
 */
exports.securityRouter.get('/report/daily', (req, res) => {
    try {
        const report = securityReporter_1.securityReporter.generateDailyReport();
        res.json(report);
    }
    catch (error) {
        console.error('[Security API] Error generating daily report:', error);
        res.status(500).json({ error: 'Failed to generate daily report' });
    }
});
/**
 * GET /api/security/report/weekly
 * 週次セキュリティレポートを生成
 */
exports.securityRouter.get('/report/weekly', (req, res) => {
    try {
        const report = securityReporter_1.securityReporter.generateWeeklyReport();
        res.json(report);
    }
    catch (error) {
        console.error('[Security API] Error generating weekly report:', error);
        res.status(500).json({ error: 'Failed to generate weekly report' });
    }
});
/**
 * GET /api/security/report/summary
 * セキュリティサマリー（軽量版）
 */
exports.securityRouter.get('/report/summary', (req, res) => {
    try {
        const summary = securityReporter_1.securityReporter.getQuickSummary();
        res.json(summary);
    }
    catch (error) {
        console.error('[Security API] Error generating summary:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});
/**
 * GET /api/security/report/export
 * レポートをMarkdown形式でエクスポート
 */
exports.securityRouter.get('/report/export', (req, res) => {
    try {
        const format = req.query.format || 'markdown';
        const period = req.query.period || 'daily';
        let report;
        if (period === 'weekly') {
            report = securityReporter_1.securityReporter.generateWeeklyReport();
        }
        else {
            report = securityReporter_1.securityReporter.generateDailyReport();
        }
        switch (format) {
            case 'json':
                res.set('Content-Type', 'application/json');
                res.set('Content-Disposition', `attachment; filename="security-report-${Date.now()}.json"`);
                res.send(securityReporter_1.securityReporter.exportJSON(report));
                break;
            case 'csv':
                res.set('Content-Type', 'text/csv');
                res.set('Content-Disposition', `attachment; filename="security-report-${Date.now()}.csv"`);
                res.send(securityReporter_1.securityReporter.exportCSV(report));
                break;
            case 'markdown':
            default:
                res.set('Content-Type', 'text/markdown');
                res.set('Content-Disposition', `attachment; filename="security-report-${Date.now()}.md"`);
                res.send(securityReporter_1.securityReporter.exportMarkdown(report));
                break;
        }
    }
    catch (error) {
        console.error('[Security API] Error exporting report:', error);
        res.status(500).json({ error: 'Failed to export report' });
    }
});
/**
 * GET /api/security/sessions
 * セッション統計情報を取得
 */
exports.securityRouter.get('/sessions', (req, res) => {
    try {
        const stats = sessionSecurity_1.sessionStats.getStats();
        res.json(stats);
    }
    catch (error) {
        console.error('[Security API] Error fetching session stats:', error);
        res.status(500).json({ error: 'Failed to fetch session statistics' });
    }
});
/**
 * GET /api/security/cache/emotes
 * エモートキャッシュ統計情報を取得
 */
exports.securityRouter.get('/cache/emotes', (req, res) => {
    try {
        const stats = emoteCacheService_1.emoteCacheService.getStats();
        res.json({
            timestamp: new Date().toISOString(),
            cache: stats
        });
    }
    catch (error) {
        console.error('[Security API] Error fetching emote cache stats:', error);
        res.status(500).json({ error: 'Failed to fetch emote cache statistics' });
    }
});
/**
 * POST /api/security/cache/emotes/clear
 * エモートキャッシュをクリア（管理者用）
 */
exports.securityRouter.post('/cache/emotes/clear', (req, res) => {
    try {
        emoteCacheService_1.emoteCacheService.clearAll();
        res.json({ success: true, message: 'Emote cache cleared successfully' });
    }
    catch (error) {
        console.error('[Security API] Error clearing emote cache:', error);
        res.status(500).json({ error: 'Failed to clear emote cache' });
    }
});
/**
 * POST /api/security/cache/emotes/cleanup
 * エモートキャッシュの期限切れエントリをクリーンアップ（管理者用）
 */
exports.securityRouter.post('/cache/emotes/cleanup', (req, res) => {
    try {
        const removed = emoteCacheService_1.emoteCacheService.manualCleanup();
        res.json({
            success: true,
            message: `Cleaned up ${removed} expired entries`,
            removed
        });
    }
    catch (error) {
        console.error('[Security API] Error cleaning up emote cache:', error);
        res.status(500).json({ error: 'Failed to cleanup emote cache' });
    }
});
/**
 * GET /api/security/cache/followed-channels
 * フォローチャンネルキャッシュ統計情報を取得
 */
exports.securityRouter.get('/cache/followed-channels', (req, res) => {
    try {
        const stats = followedChannelsCacheService_1.followedChannelsCacheService.getStats();
        res.json({
            timestamp: new Date().toISOString(),
            cache: stats
        });
    }
    catch (error) {
        console.error('[Security API] Error fetching followed channels cache stats:', error);
        res.status(500).json({ error: 'Failed to fetch followed channels cache statistics' });
    }
});
/**
 * POST /api/security/cache/followed-channels/clear
 * フォローチャンネルキャッシュをクリア（管理者用）
 */
exports.securityRouter.post('/cache/followed-channels/clear', (req, res) => {
    try {
        followedChannelsCacheService_1.followedChannelsCacheService.clearAll();
        res.json({ success: true, message: 'Followed channels cache cleared successfully' });
    }
    catch (error) {
        console.error('[Security API] Error clearing followed channels cache:', error);
        res.status(500).json({ error: 'Failed to clear followed channels cache' });
    }
});
/**
 * POST /api/security/cache/followed-channels/cleanup
 * フォローチャンネルキャッシュの期限切れエントリをクリーンアップ（管理者用）
 */
exports.securityRouter.post('/cache/followed-channels/cleanup', (req, res) => {
    try {
        const removed = followedChannelsCacheService_1.followedChannelsCacheService.manualCleanup();
        res.json({
            success: true,
            message: `Cleaned up ${removed} expired entries`,
            removed
        });
    }
    catch (error) {
        console.error('[Security API] Error cleaning up followed channels cache:', error);
        res.status(500).json({ error: 'Failed to cleanup followed channels cache' });
    }
});
//# sourceMappingURL=security.js.map