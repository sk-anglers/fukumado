"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twitchEventSubManager = exports.TwitchEventSubManager = void 0;
const twitchEventSubConnection_1 = require("./twitchEventSubConnection");
const crypto_1 = require("crypto");
/**
 * Twitch EventSub WebSocketの複数接続を管理するマネージャークラス
 *
 * 3本のWebSocket接続を管理し、負荷分散を行う
 * - 各接続: 最大300サブスクリプション（公式制限）
 * - 合計: 最大900サブスクリプション（300 × 3接続）
 * - 認証済みユーザーのサブスクリプションはコスト0（max_total_cost制限の対象外）
 *
 * 公式ドキュメント: https://dev.twitch.tv/docs/eventsub/handling-websocket-events
 */
class TwitchEventSubManager {
    constructor() {
        this.connections = [];
        this.channelToConnectionMap = new Map(); // userId -> connectionIndex
        this.eventHandlers = new Set();
        this.accessToken = null;
        this.clientId = null;
        this.maxConnectionCount = 3;
        this.maxSubscriptionsPerConnection = 300;
        this.eventHistory = [];
        this.maxHistorySize = 100; // 最大100件保持
        console.log('[EventSub Manager] Initializing with 3 connections...');
        // 3本の接続を作成
        for (let i = 0; i < this.maxConnectionCount; i++) {
            const connection = new twitchEventSubConnection_1.TwitchEventSubConnection(i);
            // 各接続からのイベントを統合
            connection.onStreamEvent((event) => {
                // イベント履歴に追加
                const historyItem = {
                    ...event,
                    id: (0, crypto_1.randomUUID)(),
                    timestamp: new Date().toISOString()
                };
                this.eventHistory.unshift(historyItem); // 先頭に追加
                // 履歴サイズを制限
                if (this.eventHistory.length > this.maxHistorySize) {
                    this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
                }
                // 全てのイベントハンドラーに通知
                this.eventHandlers.forEach((handler) => {
                    try {
                        handler(event);
                    }
                    catch (error) {
                        console.error('[EventSub Manager] Error in event handler:', error);
                    }
                });
            });
            this.connections.push(connection);
        }
        console.log(`[EventSub Manager] Initialized with ${this.connections.length} connections`);
    }
    /**
     * 認証情報を設定
     */
    setCredentials(accessToken, clientId) {
        console.log('[EventSub Manager] Setting credentials for all connections');
        this.accessToken = accessToken;
        this.clientId = clientId;
        // 全ての接続に認証情報を設定
        this.connections.forEach(conn => {
            conn.setCredentials(accessToken, clientId);
        });
    }
    /**
     * 全ての接続を開始
     */
    async connectAll() {
        if (!this.accessToken || !this.clientId) {
            throw new Error('Credentials not set. Call setCredentials() first.');
        }
        console.log('[EventSub Manager] Connecting all connections...');
        // 全ての接続を並列で開始
        const connectPromises = this.connections.map(conn => conn.connect());
        await Promise.all(connectPromises);
        console.log('[EventSub Manager] All connections established');
    }
    /**
     * 最も負荷の低い接続を見つける
     */
    findLeastLoadedConnection() {
        // 接続中の接続のみを対象にする
        const connectedConnections = this.connections.filter(conn => conn.isConnected());
        if (connectedConnections.length === 0) {
            console.warn('[EventSub Manager] No connected connections available');
            return null;
        }
        // サブスクリプション数が最も少ない接続を見つける
        let minConn = connectedConnections[0];
        let minCount = minConn.subscriptionCount;
        for (const conn of connectedConnections) {
            if (conn.subscriptionCount < minCount) {
                minConn = conn;
                minCount = conn.subscriptionCount;
            }
        }
        // 容量チェック
        if (minCount >= this.maxSubscriptionsPerConnection) {
            console.error('[EventSub Manager] All connections are at capacity');
            return null;
        }
        return minConn;
    }
    /**
     * 特定のユーザーがサブスクライブされている接続を見つける
     */
    findConnectionForUser(userId) {
        const connectionIndex = this.channelToConnectionMap.get(userId);
        if (connectionIndex !== undefined && connectionIndex < this.connections.length) {
            return this.connections[connectionIndex];
        }
        return null;
    }
    /**
     * チャンネルをサブスクライブ
     */
    async subscribeToUsers(userIds) {
        if (userIds.length === 0) {
            console.log('[EventSub Manager] No users to subscribe');
            return;
        }
        console.log(`[EventSub Manager] Subscribing to ${userIds.length} users...`);
        // 未サブスクライブのユーザーのみをフィルター
        const newUserIds = userIds.filter(userId => !this.channelToConnectionMap.has(userId));
        if (newUserIds.length === 0) {
            console.log('[EventSub Manager] All users already subscribed');
            return;
        }
        console.log(`[EventSub Manager] ${newUserIds.length} new users to subscribe`);
        // ユーザーを各接続に分散
        for (const userId of newUserIds) {
            const connection = this.findLeastLoadedConnection();
            if (!connection) {
                console.error(`[EventSub Manager] Cannot subscribe to user ${userId}: No available connection`);
                continue;
            }
            try {
                await connection.subscribeToUsers([userId]);
                this.channelToConnectionMap.set(userId, connection.index);
                console.log(`[EventSub Manager] User ${userId} assigned to connection ${connection.index}`);
            }
            catch (error) {
                console.error(`[EventSub Manager] Failed to subscribe to user ${userId}:`, error);
            }
        }
        this.logDistribution();
    }
    /**
     * チャンネルのサブスクリプションを解除
     */
    async unsubscribeFromUsers(userIds) {
        if (userIds.length === 0) {
            console.log('[EventSub Manager] No users to unsubscribe');
            return;
        }
        console.log(`[EventSub Manager] Unsubscribing from ${userIds.length} users...`);
        for (const userId of userIds) {
            const connection = this.findConnectionForUser(userId);
            if (!connection) {
                console.warn(`[EventSub Manager] User ${userId} not found in any connection`);
                continue;
            }
            try {
                await connection.unsubscribeFromUsers([userId]);
                this.channelToConnectionMap.delete(userId);
                console.log(`[EventSub Manager] Unsubscribed from user ${userId} on connection ${connection.index}`);
            }
            catch (error) {
                console.error(`[EventSub Manager] Failed to unsubscribe from user ${userId}:`, error);
            }
        }
        this.logDistribution();
    }
    /**
     * イベントハンドラーを登録
     */
    onStreamEvent(handler) {
        this.eventHandlers.add(handler);
        console.log(`[EventSub Manager] Event handler added. Total handlers: ${this.eventHandlers.size}`);
        return () => {
            this.eventHandlers.delete(handler);
            console.log(`[EventSub Manager] Event handler removed. Total handlers: ${this.eventHandlers.size}`);
        };
    }
    /**
     * 全ての接続を切断
     */
    disconnectAll() {
        console.log('[EventSub Manager] Disconnecting all connections...');
        this.connections.forEach(conn => {
            conn.disconnect();
        });
        this.channelToConnectionMap.clear();
        console.log('[EventSub Manager] All connections disconnected');
    }
    /**
     * 全ての接続を再接続
     */
    async reconnectAll() {
        if (!this.accessToken || !this.clientId) {
            throw new Error('Credentials not set. Call setCredentials() first.');
        }
        console.log('[EventSub Manager] Reconnecting all connections...');
        // 現在のサブスクリプション情報を保存
        const subscribedUserIds = Array.from(this.channelToConnectionMap.keys());
        console.log(`[EventSub Manager] Saving ${subscribedUserIds.length} subscriptions before reconnect`);
        // 全ての接続を切断
        this.disconnectAll();
        // 全ての接続を再接続
        await this.connectAll();
        // サブスクリプションを復元
        if (subscribedUserIds.length > 0) {
            console.log(`[EventSub Manager] Restoring ${subscribedUserIds.length} subscriptions...`);
            await this.subscribeToUsers(subscribedUserIds);
        }
        console.log('[EventSub Manager] Reconnection completed');
    }
    /**
     * 特定のユーザーがサブスクライブ済みか確認
     */
    isSubscribed(userId) {
        return this.channelToConnectionMap.has(userId);
    }
    /**
     * サブスクライブ済みの全ユーザーIDを取得
     */
    getSubscribedUserIds() {
        return Array.from(this.channelToConnectionMap.keys());
    }
    /**
     * 統計情報を取得
     */
    getStats() {
        const connectionStats = this.connections.map(conn => conn.getStats());
        const activeConnections = connectionStats.filter(stats => stats.status === 'connected').length;
        const totalSubscriptions = connectionStats.reduce((sum, stats) => sum + stats.subscriptionCount, 0);
        return {
            totalConnections: this.connections.length,
            activeConnections,
            totalSubscriptions,
            subscribedChannelCount: this.channelToConnectionMap.size,
            connections: connectionStats
        };
    }
    /**
     * 負荷分散状況をログ出力
     */
    logDistribution() {
        console.log('[EventSub Manager] ===== Load Distribution =====');
        this.connections.forEach((conn, index) => {
            const stats = conn.getStats();
            const percentage = ((stats.subscriptionCount / this.maxSubscriptionsPerConnection) * 100).toFixed(1);
            console.log(`[EventSub Manager] Connection ${index}: ${stats.subscriptionCount}/${this.maxSubscriptionsPerConnection} subscriptions (${percentage}%) - Status: ${stats.status}`);
        });
        const total = this.connections.reduce((sum, conn) => sum + conn.subscriptionCount, 0);
        const maxTotal = this.maxConnectionCount * this.maxSubscriptionsPerConnection;
        const totalPercentage = ((total / maxTotal) * 100).toFixed(1);
        console.log(`[EventSub Manager] Total: ${total}/${maxTotal} subscriptions (${totalPercentage}%)`);
        console.log(`[EventSub Manager] Unique channels: ${this.channelToConnectionMap.size}`);
        console.log('[EventSub Manager] ================================');
    }
    /**
     * 容量情報を取得
     */
    getCapacity() {
        const used = this.connections.reduce((sum, conn) => sum + conn.subscriptionCount, 0);
        const total = this.maxConnectionCount * this.maxSubscriptionsPerConnection;
        const available = total - used;
        const percentage = (used / total) * 100;
        return { used, total, available, percentage };
    }
    /**
     * イベント履歴を取得
     * @param limit 取得件数（デフォルト: 50）
     */
    getEventHistory(limit) {
        const maxLimit = limit || 50;
        return this.eventHistory.slice(0, Math.min(maxLimit, this.eventHistory.length));
    }
    /**
     * アクセストークンを取得
     * @returns アクセストークン（未設定の場合はnull）
     */
    getAccessToken() {
        return this.accessToken;
    }
}
exports.TwitchEventSubManager = TwitchEventSubManager;
// シングルトンインスタンス
exports.twitchEventSubManager = new TwitchEventSubManager();
//# sourceMappingURL=twitchEventSubManager.js.map