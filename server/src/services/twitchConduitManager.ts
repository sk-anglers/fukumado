import * as WS from 'ws';
import { twitchConduitClient } from './twitchConduitClient';
import { getTwitchAppAccessToken } from './twitchAppAuth';
import { env } from '../config/env';
import { metricsCollector } from './metricsCollector';
import type { Conduit, ConduitShard, ConduitStats } from '../types/conduit';
import type { StreamEvent, StreamEventHandler } from '../types/eventsub';

/**
 * WebSocket接続情報
 */
interface WebSocketConnection {
  ws: WS.WebSocket;
  sessionId: string;
  shardId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  connectedAt: Date | null;
  reconnectAttempts: number;
  reconnectTimer?: NodeJS.Timeout;
}

/**
 * Twitch EventSub Conduits マネージャー
 *
 * Conduitsを使用したEventSub管理を行います。
 * - 最大20,000シャード対応
 * - 最大100,000サブスクリプション対応
 * - 自動シャード管理
 * - WebSocket接続プール管理
 */
export class TwitchConduitManager {
  private conduitId: string | null = null;
  private connections: Map<string, WebSocketConnection> = new Map(); // shardId -> connection
  private subscribedUserIds: Set<string> = new Set();
  private subscriptionIds: Map<string, string[]> = new Map(); // userId -> [subscriptionIds]
  private eventHandlers: Set<StreamEventHandler> = new Set();
  private initialShardCount: number = 10; // 初期シャード数

  constructor() {
    console.log('[Conduit Manager] Initializing...');
  }

  /**
   * Conduitマネージャーを初期化
   * 既存Conduitを取得するか、新規作成します
   */
  public async initialize(): Promise<void> {
    console.log('[Conduit Manager] Initializing Conduit...');

    try {
      // 既存Conduit確認
      const existingConduits = await twitchConduitClient.getConduits();

      if (existingConduits.length > 0) {
        this.conduitId = existingConduits[0].id;
        console.log(`[Conduit Manager] Using existing Conduit: ${this.conduitId}`);

        // 既存シャード情報を取得
        const shardsResponse = await twitchConduitClient.getShards(this.conduitId);
        console.log(`[Conduit Manager] Found ${shardsResponse.data.length} existing shard(s)`);
      } else {
        // 新規Conduit作成
        console.log(`[Conduit Manager] Creating new Conduit with ${this.initialShardCount} shard capacity...`);
        const conduit = await twitchConduitClient.createConduit(this.initialShardCount);
        this.conduitId = conduit.id;
        console.log(`[Conduit Manager] Conduit created: ${this.conduitId}`);
      }
    } catch (error) {
      console.error('[Conduit Manager] Failed to initialize Conduit:', error);
      metricsCollector.incrementCounter('conduit_api_errors_total');
      throw error;
    }
  }

  /**
   * 新しいWebSocket接続を作成してシャードとして登録
   */
  public async createWebSocketShard(shardId: string, retryCount: number = 3): Promise<void> {
    if (!this.conduitId) {
      throw new Error('Conduit not initialized. Call initialize() first.');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        console.log(`[Conduit Manager] Creating WebSocket shard #${shardId} (attempt ${attempt}/${retryCount})...`);

        // WebSocket接続を確立
        const wsUrl = 'wss://eventsub.wss.twitch.tv/ws';
        const ws = new WS.WebSocket(wsUrl);

        // 接続情報を保存
        const connection: WebSocketConnection = {
          ws,
          sessionId: '',
          shardId,
          status: 'connecting',
          connectedAt: null,
          reconnectAttempts: 0
        };
        this.connections.set(shardId, connection);

        // 接続確立を待機
        await new Promise<void>((resolve, reject) => {
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
        await twitchConduitClient.updateShards({
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
      } catch (error) {
        lastError = error as Error;
        console.error(`[Conduit Manager] Shard #${shardId} creation failed (attempt ${attempt}/${retryCount}):`, error);
        metricsCollector.incrementCounter('conduit_shard_failures_total');

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
  private waitForSessionId(ws: WS.WebSocket, shardId: string, timeoutMs: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for session_welcome on shard #${shardId}`));
      }, timeoutMs);

      const messageHandler = (data: WS.Data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.metadata?.message_type === 'session_welcome') {
            const sessionId = message.payload?.session?.id;
            if (sessionId) {
              clearTimeout(timeout);
              ws.off('message', messageHandler); // ハンドラーを削除
              resolve(sessionId);
            } else {
              clearTimeout(timeout);
              reject(new Error(`session_welcome missing session.id on shard #${shardId}`));
            }
          }
        } catch (error) {
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
  private setupMessageHandlers(ws: WS.WebSocket, shardId: string): void {
    ws.on('message', (data: WS.Data) => {
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
            } else {
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
      } catch (error) {
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
      metricsCollector.incrementCounter('conduit_websocket_errors_total');
    });
  }

  /**
   * シャードを再接続
   */
  private async reconnectShard(shardId: string, reconnectUrl?: string): Promise<void> {
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
      metricsCollector.incrementCounter('conduit_reconnection_failures_total');
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
        await new Promise<void>((resolve, reject) => {
          ws.on('open', () => {
            console.log(`[Conduit Manager] Shard #${shardId} reconnected successfully`);
            connection.status = 'connected';
            connection.connectedAt = new Date();
            connection.reconnectAttempts = 0; // リセット
            metricsCollector.incrementCounter('conduit_reconnections_total');
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
          await twitchConduitClient.updateShards({
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
      } catch (error) {
        console.error(`[Conduit Manager] Shard #${shardId} reconnection failed:`, error);
        metricsCollector.incrementCounter('conduit_reconnection_failures_total');

        // 再度再接続を試行
        this.reconnectShard(shardId, reconnectUrl);
      }
    }, backoffMs);
  }

  /**
   * 通知メッセージを処理
   */
  private handleNotification(message: any, shardId: string): void {
    const { subscription_type } = message.metadata || {};
    const event = message.payload?.event;

    if (!event) {
      console.error(`[Conduit Manager] Shard #${shardId} notification missing event`);
      return;
    }

    console.log(`[Conduit Manager] Shard #${shardId} event: ${subscription_type}`, event);

    let eventType: 'online' | 'offline';
    if (subscription_type === 'stream.online') {
      eventType = 'online';
    } else if (subscription_type === 'stream.offline') {
      eventType = 'offline';
    } else {
      console.log(`[Conduit Manager] Shard #${shardId} unhandled type: ${subscription_type}`);
      return;
    }

    // イベントハンドラーに通知
    const streamEvent: StreamEvent = {
      type: eventType,
      broadcasterId: event.broadcaster_user_id,
      broadcasterLogin: event.broadcaster_user_login,
      broadcasterName: event.broadcaster_user_name,
      startedAt: event.started_at
    };

    this.eventHandlers.forEach((handler) => {
      try {
        handler(streamEvent);
      } catch (error) {
        console.error(`[Conduit Manager] Error in event handler:`, error);
      }
    });
  }

  /**
   * ユーザーをサブスクライブ（Conduitモード）
   */
  public async subscribeToUsers(userIds: string[]): Promise<void> {
    if (!this.conduitId) {
      throw new Error('Conduit not initialized. Call initialize() first.');
    }

    console.log(`[Conduit Manager] Subscribing to ${userIds.length} users...`);

    const appToken = await getTwitchAppAccessToken();
    const { clientId } = env.twitch;

    for (const userId of userIds) {
      if (this.subscribedUserIds.has(userId)) {
        console.log(`[Conduit Manager] Already subscribed to user: ${userId}`);
        continue;
      }

      try {
        // stream.online イベントをサブスクライブ
        const onlineSubId = await this.createSubscription(
          appToken,
          clientId!,
          'stream.online',
          '1',
          { broadcaster_user_id: userId }
        );

        // stream.offline イベントをサブスクライブ
        const offlineSubId = await this.createSubscription(
          appToken,
          clientId!,
          'stream.offline',
          '1',
          { broadcaster_user_id: userId }
        );

        // サブスクリプションIDを保存
        this.subscriptionIds.set(userId, [onlineSubId, offlineSubId]);
        this.subscribedUserIds.add(userId);

        console.log(`[Conduit Manager] Subscribed to user ${userId}: online=${onlineSubId}, offline=${offlineSubId}`);
      } catch (error) {
        console.error(`[Conduit Manager] Failed to subscribe to user ${userId}:`, error);
      }
    }
  }

  /**
   * Conduitモードでサブスクリプションを作成
   */
  private async createSubscription(
    appToken: string,
    clientId: string,
    type: string,
    version: string,
    condition: Record<string, string>
  ): Promise<string> {
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

    const data = await response.json() as { data: Array<{ id: string }> };
    return data.data[0].id;
  }

  /**
   * ユーザーのサブスクリプションを解除
   */
  public async unsubscribeFromUsers(userIds: string[]): Promise<void> {
    console.log(`[Conduit Manager] Unsubscribing from ${userIds.length} users...`);

    const appToken = await getTwitchAppAccessToken();
    const { clientId } = env.twitch;

    for (const userId of userIds) {
      const subIds = this.subscriptionIds.get(userId);
      if (!subIds) {
        console.log(`[Conduit Manager] No subscriptions found for user: ${userId}`);
        continue;
      }

      for (const subId of subIds) {
        try {
          await this.deleteSubscription(appToken, clientId!, subId);
          console.log(`[Conduit Manager] Deleted subscription: ${subId}`);
        } catch (error) {
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
  private async deleteSubscription(appToken: string, clientId: string, subscriptionId: string): Promise<void> {
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
  public onStreamEvent(handler: StreamEventHandler): () => void {
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
  public async getStats(): Promise<ConduitStats> {
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

    const shardsResponse = await twitchConduitClient.getShards(this.conduitId);
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
  public getSubscribedUserIds(): string[] {
    return Array.from(this.subscribedUserIds);
  }

  /**
   * 特定のユーザーがサブスクライブ済みか確認
   */
  public isSubscribed(userId: string): boolean {
    return this.subscribedUserIds.has(userId);
  }

  /**
   * 全てのWebSocket接続を切断
   */
  public disconnect(): void {
    console.log('[Conduit Manager] Disconnecting all shards...');

    this.connections.forEach((connection, shardId) => {
      console.log(`[Conduit Manager] Closing shard #${shardId}...`);
      connection.ws.close();
    });

    this.connections.clear();
    console.log('[Conduit Manager] All shards disconnected');
  }
}

// シングルトンインスタンス
export const twitchConduitManager = new TwitchConduitManager();
