"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityLogService = void 0;
const prismaService_1 = __importDefault(require("./prismaService"));
const crypto_1 = require("crypto");
/**
 * セキュリティログサービス（PostgreSQL版）
 * SecurityLogテーブルを使用してセキュリティイベントを記録・管理
 */
class SecurityLogService {
    /**
     * セキュリティログを追加
     */
    async addSecurityLog(type, ip, reason, path, metadata) {
        try {
            const ipHash = this.hashIP(ip);
            await prismaService_1.default.securityLog.create({
                data: {
                    logType: type,
                    severity: this.getSeverity(type),
                    ip,
                    ipHash,
                    endpoint: path || null,
                    method: null,
                    statusCode: null,
                    userAgent: null,
                    message: reason,
                    metadata: metadata ? metadata : undefined,
                    userId: null,
                    username: null,
                },
            });
        }
        catch (error) {
            console.error('[SecurityLogService] Error adding security log:', error);
        }
    }
    /**
     * アクセスログを追加（HTTPリクエスト）
     */
    async addAccessLog(req, res, responseTime) {
        try {
            const ip = req.ip || 'unknown';
            const ipHash = this.hashIP(ip);
            // 4xx/5xxの場合はセキュリティログとして記録
            if (res.statusCode >= 400) {
                await prismaService_1.default.securityLog.create({
                    data: {
                        logType: res.statusCode >= 500 ? 'anomaly' : 'auth_failed',
                        severity: res.statusCode >= 500 ? 'error' : 'warn',
                        ip,
                        ipHash,
                        endpoint: req.path,
                        method: req.method,
                        statusCode: res.statusCode,
                        userAgent: req.headers['user-agent'] || null,
                        message: `HTTP ${res.statusCode} - ${req.method} ${req.path}`,
                        metadata: {
                            responseTime,
                            sessionId: req.sessionID,
                        },
                        userId: null,
                        username: null,
                    },
                });
            }
        }
        catch (error) {
            console.error('[SecurityLogService] Error adding access log:', error);
        }
    }
    /**
     * エラーログを追加
     */
    async addErrorLog(level, message, stack, context) {
        try {
            await prismaService_1.default.securityLog.create({
                data: {
                    logType: 'anomaly',
                    severity: level,
                    ip: context?.ip || 'unknown',
                    ipHash: this.hashIP(context?.ip || 'unknown'),
                    endpoint: context?.path || null,
                    method: context?.method || null,
                    statusCode: context?.statusCode || null,
                    userAgent: null,
                    message,
                    metadata: {
                        stack,
                        ...context,
                    },
                    userId: null,
                    username: null,
                },
            });
        }
        catch (error) {
            console.error('[SecurityLogService] Error adding error log:', error);
        }
    }
    /**
     * セキュリティログを取得（フィルタリング付き）
     */
    async getSecurityLogs(options) {
        try {
            const where = {};
            if (options.type) {
                where.logType = options.type;
            }
            if (options.searchIp) {
                where.ip = {
                    contains: options.searchIp,
                };
            }
            const [logs, total] = await Promise.all([
                prismaService_1.default.securityLog.findMany({
                    where,
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: options.limit || 100,
                    skip: options.offset || 0,
                }),
                prismaService_1.default.securityLog.count({ where }),
            ]);
            return {
                logs: logs.map((log) => ({
                    id: log.id.toString(),
                    timestamp: log.createdAt.toISOString(),
                    type: log.logType,
                    ip: log.ip,
                    path: log.endpoint,
                    reason: log.message,
                    metadata: log.metadata,
                })),
                total,
            };
        }
        catch (error) {
            console.error('[SecurityLogService] Error getting security logs:', error);
            return { logs: [], total: 0 };
        }
    }
    /**
     * アクセスログを取得（HTTPリクエスト）
     */
    async getAccessLogs(options) {
        try {
            const where = {
                statusCode: {
                    not: null,
                },
            };
            if (options.startDate) {
                where.createdAt = { ...where.createdAt, gte: new Date(options.startDate) };
            }
            if (options.endDate) {
                where.createdAt = { ...where.createdAt, lte: new Date(options.endDate) };
            }
            if (options.method) {
                where.method = options.method;
            }
            if (options.statusCode) {
                where.statusCode = options.statusCode;
            }
            if (options.searchPath) {
                where.endpoint = {
                    contains: options.searchPath,
                };
            }
            const [logs, total] = await Promise.all([
                prismaService_1.default.securityLog.findMany({
                    where,
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: options.limit || 100,
                    skip: options.offset || 0,
                }),
                prismaService_1.default.securityLog.count({ where }),
            ]);
            return {
                logs: logs.map((log) => ({
                    id: log.id.toString(),
                    timestamp: log.createdAt.toISOString(),
                    ip: log.ip,
                    method: log.method,
                    path: log.endpoint,
                    statusCode: log.statusCode,
                    responseTime: log.metadata?.responseTime || 0,
                    userAgent: log.userAgent || 'unknown',
                    sessionId: log.metadata?.sessionId,
                })),
                total,
            };
        }
        catch (error) {
            console.error('[SecurityLogService] Error getting access logs:', error);
            return { logs: [], total: 0 };
        }
    }
    /**
     * エラーログを取得
     */
    async getErrorLogs(options) {
        try {
            const where = {
                logType: 'anomaly',
            };
            if (options.level) {
                where.severity = options.level;
            }
            if (options.searchMessage) {
                where.message = {
                    contains: options.searchMessage,
                    mode: 'insensitive',
                };
            }
            const [logs, total] = await Promise.all([
                prismaService_1.default.securityLog.findMany({
                    where,
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: options.limit || 100,
                    skip: options.offset || 0,
                }),
                prismaService_1.default.securityLog.count({ where }),
            ]);
            return {
                logs: logs.map((log) => ({
                    id: log.id.toString(),
                    timestamp: log.createdAt.toISOString(),
                    level: log.severity,
                    message: log.message,
                    stack: log.metadata?.stack,
                    context: log.metadata,
                })),
                total,
            };
        }
        catch (error) {
            console.error('[SecurityLogService] Error getting error logs:', error);
            return { logs: [], total: 0 };
        }
    }
    /**
     * ログサマリーを取得
     */
    async getSummary() {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const [accessLogs, errorLogs, securityLogs, recentErrors, recentSecurityEvents] = await Promise.all([
                // アクセスログ総数（statusCodeがnullでないもの）
                prismaService_1.default.securityLog.count({
                    where: {
                        statusCode: { not: null },
                    },
                }),
                // エラーログ総数（anomalyタイプ）
                prismaService_1.default.securityLog.count({
                    where: {
                        logType: 'anomaly',
                    },
                }),
                // セキュリティログ総数（anomaly以外）
                prismaService_1.default.securityLog.count({
                    where: {
                        logType: { not: 'anomaly' },
                    },
                }),
                // 直近1時間のエラー
                prismaService_1.default.securityLog.count({
                    where: {
                        logType: 'anomaly',
                        createdAt: { gte: oneHourAgo },
                    },
                }),
                // 直近1時間のセキュリティイベント
                prismaService_1.default.securityLog.count({
                    where: {
                        logType: { not: 'anomaly' },
                        createdAt: { gte: oneHourAgo },
                    },
                }),
            ]);
            return {
                totalAccessLogs: accessLogs,
                totalErrorLogs: errorLogs,
                totalSecurityLogs: securityLogs,
                recentErrors,
                recentSecurityEvents,
            };
        }
        catch (error) {
            console.error('[SecurityLogService] Error getting summary:', error);
            return {
                totalAccessLogs: 0,
                totalErrorLogs: 0,
                totalSecurityLogs: 0,
                recentErrors: 0,
                recentSecurityEvents: 0,
            };
        }
    }
    /**
     * ログをクリア（指定タイプ）
     */
    async clearLogs(type) {
        try {
            switch (type) {
                case 'access':
                    await prismaService_1.default.securityLog.deleteMany({
                        where: { statusCode: { not: null } },
                    });
                    break;
                case 'error':
                    await prismaService_1.default.securityLog.deleteMany({
                        where: { logType: 'anomaly' },
                    });
                    break;
                case 'security':
                    await prismaService_1.default.securityLog.deleteMany({
                        where: { logType: { not: 'anomaly' } },
                    });
                    break;
                case 'all':
                    await prismaService_1.default.securityLog.deleteMany({});
                    break;
            }
        }
        catch (error) {
            console.error('[SecurityLogService] Error clearing logs:', error);
            throw error;
        }
    }
    /**
     * タイプに応じた深刻度を取得
     */
    getSeverity(type) {
        switch (type) {
            case 'block':
            case 'rate_limit':
                return 'warn';
            case 'anomaly':
            case 'auth_failed':
                return 'error';
            case 'websocket':
                return 'info';
            default:
                return 'info';
        }
    }
    /**
     * IPアドレスをハッシュ化
     */
    hashIP(ip) {
        return (0, crypto_1.createHash)('sha256').update(ip).digest('hex').substring(0, 64);
    }
}
exports.SecurityLogService = SecurityLogService;
//# sourceMappingURL=securityLogService.js.map