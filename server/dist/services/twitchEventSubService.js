"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twitchEventSubService = void 0;
const ws_1 = __importDefault(require("ws"));
const undici_1 = require("undici");
class TwitchEventSubService {
    constructor() {
        this.ws = null;
        this.sessionId = null;
        this.accessToken = null;
        this.clientId = null;
        this.reconnectUrl = null;
        this.keepaliveTimer = null;
        this.eventHandlers = new Set();
        this.subscribedUserIds = new Set();
        this.subscriptionIds = new Map(); // userId -> [subscriptionIds]
        console.log('[Twitch EventSub] Service initialized');
    }
    setCredentials(accessToken, clientId) {
        console.log('[Twitch EventSub] Setting credentials');
        this.accessToken = accessToken;
        this.clientId = clientId;
    }
    async connect() {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            console.log('[Twitch EventSub] Already connected');
            return;
        }
        if (!this.accessToken || !this.clientId) {
            throw new Error('Credentials not set. Call setCredentials() first.');
        }
        const wsUrl = this.reconnectUrl || 'wss://eventsub.wss.twitch.tv/ws';
        console.log(`[Twitch EventSub] Connecting to ${wsUrl}`);
        this.ws = new ws_1.default(wsUrl);
        this.ws.on('open', () => {
            console.log('[Twitch EventSub] WebSocket connected');
        });
        this.ws.on('message', (data) => {
            this.handleMessage(data.toString());
        });
        this.ws.on('close', (code, reason) => {
            console.log(`[Twitch EventSub] WebSocket closed: ${code} - ${reason.toString()}`);
            this.cleanup();
            // 再接続を試みる（5秒後）
            setTimeout(() => {
                console.log('[Twitch EventSub] Attempting to reconnect...');
                this.connect().catch((err) => {
                    console.error('[Twitch EventSub] Reconnection failed:', err);
                });
            }, 5000);
        });
        this.ws.on('error', (error) => {
            console.error('[Twitch EventSub] WebSocket error:', error);
        });
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            const { message_type } = message.metadata;
            console.log(`[Twitch EventSub] Received message type: ${message_type}`);
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
                    console.log(`[Twitch EventSub] Unknown message type: ${message_type}`);
            }
        }
        catch (error) {
            console.error('[Twitch EventSub] Failed to parse message:', error);
        }
    }
    handleWelcome(message) {
        const session = message.payload.session;
        if (!session) {
            console.error('[Twitch EventSub] Welcome message missing session');
            return;
        }
        this.sessionId = session.id;
        console.log(`[Twitch EventSub] Session established: ${this.sessionId}`);
        console.log(`[Twitch EventSub] Keepalive timeout: ${session.keepalive_timeout_seconds}s`);
        // Keepaliveタイマーを設定（タイムアウト + 10秒のバッファ）
        this.resetKeepaliveTimer(session.keepalive_timeout_seconds);
        // 既存のサブスクリプションを再登録
        if (this.subscribedUserIds.size > 0) {
            console.log('[Twitch EventSub] Re-subscribing to existing users');
            const userIds = Array.from(this.subscribedUserIds);
            this.subscribeToUsers(userIds).catch((err) => {
                console.error('[Twitch EventSub] Failed to re-subscribe:', err);
            });
        }
    }
    handleKeepalive() {
        console.log('[Twitch EventSub] Keepalive received');
        // Keepaliveタイマーをリセット
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
        }
    }
    handleNotification(message) {
        const { subscription_type } = message.metadata;
        const event = message.payload.event;
        if (!event) {
            console.error('[Twitch EventSub] Notification missing event');
            return;
        }
        console.log(`[Twitch EventSub] Event received: ${subscription_type}`, event);
        let eventType;
        if (subscription_type === 'stream.online') {
            eventType = 'online';
        }
        else if (subscription_type === 'stream.offline') {
            eventType = 'offline';
        }
        else {
            console.log(`[Twitch EventSub] Unhandled subscription type: ${subscription_type}`);
            return;
        }
        // イベントハンドラーに通知
        this.eventHandlers.forEach((handler) => {
            handler({
                type: eventType,
                broadcasterId: event.broadcaster_user_id,
                broadcasterLogin: event.broadcaster_user_login,
                broadcasterName: event.broadcaster_user_name,
                startedAt: event.started_at
            });
        });
    }
    handleReconnect(message) {
        const session = message.payload.session;
        if (!session || !session.reconnect_url) {
            console.error('[Twitch EventSub] Reconnect message missing URL');
            return;
        }
        console.log(`[Twitch EventSub] Reconnecting to: ${session.reconnect_url}`);
        this.reconnectUrl = session.reconnect_url;
        // 新しいURLで再接続
        this.connect().catch((err) => {
            console.error('[Twitch EventSub] Reconnection failed:', err);
        });
    }
    handleRevocation(message) {
        const subscription = message.payload.subscription;
        if (!subscription)
            return;
        console.log(`[Twitch EventSub] Subscription revoked: ${subscription.id}`);
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
    resetKeepaliveTimer(timeoutSeconds) {
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
        }
        // タイムアウト + 10秒後に接続が切れたとみなす
        this.keepaliveTimer = setTimeout(() => {
            console.error('[Twitch EventSub] Keepalive timeout, reconnecting...');
            this.ws?.close();
        }, (timeoutSeconds + 10) * 1000);
    }
    async subscribeToUsers(userIds) {
        if (!this.sessionId || !this.accessToken || !this.clientId) {
            throw new Error('Not connected or credentials missing');
        }
        console.log(`[Twitch EventSub] Subscribing to ${userIds.length} users`);
        for (const userId of userIds) {
            if (this.subscribedUserIds.has(userId)) {
                console.log(`[Twitch EventSub] Already subscribed to user: ${userId}`);
                continue;
            }
            try {
                // stream.online イベントをサブスクライブ
                const onlineSubId = await this.createSubscription('stream.online', '1', {
                    broadcaster_user_id: userId
                });
                // stream.offline イベントをサブスクライブ
                const offlineSubId = await this.createSubscription('stream.offline', '1', {
                    broadcaster_user_id: userId
                });
                // サブスクリプションIDを保存
                this.subscriptionIds.set(userId, [onlineSubId, offlineSubId]);
                this.subscribedUserIds.add(userId);
                console.log(`[Twitch EventSub] Subscribed to user ${userId}: online=${onlineSubId}, offline=${offlineSubId}`);
            }
            catch (error) {
                console.error(`[Twitch EventSub] Failed to subscribe to user ${userId}:`, error);
            }
        }
    }
    async createSubscription(type, version, condition) {
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
            throw new Error(`Failed to create subscription: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return data.data[0].id;
    }
    async unsubscribeFromUsers(userIds) {
        console.log(`[Twitch EventSub] Unsubscribing from ${userIds.length} users`);
        for (const userId of userIds) {
            const subIds = this.subscriptionIds.get(userId);
            if (!subIds) {
                console.log(`[Twitch EventSub] No subscriptions found for user: ${userId}`);
                continue;
            }
            for (const subId of subIds) {
                try {
                    await this.deleteSubscription(subId);
                    console.log(`[Twitch EventSub] Deleted subscription: ${subId}`);
                }
                catch (error) {
                    console.error(`[Twitch EventSub] Failed to delete subscription ${subId}:`, error);
                }
            }
            this.subscriptionIds.delete(userId);
            this.subscribedUserIds.delete(userId);
        }
    }
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
    onStreamEvent(handler) {
        this.eventHandlers.add(handler);
        console.log(`[Twitch EventSub] Event handler added. Total handlers: ${this.eventHandlers.size}`);
        return () => {
            this.eventHandlers.delete(handler);
            console.log(`[Twitch EventSub] Event handler removed. Total handlers: ${this.eventHandlers.size}`);
        };
    }
    disconnect() {
        console.log('[Twitch EventSub] Disconnecting...');
        this.cleanup();
        this.ws?.close();
        this.ws = null;
    }
    cleanup() {
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }
        this.sessionId = null;
        this.reconnectUrl = null;
    }
    getSubscribedUserIds() {
        return Array.from(this.subscribedUserIds);
    }
}
exports.twitchEventSubService = new TwitchEventSubService();
//# sourceMappingURL=twitchEventSubService.js.map