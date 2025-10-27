"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twitchEventSubWebhookService = void 0;
const crypto_1 = require("crypto");
const undici_1 = require("undici");
class TwitchEventSubWebhookService {
    constructor() {
        this.accessToken = null;
        this.clientId = null;
        this.webhookSecret = null;
        this.webhookUrl = null;
        this.eventHandlers = new Set();
        this.subscribedUserIds = new Set();
        this.subscriptionIds = new Map(); // userId -> [subscriptionIds]
        console.log('[Twitch EventSub Webhook] Service initialized');
    }
    setCredentials(accessToken, clientId, webhookSecret, webhookUrl) {
        console.log('[Twitch EventSub Webhook] Setting credentials');
        this.accessToken = accessToken;
        this.clientId = clientId;
        this.webhookSecret = webhookSecret;
        this.webhookUrl = webhookUrl;
    }
    /**
     * Twitch署名を検証
     */
    verifySignature(messageId, messageTimestamp, messageBody, signature) {
        if (!this.webhookSecret) {
            console.error('[Twitch EventSub Webhook] Webhook secret not set');
            return false;
        }
        const message = messageId + messageTimestamp + messageBody;
        const expectedSignature = 'sha256=' + (0, crypto_1.createHmac)('sha256', this.webhookSecret)
            .update(message)
            .digest('hex');
        return signature === expectedSignature;
    }
    /**
     * Webhookからの通知を処理
     */
    handleWebhookNotification(notification) {
        const subscriptionType = notification.subscription?.type;
        const event = notification.event;
        if (!event) {
            console.error('[Twitch EventSub Webhook] Notification missing event');
            return;
        }
        console.log(`[Twitch EventSub Webhook] Event received: ${subscriptionType}`, event);
        let eventType;
        if (subscriptionType === 'stream.online') {
            eventType = 'online';
        }
        else if (subscriptionType === 'stream.offline') {
            eventType = 'offline';
        }
        else {
            console.log(`[Twitch EventSub Webhook] Unhandled subscription type: ${subscriptionType}`);
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
    async subscribeToUsers(userIds) {
        if (!this.accessToken || !this.clientId || !this.webhookUrl || !this.webhookSecret) {
            throw new Error('Credentials or webhook URL not set');
        }
        console.log(`[Twitch EventSub Webhook] Subscribing to ${userIds.length} users`);
        for (const userId of userIds) {
            if (this.subscribedUserIds.has(userId)) {
                console.log(`[Twitch EventSub Webhook] Already subscribed to user: ${userId}`);
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
                console.log(`[Twitch EventSub Webhook] Subscribed to user ${userId}: online=${onlineSubId}, offline=${offlineSubId}`);
            }
            catch (error) {
                console.error(`[Twitch EventSub Webhook] Failed to subscribe to user ${userId}:`, error);
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
                    method: 'webhook',
                    callback: this.webhookUrl,
                    secret: this.webhookSecret
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
        console.log(`[Twitch EventSub Webhook] Unsubscribing from ${userIds.length} users`);
        for (const userId of userIds) {
            const subIds = this.subscriptionIds.get(userId);
            if (!subIds) {
                console.log(`[Twitch EventSub Webhook] No subscriptions found for user: ${userId}`);
                continue;
            }
            for (const subId of subIds) {
                try {
                    await this.deleteSubscription(subId);
                    console.log(`[Twitch EventSub Webhook] Deleted subscription: ${subId}`);
                }
                catch (error) {
                    console.error(`[Twitch EventSub Webhook] Failed to delete subscription ${subId}:`, error);
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
        console.log(`[Twitch EventSub Webhook] Event handler added. Total handlers: ${this.eventHandlers.size}`);
        return () => {
            this.eventHandlers.delete(handler);
            console.log(`[Twitch EventSub Webhook] Event handler removed. Total handlers: ${this.eventHandlers.size}`);
        };
    }
    getSubscribedUserIds() {
        return Array.from(this.subscribedUserIds);
    }
}
exports.twitchEventSubWebhookService = new TwitchEventSubWebhookService();
//# sourceMappingURL=twitchEventSubWebhookService.js.map