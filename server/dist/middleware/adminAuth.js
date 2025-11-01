"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminApiAuth = void 0;
const env_1 = require("../config/env");
/**
 * 管理APIエンドポイント用の認証ミドルウェア
 * X-Admin-API-Keyヘッダーで認証を行う
 */
const adminApiAuth = (req, res, next) => {
    const apiKey = req.headers['x-admin-api-key'];
    // APIキーが提供されていない場合
    if (!apiKey) {
        console.warn('[Admin Auth] API key missing', {
            ip: req.ip,
            path: req.path,
            userAgent: req.headers['user-agent']
        });
        res.status(401).json({
            success: false,
            error: 'API key required',
            timestamp: new Date().toISOString()
        });
        return;
    }
    // APIキーが一致しない場合
    if (apiKey !== env_1.env.adminApiKey) {
        console.warn('[Admin Auth] Invalid API key', {
            ip: req.ip,
            path: req.path,
            userAgent: req.headers['user-agent']
        });
        res.status(403).json({
            success: false,
            error: 'Invalid API key',
            timestamp: new Date().toISOString()
        });
        return;
    }
    // 認証成功
    next();
};
exports.adminApiAuth = adminApiAuth;
//# sourceMappingURL=adminAuth.js.map