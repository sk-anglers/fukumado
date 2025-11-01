import { TwitchEventSubConnection } from './twitchEventSubConnection';
import { twitchConduitManager } from './twitchConduitManager';
import type { StreamEventHandler, ManagerStats, EventSubHistoryItem } from '../types/eventsub';
import { randomUUID } from 'crypto';

/**
 * EventSubモード
 * - websocket: 従来のWebSocketモード（最大900サブスクリプション）
 * - conduit: Conduitsモード（最大100,000サブスクリプション）
 */
export type EventSubMode = 'websocket' | 'conduit';

/**
 * Twitch EventSub WebSocketの複数接続を管理するマネージャークラス
 *
 * 2つのモードをサポート:
 * 1. WebSocketモード（デフォルト）
 *    - 3本のWebSocket接続を管理し、負荷分散を行う
 *    - 各接続: 最大300サブスクリプション（公式制限）
 *    - 合計: 最大900サブスクリプション（300 × 3接続）
 *
 * 2. Conduitsモード
 *    - Twitch EventSub Conduitsを使用
 *    - 最大20,000シャード対応
 *    - 合計: 最大100,000サブスクリプション
 *
 * 公式ドキュメント: https://dev.twitch.tv/docs/eventsub/handling-websocket-events
 */
export class TwitchEventSubManager {
  private mode: EventSubMode;
  private connections: TwitchEventSubConnection[] = [];
  private channelToConnectionMap: Map<string, number> = new Map(); // userId -> connectionIndex
  private eventHandlers: Set<StreamEventHandler> = new Set();
  private accessToken: string | null = null;
  private clientId: string | null = null;
  private readonly maxConnectionCount: number = 3;
  private readonly maxSubscriptionsPerConnection: number = 300;
  private eventHistory: EventSubHistoryItem[] = [];
  private readonly maxHistorySize: number = 100; // 最大100件保持

  constructor(mode: EventSubMode = 'websocket') {
    this.mode = mode;
    console.log(`[EventSub Manager] Initializing in ${mode} mode...`);

    if (this.mode === 'websocket') {
      // WebSocketモード: 3本の接続を作成
      for (let i = 0; i < this.maxConnectionCount; i++) {
        const connection = new TwitchEventSubConnection(i);

        // 各接続からのイベントを統合
        connection.onStreamEvent((event) => {
          this.handleStreamEvent(event);
        });

        this.connections.push(connection);
      }

      console.log(`[EventSub Manager] Initialized with ${this.connections.length} WebSocket connections`);
    } else {
      // Conduitsモード: TwitchConduitManagerを使用
      twitchConduitManager.onStreamEvent((event) => {
        this.handleStreamEvent(event);
      });

      console.log('[EventSub Manager] Initialized in Conduits mode');
    }
  }

  /**
   * ストリームイベントを処理（共通処理）
   */
  private handleStreamEvent(event: any): void {
    // イベント履歴に追加
    const historyItem: EventSubHistoryItem = {
      ...event,
      id: randomUUID(),
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
      } catch (error) {
        console.error('[EventSub Manager] Error in event handler:', error);
      }
    });
  }

  /**
   * 認証情報を設定
   */
  public setCredentials(accessToken: string, clientId: string): void {
    console.log(`[EventSub Manager] Setting credentials (${this.mode} mode)`);
    this.accessToken = accessToken;
    this.clientId = clientId;

    if (this.mode === 'websocket') {
      // WebSocketモード: 全ての接続に認証情報を設定
      this.connections.forEach(conn => {
        conn.setCredentials(accessToken, clientId);
      });
    }
    // Conduitsモードでは認証情報はApp Access Tokenを使用するため、ここでは何もしない
  }

  /**
   * 全ての接続を開始
   */
  public async connectAll(): Promise<void> {
    console.log(`[EventSub Manager] Connecting (${this.mode} mode)...`);

    if (this.mode === 'websocket') {
      // WebSocketモード: 従来の処理
      if (!this.accessToken || !this.clientId) {
        throw new Error('Credentials not set. Call setCredentials() first.');
      }

      // 全ての接続を並列で開始
      const connectPromises = this.connections.map(conn => conn.connect());
      await Promise.all(connectPromises);

      console.log('[EventSub Manager] All WebSocket connections established');
    } else {
      // Conduitsモード: Conduitマネージャーを初期化
      await twitchConduitManager.initialize();

      // 初期シャードを作成（1つ）
      await twitchConduitManager.createWebSocketShard('0');

      console.log('[EventSub Manager] Conduit initialized and shard created');
    }
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

    console.log(`[EventSub Manager] Subscribing to ${userIds.length} users (${this.mode} mode)...`);

    if (this.mode === 'websocket') {
      // WebSocketモード: 従来の処理
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
    } else {
      // Conduitsモード: ConduitManagerに委譲
      await twitchConduitManager.subscribeToUsers(userIds);
    }
  }

  /**
   * チャンネルのサブスクリプションを解除
   */
  public async unsubscribeFromUsers(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      console.log('[EventSub Manager] No users to unsubscribe');
      return;
    }

    console.log(`[EventSub Manager] Unsubscribing from ${userIds.length} users (${this.mode} mode)...`);

    if (this.mode === 'websocket') {
      // WebSocketモード: 従来の処理
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
    } else {
      // Conduitsモード: ConduitManagerに委譲
      await twitchConduitManager.unsubscribeFromUsers(userIds);
    }
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
    console.log(`[EventSub Manager] Disconnecting (${this.mode} mode)...`);

    if (this.mode === 'websocket') {
      // WebSocketモード: 全ての接続を切断
      this.connections.forEach(conn => {
        conn.disconnect();
      });

      this.channelToConnectionMap.clear();
      console.log('[EventSub Manager] All WebSocket connections disconnected');
    } else {
      // Conduitsモード: ConduitManagerを切断
      twitchConduitManager.disconnect();
      console.log('[EventSub Manager] Conduit disconnected');
    }
  }

  /**
   * 全ての接続を再接続
   */
  public async reconnectAll(): Promise<void> {
    console.log(`[EventSub Manager] Reconnecting (${this.mode} mode)...`);

    if (this.mode === 'websocket') {
      // WebSocketモード: 従来の処理
      if (!this.accessToken || !this.clientId) {
        throw new Error('Credentials not set. Call setCredentials() first.');
      }

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
    } else {
      // Conduitsモード: 再接続処理
      // TODO: Conduitの再接続処理を実装
      console.warn('[EventSub Manager] Conduit reconnection not yet implemented');
    }
  }

  /**
   * 特定のユーザーがサブスクライブ済みか確認
   */
  public isSubscribed(userId: string): boolean {
    if (this.mode === 'websocket') {
      return this.channelToConnectionMap.has(userId);
    } else {
      return twitchConduitManager.isSubscribed(userId);
    }
  }

  /**
   * サブスクライブ済みの全ユーザーIDを取得
   */
  public getSubscribedUserIds(): string[] {
    if (this.mode === 'websocket') {
      return Array.from(this.channelToConnectionMap.keys());
    } else {
      return twitchConduitManager.getSubscribedUserIds();
    }
  }

  /**
   * 統計情報を取得
   */
  public async getStats(): Promise<ManagerStats> {
    if (this.mode === 'websocket') {
      // WebSocketモード: 従来の処理
      const connectionStats = this.connections.map(conn => conn.getStats());
      const activeConnections = connectionStats.filter(stats => stats.status === 'connected').length;
      const totalSubscriptions = connectionStats.reduce((sum, stats) => sum + stats.subscriptionCount, 0);

      return {
        mode: this.mode,
        totalConnections: this.connections.length,
        activeConnections,
        totalSubscriptions,
        subscribedChannelCount: this.channelToConnectionMap.size,
        connections: connectionStats
      };
    } else {
      // Conduitsモード: Conduit統計情報
      const conduitStats = await twitchConduitManager.getStats();

      return {
        mode: this.mode,
        totalConnections: 1, // Conduit自体
        activeConnections: 1,
        totalSubscriptions: conduitStats.totalSubscriptions,
        subscribedChannelCount: twitchConduitManager.getSubscribedUserIds().length,
        connections: [], // Conduitsモードでは接続情報は別途取得
        conduitStats // Conduit固有の統計情報
      };
    }
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

  /**
   * イベント履歴を取得
   * @param limit 取得件数（デフォルト: 50）
   */
  public getEventHistory(limit?: number): EventSubHistoryItem[] {
    const maxLimit = limit || 50;
    return this.eventHistory.slice(0, Math.min(maxLimit, this.eventHistory.length));
  }

  /**
   * アクセストークンを取得
   * @returns アクセストークン（未設定の場合はnull）
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }
}

// シングルトンインスタンス
// デフォルトはWebSocketモード（後方互換性）
// Conduitsモードを使用する場合は、環境変数 EVENTSUB_MODE=conduit を設定
const eventSubMode = (process.env.EVENTSUB_MODE as EventSubMode) || 'websocket';
export const twitchEventSubManager = new TwitchEventSubManager(eventSubMode);
