"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitchEventSubConnection = void 0;
const WS = __importStar(require("ws"));
const undici_1 = require("undici");
const metricsCollector_1 = require("./metricsCollector");
/**
 * 単一のTwitch EventSub WebSocket接続を管理するクラス
 *
 * 各接続は最大10,000サブスクリプションを管理可能
 * (stream.online + stream.offline = 2サブスクリプション/チャンネル)
 * 実質最大5,000チャンネルまで対応
 */
class TwitchEventSubConnection {
    constructor(index) {
        this.ws = null;
        this.sessionId = null;
        this.accessToken = null;
        this.clientId = null;
        this.reconnectUrl = null;
        this.keepaliveTimer = null;
        this.eventHandlers = new Set();
        this.subscribedUserIds = new Set();
        this.subscriptionIds = new Map(); // userId -> [subscriptionIds]
        this.status = 'disconnected';
        this.connectedAt = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.index = index;
        console.log(`[EventSub Connection ${index}] Initialized`);
    }
    /**
     * 認証情報を設定
     */
    setCredentials(accessToken, clientId) {
        console.log(`[EventSub Connection ${this.index}] Setting credentials`);
        this.accessToken = accessToken;
        this.clientId = clientId;
    }
    /**
     * WebSocket接続を開始
     */
    async connect() {
        if (this.ws && this.ws.readyState === WS.WebSocket.OPEN) {
            console.log(`[EventSub Connection ${this.index}] Already connected`);
            return;
        }
        if (!this.accessToken || !this.clientId) {
            throw new Error('Credentials not set. Call setCredentials() first.');
        }
        const wsUrl = this.reconnectUrl || 'wss://eventsub.wss.twitch.tv/ws';
        console.log(`[EventSub Connection ${this.index}] Connecting to ${wsUrl}`);
        this.status = 'connecting';
        this.ws = new WS.WebSocket(wsUrl);
        this.ws.on('open', () => {
            console.log(`[EventSub Connection ${this.index}] WebSocket connected`);
            this.status = 'connected';
            this.connectedAt = new Date();
            this.reconnectAttempts = 0;
        });
        this.ws.on('message', (data) => {
            this.handleMessage(data.toString());
        });
        this.ws.on('close', (code, reason) => {
            console.log(`[EventSub Connection ${this.index}] WebSocket closed: ${code} - ${reason.toString()}`);
            this.status = 'disconnected';
            this.cleanup();
            // 再接続を試みる
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // 指数バックオフ（最大30秒）
                console.log(`[EventSub Connection ${this.index}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                setTimeout(() => {
                    this.status = 'reconnecting';
                    this.connect().catch((err) => {
                        console.error(`[EventSub Connection ${this.index}] Reconnection failed:`, err);
                        this.status = 'error';
                    });
                }, delay);
            }
            else {
                console.error(`[EventSub Connection ${this.index}] Max reconnection attempts reached`);
                this.status = 'error';
            }
        });
        this.ws.on('error', (error) => {
            console.error(`[EventSub Connection ${this.index}] WebSocket error:`, error);
            this.status = 'error';
            // エラーコードを抽出（429レート制限など）
            const errorMessage = error.message || '';
            const statusMatch = errorMessage.match(/response: (\d+)/);
            if (statusMatch) {
                const statusCode = parseInt(statusMatch[1], 10);
                metricsCollector_1.metricsCollector.recordEventSubWebSocketError(this.index, statusCode);
                // 429エラーの場合は特別にログ
                if (statusCode === 429) {
                    console.error(`[EventSub Connection ${this.index}] ⚠️ Rate limit (429) detected!`);
                }
            }
        });
    }
    /**
     * メッセージを処理
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            const { message_type } = message.metadata;
            console.log(`[EventSub Connection ${this.index}] Received message type: ${message_type}`);
            switch (message_type) {
                case 'session_welcome':
                    this.handleWelcome(message);
                    break;
                case 'session_keepalive':
                    this.handleKeepalive();
                    break;
                case 'notification':
                    this.handleNotification(message);
                    break;
                case 'session_reconnect':
                    this.handleReconnect(message);
                    break;
                case 'revocation':
                    this.handleRevocation(message);
                    break;
                default:
                    console.log(`[EventSub Connection ${this.index}] Unknown message type: ${message_type}`);
            }
        }
        catch (error) {
            console.error(`[EventSub Connection ${this.index}] Failed to parse message:`, error);
        }
    }
    /**
     * Welcomeメッセージを処理
     */
    handleWelcome(message) {
        const session = message.payload.session;
        if (!session) {
            console.error(`[EventSub Connection ${this.index}] Welcome message missing session`);
            return;
        }
        this.sessionId = session.id;
        console.log(`[EventSub Connection ${this.index}] Session established: ${this.sessionId}`);
        console.log(`[EventSub Connection ${this.index}] Keepalive timeout: ${session.keepalive_timeout_seconds}s`);
        // Keepaliveタイマーを設定
        this.resetKeepaliveTimer(session.keepalive_timeout_seconds);
        // 既存のサブスクリプションを再登録
        if (this.subscribedUserIds.size > 0) {
            console.log(`[EventSub Connection ${this.index}] Re-subscribing to ${this.subscribedUserIds.size} existing users`);
            const userIds = Array.from(this.subscribedUserIds);
            this.subscribeToUsers(userIds).catch((err) => {
                console.error(`[EventSub Connection ${this.index}] Failed to re-subscribe:`, err);
            });
        }
    }
    /**
     * Keepaliveメッセージを処理
     */
    handleKeepalive() {
        console.log(`[EventSub Connection ${this.index}] Keepalive received`);
        // Keepaliveタイマーをリセット
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
        }
    }
    /**
     * 通知メッセージを処理
     */
    handleNotification(message) {
        const { subscription_type } = message.metadata;
        const event = message.payload.event;
        if (!event) {
            console.error(`[EventSub Connection ${this.index}] Notification missing event`);
            return;
        }
        console.log(`[EventSub Connection ${this.index}] Event received: ${subscription_type}`, event);
        let eventType;
        if (subscription_type === 'stream.online') {
            eventType = 'online';
        }
        else if (subscription_type === 'stream.offline') {
            eventType = 'offline';
        }
        else {
            console.log(`[EventSub Connection ${this.index}] Unhandled subscription type: ${subscription_type}`);
            return;
        }
        // イベントハンドラーに通知
        const streamEvent = {
            type: eventType,
            broadcasterId: event.broadcaster_user_id,
            broadcasterLogin: event.broadcaster_user_login,
            broadcasterName: event.broadcaster_user_name,
            startedAt: event.started_at
        };
        this.eventHandlers.forEach((handler) => {
            try {
                handler(streamEvent);
            }
            catch (error) {
                console.error(`[EventSub Connection ${this.index}] Error in event handler:`, error);
            }
        });
    }
    /**
     * 再接続メッセージを処理
     */
    handleReconnect(message) {
        const session = message.payload.session;
        if (!session || !session.reconnect_url) {
            console.error(`[EventSub Connection ${this.index}] Reconnect message missing URL`);
            return;
        }
        console.log(`[EventSub Connection ${this.index}] Reconnecting to: ${session.reconnect_url}`);
        this.reconnectUrl = session.reconnect_url;
        // 新しいURLで再接続
        this.connect().catch((err) => {
            console.error(`[EventSub Connection ${this.index}] Reconnection failed:`, err);
        });
    }
    /**
     * Revocationメッセージを処理
     */
    handleRevocation(message) {
        const subscription = message.payload.subscription;
        if (!subscription)
            return;
        console.log(`[EventSub Connection ${this.index}] Subscription revoked: ${subscription.id}`);
        // サブスクリプションIDを削除
        this.subscriptionIds.forEach((ids, userId) => {
            const index = ids.indexOf(subscription.id);
            if (index > -1) {
                ids.splice(index, 1);
                if (ids.length === 0) {
                    this.subscriptionIds.delete(userId);
                    this.subscribedUserIds.delete(userId);
                }
            }
        });
    }
    /**
     * Keepaliveタイマーをリセット
     */
    resetKeepaliveTimer(timeoutSeconds) {
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
        }
        // タイムアウト + 10秒後に接続が切れたとみなす
        this.keepaliveTimer = setTimeout(() => {
            console.error(`[EventSub Connection ${this.index}] Keepalive timeout, reconnecting...`);
            this.ws?.close();
        }, (timeoutSeconds + 10) * 1000);
    }
    /**
     * ユーザーをサブスクライブ
     */
    async subscribeToUsers(userIds) {
        if (!this.sessionId || !this.accessToken || !this.clientId) {
            throw new Error('Not connected or credentials missing');
        }
        console.log(`[EventSub Connection ${this.index}] Subscribing to ${userIds.length} users`);
        for (const userId of userIds) {
            if (this.subscribedUserIds.has(userId)) {
                console.log(`[EventSub Connection ${this.index}] Already subscribed to user: ${userId}`);
                continue;
            }
            try {
                // stream.online イベントをサブスクライブ
                metricsCollector_1.metricsCollector.recordEventSubSubscriptionAttempt(userId);
                const onlineSubId = await this.createSubscription('stream.online', '1', {
                    broadcaster_user_id: userId
                });
                // stream.offline イベントをサブスクライブ
                metricsCollector_1.metricsCollector.recordEventSubSubscriptionAttempt(userId);
                const offlineSubId = await this.createSubscription('stream.offline', '1', {
                    broadcaster_user_id: userId
                });
                // サブスクリプションIDを保存
                this.subscriptionIds.set(userId, [onlineSubId, offlineSubId]);
                this.subscribedUserIds.add(userId);
                console.log(`[EventSub Connection ${this.index}] Subscribed to user ${userId}: online=${onlineSubId}, offline=${offlineSubId}`);
            }
            catch (error) {
                console.error(`[EventSub Connection ${this.index}] Failed to subscribe to user ${userId}:`, error);
                // エラー情報を抽出
                const errorMessage = error instanceof Error ? error.message : String(error);
                const statusMatch = errorMessage.match(/(\d+)/);
                const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
                // エラー理由を判定
                let reason = 'unknown';
                if (errorMessage.includes('invalid transport and auth combination')) {
                    reason = 'invalid_auth';
                }
                else if (statusCode === 429) {
                    reason = 'rate_limit';
                }
                else if (statusCode === 400) {
                    reason = 'bad_request';
                }
                metricsCollector_1.metricsCollector.recordEventSubSubscriptionFailure(userId, reason, statusCode);
            }
        }
    }
    /**
     * サブスクリプションを作成
     */
    async createSubscription(type, version, condition) {
        // API呼び出しを記録
        metricsCollector_1.metricsCollector.recordTwitchApiCall('/helix/eventsub/subscriptions', 'POST');
        const response = await (0, undici_1.fetch)('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Client-Id': this.clientId,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type,
                version,
                condition,
                transport: {
                    method: 'websocket',
                    session_id: this.sessionId
                }
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            // エラータイプを判定
            let errorType = 'unknown';
            if (errorText.includes('invalid transport and auth combination')) {
                errorType = 'invalid_auth';
            }
            else if (response.status === 429) {
                errorType = 'rate_limit';
            }
            else if (response.status === 400) {
                errorType = 'bad_request';
            }
            // APIエラーを記録
            metricsCollector_1.metricsCollector.recordTwitchApiError('/helix/eventsub/subscriptions', response.status, errorType);
            throw new Error(`Failed to create subscription: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return data.data[0].id;
    }
    /**
     * ユーザーのサブスクリプションを解除
     */
    async unsubscribeFromUsers(userIds) {
        console.log(`[EventSub Connection ${this.index}] Unsubscribing from ${userIds.length} users`);
        for (const userId of userIds) {
            const subIds = this.subscriptionIds.get(userId);
            if (!subIds) {
                console.log(`[EventSub Connection ${this.index}] No subscriptions found for user: ${userId}`);
                continue;
            }
            for (const subId of subIds) {
                try {
                    await this.deleteSubscription(subId);
                    console.log(`[EventSub Connection ${this.index}] Deleted subscription: ${subId}`);
                }
                catch (error) {
                    console.error(`[EventSub Connection ${this.index}] Failed to delete subscription ${subId}:`, error);
                }
            }
            this.subscriptionIds.delete(userId);
            this.subscribedUserIds.delete(userId);
        }
    }
    /**
     * サブスクリプションを削除
     */
    async deleteSubscription(subscriptionId) {
        const response = await (0, undici_1.fetch)(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Client-Id': this.clientId
            }
        });
        if (!response.ok && response.status !== 404) {
            const errorText = await response.text();
            throw new Error(`Failed to delete subscription: ${response.status} - ${errorText}`);
        }
    }
    /**
     * イベントハンドラーを登録
     */
    onStreamEvent(handler) {
        this.eventHandlers.add(handler);
        console.log(`[EventSub Connection ${this.index}] Event handler added. Total handlers: ${this.eventHandlers.size}`);
        return () => {
            this.eventHandlers.delete(handler);
            console.log(`[EventSub Connection ${this.index}] Event handler removed. Total handlers: ${this.eventHandlers.size}`);
        };
    }
    /**
     * 接続を切断
     */
    disconnect() {
        console.log(`[EventSub Connection ${this.index}] Disconnecting...`);
        this.cleanup();
        this.ws?.close();
        this.ws = null;
        this.status = 'disconnected';
    }
    /**
     * クリーンアップ
     */
    cleanup() {
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }
        this.sessionId = null;
        this.reconnectUrl = null;
    }
    /**
     * 統計情報を取得
     */
    getStats() {
        return {
            index: this.index,
            status: this.status,
            sessionId: this.sessionId,
            subscriptionCount: this.subscribedUserIds.size * 2, // online + offline
            subscribedUserIds: Array.from(this.subscribedUserIds),
            connectedAt: this.connectedAt?.toISOString() || null
        };
    }
    /**
     * サブスクリプション数を取得
     */
    get subscriptionCount() {
        return this.subscribedUserIds.size * 2; // online + offline
    }
    /**
     * サブスクライブ済みユーザーIDを取得
     */
    getSubscribedUserIds() {
        return Array.from(this.subscribedUserIds);
    }
    /**
     * 特定のユーザーがサブスクライブ済みか確認
     */
    isSubscribed(userId) {
        return this.subscribedUserIds.has(userId);
    }
    /**
     * 接続状態を取得
     */
    getStatus() {
        return this.status;
    }
    /**
     * 接続中かどうか
     */
    isConnected() {
        return this.status === 'connected' && this.sessionId !== null;
    }
}
exports.TwitchEventSubConnection = TwitchEventSubConnection;
//# sourceMappingURL=twitchEventSubConnection.js.map