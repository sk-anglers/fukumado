"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStore = void 0;
/**
 * ログストア - メモリ内でログを保持
 */
class LogStore {
    constructor() {
        this.accessLogs = [];
        this.errorLogs = [];
        this.securityLogs = [];
        this.MAX_ACCESS_LOGS = 1000;
        this.MAX_ERROR_LOGS = 500;
        this.MAX_SECURITY_LOGS = 500;
    }
    /**
     * アクセスログを追加
     */
    addAccessLog(req, res, responseTime) {
        const entry = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            ip: req.ip || 'unknown',
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.headers['user-agent'] || 'unknown',
            sessionId: req.sessionID
        };
        this.accessLogs.unshift(entry);
        // 最大数を超えた場合は古いログを削除
        if (this.accessLogs.length > this.MAX_ACCESS_LOGS) {
            this.accessLogs.pop();
        }
    }
    /**
     * エラーログを追加
     */
    addErrorLog(level, message, stack, context) {
        const entry = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            level,
            message,
            stack,
            context
        };
        this.errorLogs.unshift(entry);
        if (this.errorLogs.length > this.MAX_ERROR_LOGS) {
            this.errorLogs.pop();
        }
    }
    /**
     * セキュリティログを追加
     */
    addSecurityLog(type, ip, reason, path, metadata) {
        const entry = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            type,
            ip,
            path,
            reason,
            metadata
        };
        this.securityLogs.unshift(entry);
        if (this.securityLogs.length > this.MAX_SECURITY_LOGS) {
            this.securityLogs.pop();
        }
    }
    /**
     * アクセスログを取得（フィルタリング付き）
     */
    getAccessLogs(options) {
        let filtered = [...this.accessLogs];
        // 日時範囲フィルター
        if (options.startDate) {
            const start = new Date(options.startDate).getTime();
            filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= start);
        }
        if (options.endDate) {
            const end = new Date(options.endDate).getTime();
            filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= end);
        }
        // メソッドフィルター
        if (options.method) {
            filtered = filtered.filter(log => log.method === options.method);
        }
        // ステータスコードフィルター
        if (options.statusCode) {
            filtered = filtered.filter(log => log.statusCode === options.statusCode);
        }
        // パス検索
        if (options.searchPath) {
            filtered = filtered.filter(log => log.path.includes(options.searchPath));
        }
        const total = filtered.length;
        const offset = options.offset || 0;
        const limit = options.limit || 100;
        return {
            logs: filtered.slice(offset, offset + limit),
            total
        };
    }
    /**
     * エラーログを取得（フィルタリング付き）
     */
    getErrorLogs(options) {
        let filtered = [...this.errorLogs];
        // レベルフィルター
        if (options.level) {
            filtered = filtered.filter(log => log.level === options.level);
        }
        // メッセージ検索
        if (options.searchMessage) {
            filtered = filtered.filter(log => log.message.toLowerCase().includes(options.searchMessage.toLowerCase()));
        }
        const total = filtered.length;
        const offset = options.offset || 0;
        const limit = options.limit || 100;
        return {
            logs: filtered.slice(offset, offset + limit),
            total
        };
    }
    /**
     * セキュリティログを取得（フィルタリング付き）
     */
    getSecurityLogs(options) {
        let filtered = [...this.securityLogs];
        // タイプフィルター
        if (options.type) {
            filtered = filtered.filter(log => log.type === options.type);
        }
        // IP検索
        if (options.searchIp) {
            filtered = filtered.filter(log => log.ip.includes(options.searchIp));
        }
        const total = filtered.length;
        const offset = options.offset || 0;
        const limit = options.limit || 100;
        return {
            logs: filtered.slice(offset, offset + limit),
            total
        };
    }
    /**
     * ログサマリーを取得
     */
    getSummary() {
        // 直近1時間のエラー
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const recentErrors = this.errorLogs.filter(log => new Date(log.timestamp).getTime() > oneHourAgo).length;
        // 直近1時間のセキュリティイベント
        const recentSecurityEvents = this.securityLogs.filter(log => new Date(log.timestamp).getTime() > oneHourAgo).length;
        return {
            totalAccessLogs: this.accessLogs.length,
            totalErrorLogs: this.errorLogs.length,
            totalSecurityLogs: this.securityLogs.length,
            recentErrors,
            recentSecurityEvents
        };
    }
    /**
     * ログをクリア
     */
    clearLogs(type) {
        switch (type) {
            case 'access':
                this.accessLogs = [];
                break;
            case 'error':
                this.errorLogs = [];
                break;
            case 'security':
                this.securityLogs = [];
                break;
            case 'all':
                this.accessLogs = [];
                this.errorLogs = [];
                this.securityLogs = [];
                break;
        }
    }
    /**
     * ID生成
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
// シングルトンインスタンス
exports.logStore = new LogStore();
//# sourceMappingURL=logStore.js.map