import WebSocket from 'ws';
import { fetch } from 'undici';

interface EventSubSession {
  id: string;
  status: string;
  connected_at: string;
  keepalive_timeout_seconds: number;
  reconnect_url?: string;
}

interface EventSubMessage {
  metadata: {
    message_id: string;
    message_type: string;
    message_timestamp: string;
    subscription_type?: string;
    subscription_version?: string;
  };
  payload: {
    session?: EventSubSession;
    subscription?: {
      id: string;
      status: string;
      type: string;
      version: string;
      condition: Record<string, string>;
      transport: {
        method: string;
        session_id: string;
      };
      created_at: string;
    };
    event?: {
      id: string;
      broadcaster_user_id: string;
      broadcaster_user_login: string;
      broadcaster_user_name: string;
      type?: string;
      started_at?: string;
    };
  };
}

type StreamEventHandler = (event: {
  type: 'online' | 'offline';
  broadcasterId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  startedAt?: string;
}) => void;

class TwitchEventSubService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private accessToken: string | null = null;
  private clientId: string | null = null;
  private reconnectUrl: string | null = null;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Set<StreamEventHandler> = new Set();
  private subscribedUserIds: Set<string> = new Set();
  private subscriptionIds: Map<string, string[]> = new Map(); // userId -> [subscriptionIds]

  constructor() {
    console.log('[Twitch EventSub] Service initialized');
  }

  public setCredentials(accessToken: string, clientId: string): void {
    console.log('[Twitch EventSub] Setting credentials');
    this.accessToken = accessToken;
    this.clientId = clientId;
  }

  public async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[Twitch EventSub] Already connected');
      return;
    }

    if (!this.accessToken || !this.clientId) {
      throw new Error('Credentials not set. Call setCredentials() first.');
    }

    const wsUrl = this.reconnectUrl || 'wss://eventsub.wss.twitch.tv/ws';
    console.log(`[Twitch EventSub] Connecting to ${wsUrl}`);

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('[Twitch EventSub] WebSocket connected');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
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

  private handleMessage(data: string): void {
    try {
      const message: EventSubMessage = JSON.parse(data);
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
    } catch (error) {
      console.error('[Twitch EventSub] Failed to parse message:', error);
    }
  }

  private handleWelcome(message: EventSubMessage): void {
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

  private handleKeepalive(): void {
    console.log('[Twitch EventSub] Keepalive received');
    // Keepaliveタイマーをリセット
    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
    }
  }

  private handleNotification(message: EventSubMessage): void {
    const { subscription_type } = message.metadata;
    const event = message.payload.event;

    if (!event) {
      console.error('[Twitch EventSub] Notification missing event');
      return;
    }

    console.log(`[Twitch EventSub] Event received: ${subscription_type}`, event);

    let eventType: 'online' | 'offline';
    if (subscription_type === 'stream.online') {
      eventType = 'online';
    } else if (subscription_type === 'stream.offline') {
      eventType = 'offline';
    } else {
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

  private handleReconnect(message: EventSubMessage): void {
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

  private handleRevocation(message: EventSubMessage): void {
    const subscription = message.payload.subscription;
    if (!subscription) return;

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

  private resetKeepaliveTimer(timeoutSeconds: number): void {
    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
    }

    // タイムアウト + 10秒後に接続が切れたとみなす
    this.keepaliveTimer = setTimeout(() => {
      console.error('[Twitch EventSub] Keepalive timeout, reconnecting...');
      this.ws?.close();
    }, (timeoutSeconds + 10) * 1000);
  }

  public async subscribeToUsers(userIds: string[]): Promise<void> {
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
      } catch (error) {
        console.error(`[Twitch EventSub] Failed to subscribe to user ${userId}:`, error);
      }
    }
  }

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

  public async unsubscribeFromUsers(userIds: string[]): Promise<void> {
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
        } catch (error) {
          console.error(`[Twitch EventSub] Failed to delete subscription ${subId}:`, error);
        }
      }

      this.subscriptionIds.delete(userId);
      this.subscribedUserIds.delete(userId);
    }
  }

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

  public onStreamEvent(handler: StreamEventHandler): () => void {
    this.eventHandlers.add(handler);
    console.log(`[Twitch EventSub] Event handler added. Total handlers: ${this.eventHandlers.size}`);

    return () => {
      this.eventHandlers.delete(handler);
      console.log(`[Twitch EventSub] Event handler removed. Total handlers: ${this.eventHandlers.size}`);
    };
  }

  public disconnect(): void {
    console.log('[Twitch EventSub] Disconnecting...');
    this.cleanup();
    this.ws?.close();
    this.ws = null;
  }

  private cleanup(): void {
    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    this.sessionId = null;
    this.reconnectUrl = null;
  }

  public getSubscribedUserIds(): string[] {
    return Array.from(this.subscribedUserIds);
  }
}

export const twitchEventSubService = new TwitchEventSubService();
