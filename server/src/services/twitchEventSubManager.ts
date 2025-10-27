import { TwitchEventSubConnection } from './twitchEventSubConnection';
import type { StreamEventHandler, ManagerStats } from '../types/eventsub';

/**
 * Twitch EventSub WebSocketの複数接続を管理するマネージャークラス
 *
 * 3本のWebSocket接続を管理し、負荷分散を行う
 * - 各接続: 最大10,000サブスクリプション（5,000チャンネル）
 * - 合計: 最大30,000サブスクリプション（15,000チャンネル）
 */
export class TwitchEventSubManager {
  private connections: TwitchEventSubConnection[] = [];
  private channelToConnectionMap: Map<string, number> = new Map(); // userId -> connectionIndex
  private eventHandlers: Set<StreamEventHandler> = new Set();
  private accessToken: string | null = null;
  private clientId: string | null = null;
  private readonly maxConnectionCount: number = 3;
  private readonly maxSubscriptionsPerConnection: number = 10000;

  constructor() {
    console.log('[EventSub Manager] Initializing with 3 connections...');

    // 3本の接続を作成
    for (let i = 0; i < this.maxConnectionCount; i++) {
      const connection = new TwitchEventSubConnection(i);

      // 各接続からのイベントを統合
      connection.onStreamEvent((event) => {
        // 全てのイベントハンドラーに通知
        this.eventHandlers.forEach((handler) => {
          try {
            handler(event);
          } catch (error) {
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
  public setCredentials(accessToken: string, clientId: string): void {
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
  public async connectAll(): Promise<void> {
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
  private findLeastLoadedConnection(): TwitchEventSubConnection | null {
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
  private findConnectionForUser(userId: string): TwitchEventSubConnection | null {
    const connectionIndex = this.channelToConnectionMap.get(userId);
    if (connectionIndex !== undefined && connectionIndex < this.connections.length) {
      return this.connections[connectionIndex];
    }
    return null;
  }

  /**
   * チャンネルをサブスクライブ
   */
  public async subscribeToUsers(userIds: string[]): Promise<void> {
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
      } catch (error) {
        console.error(`[EventSub Manager] Failed to subscribe to user ${userId}:`, error);
      }
    }

    this.logDistribution();
  }

  /**
   * チャンネルのサブスクリプションを解除
   */
  public async unsubscribeFromUsers(userIds: string[]): Promise<void> {
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
      } catch (error) {
        console.error(`[EventSub Manager] Failed to unsubscribe from user ${userId}:`, error);
      }
    }

    this.logDistribution();
  }

  /**
   * イベントハンドラーを登録
   */
  public onStreamEvent(handler: StreamEventHandler): () => void {
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
  public disconnectAll(): void {
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
  public async reconnectAll(): Promise<void> {
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
  public isSubscribed(userId: string): boolean {
    return this.channelToConnectionMap.has(userId);
  }

  /**
   * サブスクライブ済みの全ユーザーIDを取得
   */
  public getSubscribedUserIds(): string[] {
    return Array.from(this.channelToConnectionMap.keys());
  }

  /**
   * 統計情報を取得
   */
  public getStats(): ManagerStats {
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
  private logDistribution(): void {
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
  public getCapacity(): {
    used: number;
    total: number;
    available: number;
    percentage: number;
  } {
    const used = this.connections.reduce((sum, conn) => sum + conn.subscriptionCount, 0);
    const total = this.maxConnectionCount * this.maxSubscriptionsPerConnection;
    const available = total - used;
    const percentage = (used / total) * 100;

    return { used, total, available, percentage };
  }
}

// シングルトンインスタンス
export const twitchEventSubManager = new TwitchEventSubManager();
