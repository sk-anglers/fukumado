"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestSize = exports.checkBlockedIP = exports.ipBlocklist = exports.websocketRateLimiter = exports.authRateLimiter = exports.apiRateLimiter = exports.securityHeaders = exports.generateNonce = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const crypto_1 = __importDefault(require("crypto"));
const prismaService_1 = __importDefault(require("../services/prismaService"));
/**
 * Nonce生成ミドルウェア
 * リクエストごとに一意のnonceを生成し、res.localsに保存
 */
const generateNonce = (req, res, next) => {
    res.locals.nonce = crypto_1.default.randomBytes(16).toString('base64');
    next();
};
exports.generateNonce = generateNonce;
/**
 * セキュリティヘッダーミドルウェア（Helmet）
 */
exports.securityHeaders = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.twitch.tv', 'https://id.twitch.tv', 'wss://eventsub.wss.twitch.tv'],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
});
/**
 * レート制限 - API全般
 * 1分間に60リクエストまで
 */
exports.apiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1分
    max: 60, // 最大60リクエスト
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`[Security] Rate limit exceeded: ${req.ip} - ${req.path}`);
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: 60,
        });
    },
});
/**
 * レート制限 - 認証エンドポイント
 * 1分間に10リクエストまで（認証は厳しく）
 */
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1分
    max: 10, // 最大10リクエスト
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
    handler: (req, res) => {
        console.warn(`[Security] Auth rate limit exceeded: ${req.ip} - ${req.path}`);
        res.status(429).json({
            error: 'Too many authentication attempts, please try again later.',
            retryAfter: 60,
        });
    },
});
/**
 * レート制限 - WebSocket関連
 * 1分間に30リクエストまで
 */
exports.websocketRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1分
    max: 30, // 最大30リクエスト
    message: { error: 'Too many WebSocket requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`[Security] WebSocket rate limit exceeded: ${req.ip} - ${req.path}`);
        res.status(429).json({
            error: 'Too many WebSocket requests, please try again later.',
            retryAfter: 60,
        });
    },
});
/**
 * IPブロックリスト管理
 */
class IPBlocklist {
    constructor() {
        this.blockedIPs = new Map();
        this.violationCount = new Map();
        this.whitelistedIPs = new Set();
        this.initialized = false;
    }
    /**
     * PostgreSQLからホワイトリストを読み込んで初期化
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            const whitelistedEntries = await prismaService_1.default.iPWhitelist.findMany({
                select: { ip: true }
            });
            whitelistedEntries.forEach(entry => {
                this.whitelistedIPs.add(entry.ip);
            });
            this.initialized = true;
            console.log(`[Security] Loaded ${whitelistedEntries.length} whitelisted IPs from database`);
        }
        catch (error) {
            console.error('[Security] Failed to load whitelist from database:', error);
            // エラーが発生してもアプリケーションは続行
            this.initialized = true;
        }
    }
    /**
     * IPをブロック
     */
    block(ip, durationMs, reason) {
        const until = new Date(Date.now() + durationMs);
        this.blockedIPs.set(ip, { until, reason });
        console.warn(`[Security] Blocked IP: ${ip} until ${until.toISOString()} - Reason: ${reason}`);
    }
    /**
     * IPがブロックされているか確認
     */
    isBlocked(ip) {
        // ホワイトリストに登録されている場合はブロック対象外
        if (this.whitelistedIPs.has(ip)) {
            return false;
        }
        const block = this.blockedIPs.get(ip);
        if (!block) {
            return false;
        }
        // ブロック期限が過ぎていれば削除
        if (block.until < new Date()) {
            this.blockedIPs.delete(ip);
            return false;
        }
        return true;
    }
    /**
     * 違反を記録し、必要に応じて自動ブロック
     */
    recordViolation(ip, type) {
        const count = (this.violationCount.get(ip) || 0) + 1;
        this.violationCount.set(ip, count);
        console.warn(`[Security] Violation recorded: ${ip} - Type: ${type} - Count: ${count}`);
        // 違反回数に応じて自動ブロック
        if (count >= 10) {
            // 10回以上の違反 → 1時間ブロック
            this.block(ip, 60 * 60 * 1000, `Multiple violations (${count})`);
            this.violationCount.delete(ip);
        }
        else if (count >= 5) {
            // 5回以上の違反 → 10分ブロック
            this.block(ip, 10 * 60 * 1000, `Repeated violations (${count})`);
        }
        // 違反カウントは5分後にリセット
        setTimeout(() => {
            const currentCount = this.violationCount.get(ip) || 0;
            if (currentCount > 0) {
                this.violationCount.set(ip, currentCount - 1);
            }
        }, 5 * 60 * 1000);
    }
    /**
     * 特定のIPのブロックを解除
     */
    unblock(ip) {
        const wasBlocked = this.blockedIPs.has(ip);
        this.blockedIPs.delete(ip);
        this.violationCount.delete(ip);
        if (wasBlocked) {
            console.log(`[Security] Unblocked IP: ${ip}`);
        }
        return wasBlocked;
    }
    /**
     * ブロックされているIPのリストを取得
     */
    getBlockedIPs() {
        const blocked = [];
        for (const [ip, data] of this.blockedIPs.entries()) {
            // 期限切れのブロックは除外
            if (data.until >= new Date()) {
                blocked.push({ ip, ...data });
            }
            else {
                this.blockedIPs.delete(ip);
            }
        }
        return blocked;
    }
    /**
     * ブロックされたIPの統計を取得
     */
    getStats() {
        return {
            blockedCount: this.blockedIPs.size,
            violationCount: this.violationCount.size,
        };
    }
    /**
     * IPをホワイトリストに追加
     */
    async addToWhitelist(ip, reason) {
        try {
            // PostgreSQLに保存（upsert: 既に存在する場合は更新）
            await prismaService_1.default.iPWhitelist.upsert({
                where: { ip },
                create: { ip, reason: reason || null },
                update: { reason: reason || null }
            });
            // メモリにも追加
            this.whitelistedIPs.add(ip);
            // ホワイトリストに追加されたIPのブロックと違反カウントを削除
            this.blockedIPs.delete(ip);
            this.violationCount.delete(ip);
            console.log(`[Security] Added IP to whitelist: ${ip}`);
        }
        catch (error) {
            console.error(`[Security] Failed to add IP to whitelist in database: ${ip}`, error);
            throw error;
        }
    }
    /**
     * IPをホワイトリストから削除
     */
    async removeFromWhitelist(ip) {
        try {
            // PostgreSQLから削除
            const result = await prismaService_1.default.iPWhitelist.deleteMany({
                where: { ip }
            });
            // メモリからも削除
            const wasWhitelisted = this.whitelistedIPs.has(ip);
            this.whitelistedIPs.delete(ip);
            if (wasWhitelisted || result.count > 0) {
                console.log(`[Security] Removed IP from whitelist: ${ip}`);
            }
            return wasWhitelisted;
        }
        catch (error) {
            console.error(`[Security] Failed to remove IP from whitelist in database: ${ip}`, error);
            throw error;
        }
    }
    /**
     * ホワイトリストに登録されているIPのリストを取得
     */
    getWhitelistedIPs() {
        return Array.from(this.whitelistedIPs);
    }
    /**
     * IPがホワイトリストに登録されているか確認
     */
    isWhitelisted(ip) {
        return this.whitelistedIPs.has(ip);
    }
    /**
     * ブロックリストをクリア（テスト用）
     */
    clear() {
        this.blockedIPs.clear();
        this.violationCount.clear();
    }
}
exports.ipBlocklist = new IPBlocklist();
/**
 * IPブロックチェックミドルウェア
 */
const checkBlockedIP = (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (exports.ipBlocklist.isBlocked(ip)) {
        console.warn(`[Security] Blocked IP attempted access: ${ip} - ${req.path}`);
        res.status(403).json({
            error: 'Access denied. Your IP has been temporarily blocked due to suspicious activity.',
        });
        return;
    }
    next();
};
exports.checkBlockedIP = checkBlockedIP;
/**
 * リクエストサイズ制限の検証
 */
const validateRequestSize = (req, res, next) => {
    const contentLength = req.get('content-length');
    if (contentLength && parseInt(contentLength) > 100 * 1024) {
        // 100KB以上
        const ip = req.ip || 'unknown';
        console.warn(`[Security] Large request rejected: ${ip} - Size: ${contentLength} bytes`);
        exports.ipBlocklist.recordViolation(ip, 'large_request');
        res.status(413).json({ error: 'Request too large' });
        return;
    }
    next();
};
exports.validateRequestSize = validateRequestSize;
//# sourceMappingURL=security.js.map