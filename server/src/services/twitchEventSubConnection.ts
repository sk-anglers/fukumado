import * as WS from 'ws';
import { fetch } from 'undici';
import type {
  EventSubMessage,
  StreamEvent,
  StreamEventHandler,
  ConnectionStatus,
  ConnectionStats
} from '../types/eventsub';

/**
 * 単一のTwitch EventSub WebSocket接続を管理するクラス
 *
 * 各接続は最大10,000サブスクリプションを管理可能
 * (stream.online + stream.offline = 2サブスクリプション/チャンネル)
 * 実質最大5,000チャンネルまで対応
 */
export class TwitchEventSubConnection {
  public readonly index: number;
  private ws: WS.WebSocket | null = null;
  private sessionId: string | null = null;
  private accessToken: string | null = null;
  private clientId: string | null = null;
  private reconnectUrl: string | null = null;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Set<StreamEventHandler> = new Set();
  private subscribedUserIds: Set<string> = new Set();
  private subscriptionIds: Map<string, string[]> = new Map(); // userId -> [subscriptionIds]
  private status: ConnectionStatus = 'disconnected';
  private connectedAt: Date | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(index: number) {
    this.index = index;
    console.log(`[EventSub Connection ${index}] Initialized`);
  }

  /**
   * 認証情報を設定
   */
  public setCredentials(accessToken: string, clientId: string): void {
    console.log(`[EventSub Connection ${this.index}] Setting credentials`);
    this.accessToken = accessToken;
    this.clientId = clientId;
  }

  /**
   * WebSocket接続を開始
   */
  public async connect(): Promise<void> {
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

    this.ws.on('message', (data: WS.Data) => {
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
      } else {
        console.error(`[EventSub Connection ${this.index}] Max reconnection attempts reached`);
        this.status = 'error';
      }
    });

    this.ws.on('error', (error) => {
      console.error(`[EventSub Connection ${this.index}] WebSocket error:`, error);
      this.status = 'error';
    });
  }

  /**
   * メッセージを処理
   */
  private handleMessage(data: string): void {
    try {
      const message: EventSubMessage = JSON.parse(data);
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
    } catch (error) {
      console.error(`[EventSub Connection ${this.index}] Failed to parse message:`, error);
    }
  }

  /**
   * Welcomeメッセージを処理
   */
  private handleWelcome(message: EventSubMessage): void {
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
  private handleKeepalive(): void {
    console.log(`[EventSub Connection ${this.index}] Keepalive received`);
    // Keepaliveタイマーをリセット
    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
    }
  }

  /**
   * 通知メッセージを処理
   */
  private handleNotification(message: EventSubMessage): void {
    const { subscription_type } = message.metadata;
    const event = message.payload.event;

    if (!event) {
      console.error(`[EventSub Connection ${this.index}] Notification missing event`);
      return;
    }

    console.log(`[EventSub Connection ${this.index}] Event received: ${subscription_type}`, event);

    let eventType: 'online' | 'offline';
    if (subscription_type === 'stream.online') {
      eventType = 'online';
    } else if (subscription_type === 'stream.offline') {
      eventType = 'offline';
    } else {
      console.log(`[EventSub Connection ${this.index}] Unhandled subscription type: ${subscription_type}`);
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
        console.error(`[EventSub Connection ${this.index}] Error in event handler:`, error);
      }
    });
  }

  /**
   * 再接続メッセージを処理
   */
  private handleReconnect(message: EventSubMessage): void {
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
  private handleRevocation(message: EventSubMessage): void {
    const subscription = message.payload.subscription;
    if (!subscription) return;

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
  private resetKeepaliveTimer(timeoutSeconds: number): void {
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
  public async subscribeToUsers(userIds: string[]): Promise<void> {
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

        console.log(`[EventSub Connection ${this.index}] Subscribed to user ${userId}: online=${onlineSubId}, offline=${offlineSubId}`);
      } catch (error) {
        console.error(`[EventSub Connection ${this.index}] Failed to subscribe to user ${userId}:`, error);
      }
    }
  }

  /**
   * サブスクリプションを作成
   */
  private async createSubscription(
    type: string,
    version: string,
    condition: Record<string, string>
  ): Promise<string> {
    const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId!,
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

    const data = await response.json() as { data: Array<{ id: string }> };
    return data.data[0].id;
  }

  /**
   * ユーザーのサブスクリプションを解除
   */
  public async unsubscribeFromUsers(userIds: string[]): Promise<void> {
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
        } catch (error) {
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
  private async deleteSubscription(subscriptionId: string): Promise<void> {
    const response = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId!
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
    console.log(`[EventSub Connection ${this.index}] Event handler added. Total handlers: ${this.eventHandlers.size}`);

    return () => {
      this.eventHandlers.delete(handler);
      console.log(`[EventSub Connection ${this.index}] Event handler removed. Total handlers: ${this.eventHandlers.size}`);
    };
  }

  /**
   * 接続を切断
   */
  public disconnect(): void {
    console.log(`[EventSub Connection ${this.index}] Disconnecting...`);
    this.cleanup();
    this.ws?.close();
    this.ws = null;
    this.status = 'disconnected';
  }

  /**
   * クリーンアップ
   */
  private cleanup(): void {
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
  public getStats(): ConnectionStats {
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
  public get subscriptionCount(): number {
    return this.subscribedUserIds.size * 2; // online + offline
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
   * 接続状態を取得
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 接続中かどうか
   */
  public isConnected(): boolean {
    return this.status === 'connected' && this.sessionId !== null;
  }
}
