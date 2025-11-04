"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAccessStats = exports.accessLogStats = exports.AccessLogStats = exports.SecurityLogger = exports.errorLogger = exports.requestLogger = exports.productionLogger = exports.developmentLogger = void 0;
const morgan_1 = __importDefault(require("morgan"));
const securityLogService_1 = require("../services/securityLogService");
// セキュリティログサービスのインスタンス
const securityLogService = new securityLogService_1.SecurityLogService();
/**
 * カスタムトークン定義
 */
// セッションIDトークン
morgan_1.default.token('session-id', (req) => {
    return req.sessionID || 'no-session';
});
// リアルIPアドレストークン（プロキシ経由の場合も考慮）
morgan_1.default.token('real-ip', (req) => {
    return req.headers['x-forwarded-for']?.toString() || req.ip || 'unknown';
});
// レスポンス時間（ミリ秒）
morgan_1.default.token('response-time-ms', (req, res) => {
    const startTime = req._startTime;
    if (!startTime)
        return '0';
    return `${Date.now() - startTime}ms`;
});
/**
 * カスタムログフォーマット
 */
const customFormat = [
    '[:date[iso]]',
    ':real-ip',
    ':method',
    ':url',
    'HTTP/:http-version',
    ':status',
    ':res[content-length]',
    ':response-time ms',
    'session=:session-id',
    'user-agent=":user-agent"'
].join(' ');
/**
 * HTTPリクエストログミドルウェア（開発環境用）
 */
exports.developmentLogger = (0, morgan_1.default)('dev', {
    skip: (req) => {
        // ヘルスチェックはログ出力をスキップ
        return req.path === '/health';
    }
});
/**
 * HTTPリクエストログミドルウェア（本番環境用）
 */
exports.productionLogger = (0, morgan_1.default)(customFormat, {
    skip: (req) => {
        // ヘルスチェックはログ出力をスキップ
        return req.path === '/health';
    }
});
/**
 * 環境に応じたロガーを選択
 */
exports.requestLogger = process.env.NODE_ENV === 'production'
    ? exports.productionLogger
    : exports.developmentLogger;
/**
 * エラーログミドルウェア
 * エラーレスポンス（4xx, 5xx）のみをログ出力
 */
exports.errorLogger = (0, morgan_1.default)(customFormat, {
    skip: (req, res) => {
        // 2xx, 3xx のレスポンスはスキップ
        return res.statusCode < 400;
    }
});
/**
 * セキュリティ関連のログ
 */
class SecurityLogger {
    /**
     * ブロックされたリクエストをログ出力
     */
    static logBlockedRequest(ip, reason, path, metadata) {
        const timestamp = new Date().toISOString();
        console.warn(`[Security Block] ${timestamp} - IP: ${ip} - Path: ${path} - Reason: ${reason}`, metadata || '');
        securityLogService.addSecurityLog('block', ip, reason, path, metadata);
    }
    /**
     * レート制限違反をログ出力
     */
    static logRateLimitViolation(ip, path, currentCount, limit) {
        const timestamp = new Date().toISOString();
        console.warn(`[Rate Limit] ${timestamp} - IP: ${ip} - Path: ${path} - Count: ${currentCount}/${limit}`);
        securityLogService.addSecurityLog('rate_limit', ip, `Rate limit exceeded: ${currentCount}/${limit}`, path, { currentCount, limit });
    }
    /**
     * 異常なアクセスパターンをログ出力
     */
    static logAnomalousActivity(ip, pattern, details) {
        const timestamp = new Date().toISOString();
        console.warn(`[Anomaly Detected] ${timestamp} - IP: ${ip} - Pattern: ${pattern}`, details);
        securityLogService.addSecurityLog('anomaly', ip, pattern, undefined, details);
    }
    /**
     * WebSocket接続イベントをログ出力
     */
    static logWebSocketEvent(event, ip, metadata) {
        const timestamp = new Date().toISOString();
        const level = event === 'error' ? 'ERROR' : 'INFO';
        console.log(`[WebSocket ${level}] ${timestamp} - Event: ${event} - IP: ${ip}`, metadata || '');
    }
    /**
     * 認証関連イベントをログ出力
     */
    static logAuthEvent(event, userId, ip, metadata) {
        const timestamp = new Date().toISOString();
        const level = event === 'auth_failed' ? 'WARN' : 'INFO';
        console.log(`[Auth ${level}] ${timestamp} - Event: ${event} - User: ${userId || 'anonymous'} - IP: ${ip}`, metadata || '');
    }
    /**
     * データアクセスをログ出力（将来的な監査ログ用）
     */
    static logDataAccess(userId, resource, action, ip) {
        const timestamp = new Date().toISOString();
        console.log(`[Data Access] ${timestamp} - User: ${userId} - Resource: ${resource} - Action: ${action} - IP: ${ip}`);
    }
}
exports.SecurityLogger = SecurityLogger;
/**
 * アクセスログの統計情報を収集
 */
class AccessLogStats {
    constructor() {
        this.requestCounts = new Map(); // path -> count
        this.ipCounts = new Map(); // ip -> count
        this.errorCounts = new Map(); // status code -> count
        this.startTime = new Date();
    }
    /**
     * リクエストを記録
     */
    recordRequest(req, res) {
        // パスごとのカウント
        const path = req.path;
        this.requestCounts.set(path, (this.requestCounts.get(path) || 0) + 1);
        // IPごとのカウント
        const ip = req.ip || 'unknown';
        this.ipCounts.set(ip, (this.ipCounts.get(ip) || 0) + 1);
        // エラーステータスコードのカウント
        if (res.statusCode >= 400) {
            this.errorCounts.set(res.statusCode, (this.errorCounts.get(res.statusCode) || 0) + 1);
        }
    }
    /**
     * 統計情報を取得
     */
    getStats() {
        // 総リクエスト数
        const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
        // ユニークIP数
        const uniqueIPs = this.ipCounts.size;
        // トップパス（上位10件）
        const topPaths = Array.from(this.requestCounts.entries())
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        // トップIP（上位10件）
        const topIPs = Array.from(this.ipCounts.entries())
            .map(([ip, count]) => ({ ip, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        // エラー内訳
        const errorBreakdown = Array.from(this.errorCounts.entries())
            .map(([statusCode, count]) => ({ statusCode, count }))
            .sort((a, b) => b.count - a.count);
        // 稼働時間（秒）
        const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
        return {
            totalRequests,
            uniqueIPs,
            topPaths,
            topIPs,
            errorBreakdown,
            uptime
        };
    }
    /**
     * 統計情報をリセット
     */
    reset() {
        this.requestCounts.clear();
        this.ipCounts.clear();
        this.errorCounts.clear();
        this.startTime = new Date();
    }
}
exports.AccessLogStats = AccessLogStats;
// シングルトンインスタンス
exports.accessLogStats = new AccessLogStats();
/**
 * アクセス統計を記録するミドルウェア
 */
const recordAccessStats = (req, res, next) => {
    const startTime = Date.now();
    // レスポンス完了時に統計を記録
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        exports.accessLogStats.recordRequest(req, res);
        // セキュリティログサービスに記録（非同期）
        securityLogService.addAccessLog(req, res, responseTime).catch((error) => {
            console.error('[Logging] Error adding access log:', error);
        });
        // エラーログも記録（4xx, 5xx）
        if (res.statusCode >= 400) {
            const message = `HTTP ${res.statusCode} - ${req.method} ${req.path}`;
            const level = res.statusCode >= 500 ? 'error' : 'warn';
            securityLogService.addErrorLog(level, message, undefined, {
                ip: req.ip,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode
            }).catch((error) => {
                console.error('[Logging] Error adding error log:', error);
            });
        }
    });
    next();
};
exports.recordAccessStats = recordAccessStats;
//# sourceMappingURL=logging.js.map