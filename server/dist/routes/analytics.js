"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = exports.setAnalyticsTracker = void 0;
const express_1 = require("express");
// analyticsTrackerインスタンスは index.ts からインポート
let analyticsTrackerInstance = null;
const setAnalyticsTracker = (tracker) => {
    analyticsTrackerInstance = tracker;
};
exports.setAnalyticsTracker = setAnalyticsTracker;
exports.analyticsRouter = (0, express_1.Router)();
/**
 * POST /api/analytics/track
 * イベントをトラッキング
 */
exports.analyticsRouter.post('/track', async (req, res) => {
    try {
        const event = req.body;
        // デバッグ: イベント受信ログ
        console.log('[Analytics] Event received:', {
            type: event?.type,
            timestamp: event?.timestamp,
            bodySize: JSON.stringify(req.body).length
        });
        if (!event || !event.type) {
            console.warn('[Analytics] Invalid event data received');
            return res.status(400).json({
                success: false,
                error: 'Invalid event data',
                timestamp: new Date().toISOString()
            });
        }
        // クライアントのIPアドレスを取得
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded
            ? (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
            : req.ip || req.socket.remoteAddress || 'unknown';
        console.log('[Analytics] Event details:', {
            type: event.type,
            ip: ip,
            hasUserAgent: !!event.userAgent
        });
        // User-Agent情報を追加
        if (!event.userAgent && req.headers['user-agent']) {
            event.userAgent = req.headers['user-agent'];
        }
        // デバッグ: analyticsTrackerInstanceの存在確認
        console.log('[Analytics] Tracker status:', {
            trackerExists: !!analyticsTrackerInstance,
            trackerType: analyticsTrackerInstance ? typeof analyticsTrackerInstance : 'undefined'
        });
        // イベントを記録
        if (analyticsTrackerInstance) {
            console.log('[Analytics] Calling trackEvent...');
            await analyticsTrackerInstance.trackEvent(event, ip);
            console.log('[Analytics] trackEvent completed successfully');
        }
        else {
            console.warn('[Analytics] Analytics tracker not initialized - event not recorded');
        }
        res.json({
            success: true,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Analytics] Error tracking event:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            eventType: req.body?.type
        });
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/analytics/stats
 * 統計データを取得（管理用）
 */
exports.analyticsRouter.get('/stats', async (req, res) => {
    try {
        const daysParam = req.query.days;
        const days = daysParam ? parseInt(daysParam, 10) : 30;
        if (!analyticsTrackerInstance) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service not available',
                timestamp: new Date().toISOString()
            });
        }
        const stats = await analyticsTrackerInstance.getStats(days);
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Analytics] Error getting stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/analytics/export
 * 統計データをエクスポート（CSV/JSON）
 */
exports.analyticsRouter.get('/export', async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const daysParam = req.query.days;
        const days = daysParam ? parseInt(daysParam, 10) : 30;
        if (!analyticsTrackerInstance) {
            return res.status(503).json({
                success: false,
                error: 'Analytics service not available'
            });
        }
        const stats = await analyticsTrackerInstance.getStats(days);
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
        console.error('[Analytics] Error exporting stats:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
//# sourceMappingURL=analytics.js.map