"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consentRouter = void 0;
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const validation_1 = require("../middleware/validation");
const consentManager_1 = require("../services/consentManager");
exports.consentRouter = (0, express_1.Router)();
/**
 * POST /api/consent
 * 同意を記録
 */
exports.consentRouter.post('/', [
    (0, express_validator_1.body)('consents').isArray().withMessage('Consents must be an array'),
    (0, express_validator_1.body)('consents.*.type')
        .isIn(['terms', 'privacy', 'essential_cookies', 'analytics_cookies', 'marketing_cookies'])
        .withMessage('Invalid consent type'),
    (0, express_validator_1.body)('consents.*.granted').isBoolean().withMessage('Granted must be a boolean'),
    validation_1.handleValidationErrors
], (req, res) => {
    try {
        const sessionId = req.session?.id || 'unknown';
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.get('user-agent') || 'unknown';
        const { consents } = req.body;
        const record = consentManager_1.consentManager.recordConsent(sessionId, ipAddress, userAgent, consents);
        console.log('[Consent API] Consent recorded:', {
            sessionId: sessionId.substring(0, 8),
            consentTypes: consents.map((c) => c.type).join(', ')
        });
        res.status(201).json({
            success: true,
            message: 'Consent recorded successfully',
            record: {
                id: record.id,
                timestamp: record.timestamp,
                consents: record.consents
            }
        });
    }
    catch (error) {
        console.error('[Consent API] Error recording consent:', error);
        res.status(500).json({
            error: 'Failed to record consent'
        });
    }
});
/**
 * GET /api/consent/status
 * セッションの同意状態を取得
 */
exports.consentRouter.get('/status', (req, res) => {
    try {
        const sessionId = req.session?.id || 'unknown';
        const status = consentManager_1.consentManager.getConsentStatus(sessionId);
        const needs = consentManager_1.consentManager.needsConsent(sessionId);
        res.json({
            status,
            needs,
            currentVersions: consentManager_1.consentManager.getCurrentVersions()
        });
    }
    catch (error) {
        console.error('[Consent API] Error fetching consent status:', error);
        res.status(500).json({
            error: 'Failed to fetch consent status'
        });
    }
});
/**
 * POST /api/consent/revoke
 * 同意を撤回
 */
exports.consentRouter.post('/revoke', [
    (0, express_validator_1.body)('types').isArray().withMessage('Types must be an array'),
    (0, express_validator_1.body)('types.*')
        .isIn(['terms', 'privacy', 'essential_cookies', 'analytics_cookies', 'marketing_cookies'])
        .withMessage('Invalid consent type'),
    validation_1.handleValidationErrors
], (req, res) => {
    try {
        const sessionId = req.session?.id || 'unknown';
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.get('user-agent') || 'unknown';
        const { types } = req.body;
        const record = consentManager_1.consentManager.revokeConsent(sessionId, ipAddress, userAgent, types);
        console.log('[Consent API] Consent revoked:', {
            sessionId: sessionId.substring(0, 8),
            types: types.join(', ')
        });
        res.json({
            success: true,
            message: 'Consent revoked successfully',
            record: {
                id: record.id,
                timestamp: record.timestamp,
                consents: record.consents
            }
        });
    }
    catch (error) {
        console.error('[Consent API] Error revoking consent:', error);
        res.status(500).json({
            error: 'Failed to revoke consent'
        });
    }
});
/**
 * GET /api/consent/export
 * GDPR準拠のデータエクスポート
 */
exports.consentRouter.get('/export', (req, res) => {
    try {
        const sessionId = req.session?.id || 'unknown';
        const exportData = consentManager_1.consentManager.exportConsentData(sessionId);
        console.log('[Consent API] Data exported:', {
            sessionId: sessionId.substring(0, 8),
            recordCount: exportData.records.length
        });
        res.json(exportData);
    }
    catch (error) {
        console.error('[Consent API] Error exporting data:', error);
        res.status(500).json({
            error: 'Failed to export consent data'
        });
    }
});
/**
 * GET /api/consent/history
 * セッションの全同意記録を取得
 */
exports.consentRouter.get('/history', (req, res) => {
    try {
        const sessionId = req.session?.id || 'unknown';
        const history = consentManager_1.consentManager.getConsentHistory(sessionId);
        res.json({
            sessionId,
            total: history.length,
            history
        });
    }
    catch (error) {
        console.error('[Consent API] Error fetching history:', error);
        res.status(500).json({
            error: 'Failed to fetch consent history'
        });
    }
});
/**
 * GET /api/consent/stats
 * 同意統計情報を取得（管理者用）
 */
exports.consentRouter.get('/stats', (req, res) => {
    try {
        const stats = consentManager_1.consentManager.getStats();
        res.json({
            timestamp: new Date().toISOString(),
            stats
        });
    }
    catch (error) {
        console.error('[Consent API] Error fetching stats:', error);
        res.status(500).json({
            error: 'Failed to fetch consent statistics'
        });
    }
});
//# sourceMappingURL=consent.js.map