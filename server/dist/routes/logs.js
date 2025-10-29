"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsRouter = void 0;
const express_1 = require("express");
const logStore_1 = require("../utils/logStore");
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
        const result = logStore_1.logStore.getAccessLogs({
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
        const result = logStore_1.logStore.getErrorLogs({
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
        const result = logStore_1.logStore.getSecurityLogs({
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
        const summary = logStore_1.logStore.getSummary();
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
        logStore_1.logStore.clearLogs(type);
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