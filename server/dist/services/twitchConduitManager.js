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
exports.twitchConduitManager = exports.TwitchConduitManager = void 0;
const WS = __importStar(require("ws"));
const twitchConduitClient_1 = require("./twitchConduitClient");
const twitchAppAuth_1 = require("./twitchAppAuth");
const env_1 = require("../config/env");
const metricsCollector_1 = require("./metricsCollector");
/**
 * Twitch EventSub Conduits マネージャー
 *
 * Conduitsを使用したEventSub管理を行います。
 * - 最大20,000シャード対応
 * - 最大100,000サブスクリプション対応
 * - 自動シャード管理
 * - WebSocket接続プール管理
 */
class TwitchConduitManager {
    constructor() {
        this.conduitId = null;
        this.connections = new Map(); // shardId -> connection
        this.subscribedUserIds = new Set();
        this.subscriptionIds = new Map(); // userId -> [subscriptionIds]
        this.eventHandlers = new Set();
        this.initialShardCount = 10; // 初期シャード数
        console.log('[Conduit Manager] Initializing...');
    }
    /**
     * Conduitマネージャーを初期化
     * 既存Conduitを取得するか、新規作成します
     */
    async initialize() {
        console.log('[Conduit Manager] Initializing Conduit...');
        try {
            // 既存Conduit確認
            const existingConduits = await twitchConduitClient_1.twitchConduitClient.getConduits();
            if (existingConduits.length > 0) {
                this.conduitId = existingConduits[0].id;
                console.log(`[Conduit Manager] Using existing Conduit: ${this.conduitId}`);
                // 既存シャード情報を取得
                const shardsResponse = await twitchConduitClient_1.twitchConduitClient.getShards(this.conduitId);
                console.log(`[Conduit Manager] Found ${shardsResponse.data.length} existing shard(s)`);
            }
            else {
                // 新規Conduit作成
                console.log(`[Conduit Manager] Creating new Conduit with ${this.initialShardCount} shard capacity...`);
                const conduit = await twitchConduitClient_1.twitchConduitClient.createConduit(this.initialShardCount);
                this.conduitId = conduit.id;
                console.log(`[Conduit Manager] Conduit created: ${this.conduitId}`);
            }
        }
        catch (error) {
            console.error('[Conduit Manager] Failed to initialize Conduit:', error);
            metricsCollector_1.metricsCollector.incrementCounter('conduit_api_errors_total');
            throw error;
        }
    }
    /**
     * 新しいWebSocket接続を作成してシャードとして登録
     */
    async createWebSocketShard(shardId, retryCount = 3) {
        if (!this.conduitId) {
            throw new Error('Conduit not initialized. Call initialize() first.');
        }
        let lastError = null;
        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(`[Conduit Manager] Creating WebSocket shard #${shardId} (attempt ${attempt}/${retryCount})...`);
                // WebSocket接続を確立
                const wsUrl = 'wss://eventsub.wss.twitch.tv/ws';
                const ws = new WS.WebSocket(wsUrl);
                // 接続情報を保存
                const connection = {
                    ws,
                    sessionId: '',
                    shardId,
                    status: 'connecting',
                    connectedAt: null,
                    reconnectAttempts: 0
                };
                this.connections.set(shardId, connection);
                // 接続確立を待機
                await new Promise((resolve, reject) => {
                    ws.on('open', () => {
                        console.log(`[Conduit Manager] Shard #${shardId} WebSocket connected`);
                        connection.status = 'connected';
                        connection.connectedAt = new Date();
                        resolve();
                    });
                    ws.on('error', (error) => {
                        console.error(`[Conduit Manager] Shard #${shardId} WebSocket error:`, error);
                        connection.status = 'error';
                        reject(error);
                    });
                });
                // セッションIDを取得
                const sessionId = await this.waitForSessionId(ws, shardId);
                connection.sessionId = sessionId;
                console.log(`[Conduit Manager] Shard #${shardId} session ID: ${sessionId}`);
                // シャードを登録
                await twitchConduitClient_1.twitchConduitClient.updateShards({
                    conduit_id: this.conduitId,
                    shards: [
                        {
                            id: shardId,
                            transport: {
                                method: 'websocket',
                                session_id: sessionId
                            }
                        }
                    ]
                });
                console.log(`[Conduit Manager] Shard #${shardId} registered successfully`);
                // メッセージハンドラーを設定
                this.setupMessageHandlers(ws, shardId);
                // 成功
                return;
            }
            catch (error) {
                lastError = error;
                console.error(`[Conduit Manager] Shard #${shardId} creation failed (attempt ${attempt}/${retryCount}):`, error);
                metricsCollector_1.metricsCollector.incrementCounter('conduit_shard_failures_total');
                // 最後の試行でない場合は待機してリトライ
                if (attempt < retryCount) {
                    const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 指数バックオフ（最大10秒）
                    console.log(`[Conduit Manager] Retrying shard #${shardId} in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        // 全ての試行が失敗
        console.error(`[Conduit Manager] Failed to create shard #${shardId} after ${retryCount} attempts`);
        throw lastError || new Error(`Failed to create shard #${shardId}`);
    }
    /**
     * WebSocketからセッションIDを取得（Promiseベース）
     */
    waitForSessionId(ws, shardId, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for session_welcome on shard #${shardId}`));
            }, timeoutMs);
            const messageHandler = (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.metadata?.message_type === 'session_welcome') {
                        const sessionId = message.payload?.session?.id;
                        if (sessionId) {
                            clearTimeout(timeout);
                            ws.off('message', messageHandler); // ハンドラーを削除
                            resolve(sessionId);
                        }
                        else {
                            clearTimeout(timeout);
                            reject(new Error(`session_welcome missing session.id on shard #${shardId}`));
                        }
                    }
                }
                catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            };
            ws.on('message', messageHandler);
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
            ws.on('close', () => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket closed before session_welcome on shard #${shardId}`));
            });
        });
    }
    /**
     * WebSocketメッセージハンドラーを設定
     */
    setupMessageHandlers(ws, shardId) {
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                const { message_type } = message.metadata || {};
                console.log(`[Conduit Manager] Shard #${shardId} received: ${message_type}`);
                switch (message_type) {
                    case 'session_keepalive':
                        console.log(`[Conduit Manager] Shard #${shardId} keepalive`);
                        break;
                    case 'notification':
                        this.handleNotification(message, shardId);
                        break;
                    case 'session_reconnect':
                        console.log(`[Conduit Manager] Shard #${shardId} reconnect requested by Twitch`);
                        const reconnectUrl = message.payload?.session?.reconnect_url;
                        if (reconnectUrl) {
                            this.reconnectShard(shardId, reconnectUrl);
                        }
                        else {
                            console.error(`[Conduit Manager] Shard #${shardId} reconnect URL missing`);
                            this.reconnectShard(shardId);
                        }
                        break;
                    case 'revocation':
                        console.log(`[Conduit Manager] Shard #${shardId} subscription revoked`);
                        const subscriptionType = message.metadata?.subscription_type;
                        const condition = message.payload?.subscription?.condition;
                        console.log(`[Conduit Manager] Revoked: ${subscriptionType}`, condition);
                        break;
                }
            }
            catch (error) {
                console.error(`[Conduit Manager] Shard #${shardId} message parse error:`, error);
            }
        });
        ws.on('close', (code, reason) => {
            console.log(`[Conduit Manager] Shard #${shardId} closed: ${code} - ${reason.toString()}`);
            const connection = this.connections.get(shardId);
            if (connection) {
                connection.status = 'disconnected';
                // 自動再接続（正常終了コード以外）
                if (code !== 1000) {
                    console.log(`[Conduit Manager] Shard #${shardId} unexpected close, initiating reconnect...`);
                    this.reconnectShard(shardId);
                }
            }
        });
        ws.on('error', (error) => {
            console.error(`[Conduit Manager] Shard #${shardId} error:`, error);
            const connection = this.connections.get(shardId);
            if (connection) {
                connection.status = 'error';
            }
            metricsCollector_1.metricsCollector.incrementCounter('conduit_websocket_errors_total');
        });
    }
    /**
     * シャードを再接続
     */
    async reconnectShard(shardId, reconnectUrl) {
        const connection = this.connections.get(shardId);
        if (!connection) {
            console.error(`[Conduit Manager] Cannot reconnect shard #${shardId}: connection not found`);
            return;
        }
        // 既存の再接続タイマーをクリア
        if (connection.reconnectTimer) {
            clearTimeout(connection.reconnectTimer);
        }
        // 最大再接続試行回数チェック
        const maxReconnectAttempts = 10;
        if (connection.reconnectAttempts >= maxReconnectAttempts) {
            console.error(`[Conduit Manager] Shard #${shardId} exceeded max reconnect attempts (${maxReconnectAttempts})`);
            connection.status = 'error';
            metricsCollector_1.metricsCollector.incrementCounter('conduit_reconnection_failures_total');
            return;
        }
        connection.reconnectAttempts++;
        connection.status = 'reconnecting';
        // 指数バックオフで再接続待機時間を計算
        const backoffMs = Math.min(1000 * Math.pow(2, connection.reconnectAttempts - 1), 30000); // 最大30秒
        console.log(`[Conduit Manager] Shard #${shardId} reconnecting in ${backoffMs}ms (attempt ${connection.reconnectAttempts}/${maxReconnectAttempts})...`);
        connection.reconnectTimer = setTimeout(async () => {
            try {
                // 古いWebSocketをクリーンアップ
                connection.ws.removeAllListeners();
                connection.ws.close();
                // 新しいWebSocket接続を作成
                const wsUrl = reconnectUrl || 'wss://eventsub.wss.twitch.tv/ws';
                const ws = new WS.WebSocket(wsUrl);
                connection.ws = ws;
                connection.status = 'connecting';
                // 接続確立を待機
                await new Promise((resolve, reject) => {
                    ws.on('open', () => {
                        console.log(`[Conduit Manager] Shard #${shardId} reconnected successfully`);
                        connection.status = 'connected';
                        connection.connectedAt = new Date();
                        connection.reconnectAttempts = 0; // リセット
                        metricsCollector_1.metricsCollector.incrementCounter('conduit_reconnections_total');
                        resolve();
                    });
                    ws.on('error', (error) => {
                        console.error(`[Conduit Manager] Shard #${shardId} reconnect error:`, error);
                        connection.status = 'error';
                        reject(error);
                    });
                });
                // セッションIDを取得
                const sessionId = await this.waitForSessionId(ws, shardId);
                connection.sessionId = sessionId;
                console.log(`[Conduit Manager] Shard #${shardId} new session ID: ${sessionId}`);
                // シャードを再登録
                if (this.conduitId) {
                    await twitchConduitClient_1.twitchConduitClient.updateShards({
                        conduit_id: this.conduitId,
                        shards: [
                            {
                                id: shardId,
                                transport: {
                                    method: 'websocket',
                                    session_id: sessionId
                                }
                            }
                        ]
                    });
                    console.log(`[Conduit Manager] Shard #${shardId} re-registered successfully`);
                }
                // メッセージハンドラーを再設定
                this.setupMessageHandlers(ws, shardId);
            }
            catch (error) {
                console.error(`[Conduit Manager] Shard #${shardId} reconnection failed:`, error);
                metricsCollector_1.metricsCollector.incrementCounter('conduit_reconnection_failures_total');
                // 再度再接続を試行
                this.reconnectShard(shardId, reconnectUrl);
            }
        }, backoffMs);
    }
    /**
     * 通知メッセージを処理
     */
    handleNotification(message, shardId) {
        const { subscription_type } = message.metadata || {};
        const event = message.payload?.event;
        if (!event) {
            console.error(`[Conduit Manager] Shard #${shardId} notification missing event`);
            return;
        }
        console.log(`[Conduit Manager] Shard #${shardId} event: ${subscription_type}`, event);
        let eventType;
        if (subscription_type === 'stream.online') {
            eventType = 'online';
        }
        else if (subscription_type === 'stream.offline') {
            eventType = 'offline';
        }
        else {
            console.log(`[Conduit Manager] Shard #${shardId} unhandled type: ${subscription_type}`);
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
                console.error(`[Conduit Manager] Error in event handler:`, error);
            }
        });
    }
    /**
     * ユーザーをサブスクライブ（Conduitモード）
     */
    async subscribeToUsers(userIds) {
        if (!this.conduitId) {
            throw new Error('Conduit not initialized. Call initialize() first.');
        }
        console.log(`[Conduit Manager] Subscribing to ${userIds.length} users...`);
        const appToken = await (0, twitchAppAuth_1.getTwitchAppAccessToken)();
        const { clientId } = env_1.env.twitch;
        for (const userId of userIds) {
            if (this.subscribedUserIds.has(userId)) {
                console.log(`[Conduit Manager] Already subscribed to user: ${userId}`);
                continue;
            }
            try {
                // stream.online イベントをサブスクライブ
                const onlineSubId = await this.createSubscription(appToken, clientId, 'stream.online', '1', { broadcaster_user_id: userId });
                // stream.offline イベントをサブスクライブ
                const offlineSubId = await this.createSubscription(appToken, clientId, 'stream.offline', '1', { broadcaster_user_id: userId });
                // サブスクリプションIDを保存
                this.subscriptionIds.set(userId, [onlineSubId, offlineSubId]);
                this.subscribedUserIds.add(userId);
                console.log(`[Conduit Manager] Subscribed to user ${userId}: online=${onlineSubId}, offline=${offlineSubId}`);
            }
            catch (error) {
                console.error(`[Conduit Manager] Failed to subscribe to user ${userId}:`, error);
            }
        }
    }
    /**
     * Conduitモードでサブスクリプションを作成
     */
    async createSubscription(appToken, clientId, type, version, condition) {
        const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${appToken}`,
                'Client-Id': clientId,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type,
                version,
                condition,
                transport: {
                    method: 'conduit',
                    conduit_id: this.conduitId
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
    /**
     * ユーザーのサブスクリプションを解除
     */
    async unsubscribeFromUsers(userIds) {
        console.log(`[Conduit Manager] Unsubscribing from ${userIds.length} users...`);
        const appToken = await (0, twitchAppAuth_1.getTwitchAppAccessToken)();
        const { clientId } = env_1.env.twitch;
        for (const userId of userIds) {
            const subIds = this.subscriptionIds.get(userId);
            if (!subIds) {
                console.log(`[Conduit Manager] No subscriptions found for user: ${userId}`);
                continue;
            }
            for (const subId of subIds) {
                try {
                    await this.deleteSubscription(appToken, clientId, subId);
                    console.log(`[Conduit Manager] Deleted subscription: ${subId}`);
                }
                catch (error) {
                    console.error(`[Conduit Manager] Failed to delete subscription ${subId}:`, error);
                }
            }
            this.subscriptionIds.delete(userId);
            this.subscribedUserIds.delete(userId);
        }
    }
    /**
     * サブスクリプションを削除
     */
    async deleteSubscription(appToken, clientId, subscriptionId) {
        const response = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${appToken}`,
                'Client-Id': clientId
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
        console.log(`[Conduit Manager] Event handler added. Total handlers: ${this.eventHandlers.size}`);
        return () => {
            this.eventHandlers.delete(handler);
            console.log(`[Conduit Manager] Event handler removed. Total handlers: ${this.eventHandlers.size}`);
        };
    }
    /**
     * 統計情報を取得
     */
    async getStats() {
        if (!this.conduitId) {
            return {
                conduitId: null,
                totalShards: 0,
                enabledShards: 0,
                disabledShards: 0,
                totalSubscriptions: 0,
                usagePercentage: 0
            };
        }
        const shardsResponse = await twitchConduitClient_1.twitchConduitClient.getShards(this.conduitId);
        const shards = shardsResponse.data;
        const enabledShards = shards.filter(s => s.status === 'enabled').length;
        const disabledShards = shards.length - enabledShards;
        const totalSubscriptions = this.subscribedUserIds.size * 2; // online + offline
        // 使用率計算（最大100,000サブスクリプション）
        const usagePercentage = (totalSubscriptions / 100000) * 100;
        return {
            conduitId: this.conduitId,
            totalShards: shards.length,
            enabledShards,
            disabledShards,
            totalSubscriptions,
            usagePercentage
        };
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
     * 全てのWebSocket接続を切断
     */
    disconnect() {
        console.log('[Conduit Manager] Disconnecting all shards...');
        this.connections.forEach((connection, shardId) => {
            console.log(`[Conduit Manager] Closing shard #${shardId}...`);
            connection.ws.close();
        });
        this.connections.clear();
        console.log('[Conduit Manager] All shards disconnected');
    }
}
exports.TwitchConduitManager = TwitchConduitManager;
// シングルトンインスタンス
exports.twitchConduitManager = new TwitchConduitManager();
//# sourceMappingURL=twitchConduitManager.js.map