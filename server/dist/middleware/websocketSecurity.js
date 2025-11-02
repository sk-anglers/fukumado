"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsHeartbeat = exports.WebSocketHeartbeat = exports.wsConnectionManager = void 0;
exports.validateWebSocketMessage = validateWebSocketMessage;
const security_1 = require("./security");
/**
 * WebSocket接続管理クラス
 */
class WebSocketConnectionManager {
    constructor() {
        // IP別の接続数
        this.connectionsPerIP = new Map();
        // IP別のメッセージカウント（レート制限用）
        this.messageCountPerIP = new Map();
        // 設定
        this.maxConnectionsPerIP = 5; // 同一IPから最大5接続
        this.maxMessagesPerSecond = 10; // 1秒あたり最大10メッセージ
        this.messageWindowMs = 1000; // 1秒
    }
    /**
     * 接続を試みる（接続数制限のチェック）
     */
    canConnect(ip) {
        // IPブロックリストチェック
        if (security_1.ipBlocklist.isBlocked(ip)) {
            return { allowed: false, reason: 'IP is blocked' };
        }
        const currentConnections = this.connectionsPerIP.get(ip) || 0;
        if (currentConnections >= this.maxConnectionsPerIP) {
            console.warn(`[WebSocket Security] Connection limit exceeded: ${ip} (${currentConnections}/${this.maxConnectionsPerIP})`);
            security_1.ipBlocklist.recordViolation(ip, 'ws_connection_limit');
            return { allowed: false, reason: `Too many connections from this IP (max: ${this.maxConnectionsPerIP})` };
        }
        return { allowed: true };
    }
    /**
     * 接続を記録
     */
    registerConnection(ip) {
        const count = (this.connectionsPerIP.get(ip) || 0) + 1;
        this.connectionsPerIP.set(ip, count);
        console.log(`[WebSocket Security] Connection registered: ${ip} (Total: ${count})`);
    }
    /**
     * 接続を解除
     */
    unregisterConnection(ip) {
        const count = this.connectionsPerIP.get(ip) || 0;
        if (count > 0) {
            this.connectionsPerIP.set(ip, count - 1);
            console.log(`[WebSocket Security] Connection unregistered: ${ip} (Remaining: ${count - 1})`);
            // 接続数が0になったら削除
            if (count - 1 === 0) {
                this.connectionsPerIP.delete(ip);
            }
        }
    }
    /**
     * メッセージレート制限のチェック
     */
    canSendMessage(ip) {
        const now = new Date();
        const record = this.messageCountPerIP.get(ip);
        if (!record || record.resetAt < now) {
            // 新しいウィンドウを開始
            this.messageCountPerIP.set(ip, {
                count: 1,
                resetAt: new Date(now.getTime() + this.messageWindowMs),
            });
            return { allowed: true };
        }
        if (record.count >= this.maxMessagesPerSecond) {
            console.warn(`[WebSocket Security] Message rate limit exceeded: ${ip} (${record.count}/${this.maxMessagesPerSecond})`);
            security_1.ipBlocklist.recordViolation(ip, 'ws_message_rate');
            return { allowed: false, reason: 'Too many messages per second' };
        }
        record.count++;
        return { allowed: true };
    }
    /**
     * 統計情報を取得
     */
    getStats() {
        const connectionsPerIP = {};
        this.connectionsPerIP.forEach((count, ip) => {
            connectionsPerIP[ip] = count;
        });
        const totalConnections = Array.from(this.connectionsPerIP.values()).reduce((sum, count) => sum + count, 0);
        return {
            totalConnections,
            connectionsPerIP,
            maxConnectionsPerIP: this.maxConnectionsPerIP,
        };
    }
    /**
     * クリーンアップ（古いレコードを削除）
     */
    cleanup() {
        const now = new Date();
        // 期限切れのメッセージカウントを削除
        for (const [ip, record] of this.messageCountPerIP) {
            if (record.resetAt < now) {
                this.messageCountPerIP.delete(ip);
            }
        }
    }
}
exports.wsConnectionManager = new WebSocketConnectionManager();
// 定期的にクリーンアップ（1分ごと）
setInterval(() => {
    exports.wsConnectionManager.cleanup();
}, 60 * 1000);
/**
 * メッセージ検証
 */
function validateWebSocketMessage(message) {
    // メッセージタイプのホワイトリスト
    const allowedTypes = ['subscribe', 'subscribe_streams', 'unsubscribe', 'heartbeat'];
    if (!message.type) {
        return { valid: false, reason: 'Missing message type' };
    }
    if (!allowedTypes.includes(message.type)) {
        return { valid: false, reason: `Invalid message type: ${message.type}` };
    }
    // メッセージサイズチェック（1MB制限）
    const messageSize = JSON.stringify(message).length;
    if (messageSize > 1024 * 1024) {
        return { valid: false, reason: 'Message too large' };
    }
    // タイプ別の検証
    switch (message.type) {
        case 'subscribe':
            if (!Array.isArray(message.channels)) {
                return { valid: false, reason: 'Invalid channels format' };
            }
            if (message.channels.length > 100) {
                return { valid: false, reason: 'Too many channels' };
            }
            break;
        case 'subscribe_streams':
            if (!Array.isArray(message.youtubeChannels) && !Array.isArray(message.twitchChannels)) {
                return { valid: false, reason: 'Invalid channel lists' };
            }
            const totalChannels = (message.youtubeChannels?.length || 0) + (message.twitchChannels?.length || 0);
            if (totalChannels > 200) {
                return { valid: false, reason: 'Too many channels' };
            }
            break;
    }
    return { valid: true };
}
/**
 * WebSocketのPing/Pongハートビート管理
 *
 * 注意: この機能は現在無効化されています。
 * Renderのプロキシ/ロードバランサーがWebSocket Ping/Pongフレームを適切に転送しない問題があるため、
 * アプリケーションレベルのheartbeat（{ type: 'heartbeat' } JSONメッセージ）のみを使用しています。
 */
class WebSocketHeartbeat {
    constructor() {
        this.intervals = new Map();
        this.pingInterval = 30000; // 30秒
        this.pongTimeout = 5000; // 5秒
    }
    /**
     * ハートビートを開始（無効化済み）
     */
    start(ws) {
        // WebSocket Ping/Pongハートビートは無効化されています
        // アプリケーションレベルのheartbeatメッセージを使用してください
        console.log('[WebSocket Heartbeat] Protocol-level heartbeat is disabled, using application-level heartbeat');
    }
    /**
     * ハートビートを停止（無効化済み）
     */
    stop(ws) {
        // WebSocket Ping/Pongハートビートは無効化されています
        const interval = this.intervals.get(ws);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(ws);
        }
    }
}
exports.WebSocketHeartbeat = WebSocketHeartbeat;
exports.wsHeartbeat = new WebSocketHeartbeat();
//# sourceMappingURL=websocketSecurity.js.map