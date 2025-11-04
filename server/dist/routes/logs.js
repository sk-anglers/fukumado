"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsRouter = void 0;
const express_1 = require("express");
const securityLogService_1 = require("../services/securityLogService");
const securityLogService = new securityLogService_1.SecurityLogService();
exports.logsRouter = (0, express_1.Router)();
/**
 * GET /api/admin/logs/access
 * アクセスログ取得
 */
exports.logsRouter.get('/access', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const method = req.query.method;
        const statusCode = req.query.statusCode ? parseInt(req.query.statusCode) : undefined;
        const searchPath = req.query.searchPath;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const result = await securityLogService.getAccessLogs({
            limit,
            offset,
            method,
            statusCode,
            searchPath,
            startDate,
            endDate
        });
        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Logs] Error getting access logs:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/logs/error
 * エラーログ取得
 */
exports.logsRouter.get('/error', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const level = req.query.level;
        const searchMessage = req.query.searchMessage;
        const result = await securityLogService.getErrorLogs({
            limit,
            offset,
            level,
            searchMessage
        });
        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Logs] Error getting error logs:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/logs/security
 * セキュリティログ取得
 */
exports.logsRouter.get('/security', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type;
        const searchIp = req.query.searchIp;
        const result = await securityLogService.getSecurityLogs({
            limit,
            offset,
            type,
            searchIp
        });
        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Logs] Error getting security logs:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/logs/summary
 * ログサマリー取得
 */
exports.logsRouter.get('/summary', async (req, res) => {
    try {
        const summary = await securityLogService.getSummary();
        res.json({
            success: true,
            data: summary,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Logs] Error getting log summary:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * DELETE /api/admin/logs/:type
 * ログクリア
 */
exports.logsRouter.delete('/:type', async (req, res) => {
    try {
        const type = req.params.type;
        if (!['access', 'error', 'security', 'all'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid log type',
                timestamp: new Date().toISOString()
            });
        }
        await securityLogService.clearLogs(type);
        console.log(`[Logs] Cleared ${type} logs`);
        res.json({
            success: true,
            data: { type, cleared: true },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Logs] Error clearing logs:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
//# sourceMappingURL=logs.js.map