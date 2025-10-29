"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maintenanceRouter = void 0;
const express_1 = require("express");
const maintenanceService_1 = require("../services/maintenanceService");
exports.maintenanceRouter = (0, express_1.Router)();
/**
 * GET /api/admin/maintenance/status
 * メンテナンスモード状態取得
 */
exports.maintenanceRouter.get('/status', async (req, res) => {
    try {
        const status = await maintenanceService_1.maintenanceService.getStatus();
        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/maintenance/enable
 * メンテナンスモード有効化
 */
exports.maintenanceRouter.post('/enable', async (req, res) => {
    try {
        const { message, generateBypass, duration } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required',
                timestamp: new Date().toISOString()
            });
        }
        // durationのバリデーション（分単位、0=無期限）
        const maintenanceDuration = typeof duration === 'number' && duration >= 0 ? duration : 0;
        const status = await maintenanceService_1.maintenanceService.enable(message, generateBypass === true, maintenanceDuration);
        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/admin/maintenance/disable
 * メンテナンスモード無効化
 */
exports.maintenanceRouter.post('/disable', async (req, res) => {
    try {
        await maintenanceService_1.maintenanceService.disable();
        res.json({
            success: true,
            data: {
                enabled: false,
                disabledAt: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
//# sourceMappingURL=maintenance.js.map