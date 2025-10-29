import { createHmac } from 'crypto';
import { fetch } from 'undici';
import { trackedFetch } from '../utils/apiTracker';

interface StreamEventHandler {
  (event: {
    type: 'online' | 'offline';
    broadcasterId: string;
    broadcasterLogin: string;
    broadcasterName: string;
    startedAt?: string;
  }): void;
}

class TwitchEventSubWebhookService {
  private accessToken: string | null = null;
  private clientId: string | null = null;
  private webhookSecret: string | null = null;
  private webhookUrl: string | null = null;
  private eventHandlers: Set<StreamEventHandler> = new Set();
  private subscribedUserIds: Set<string> = new Set();
  private subscriptionIds: Map<string, string[]> = new Map(); // userId -> [subscriptionIds]

  constructor() {
    console.log('[Twitch EventSub Webhook] Service initialized');
  }

  public setCredentials(accessToken: string, clientId: string, webhookSecret: string, webhookUrl: string): void {
    console.log('[Twitch EventSub Webhook] Setting credentials');
    this.accessToken = accessToken;
    this.clientId = clientId;
    this.webhookSecret = webhookSecret;
    this.webhookUrl = webhookUrl;
  }

  /**
   * Twitch署名を検証
   */
  public verifySignature(
    messageId: string,
    messageTimestamp: string,
    messageBody: string,
    signature: string
  ): boolean {
    if (!this.webhookSecret) {
      console.error('[Twitch EventSub Webhook] Webhook secret not set');
      return false;
    }

    const message = messageId + messageTimestamp + messageBody;
    const expectedSignature = 'sha256=' + createHmac('sha256', this.webhookSecret)
      .update(message)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Webhookからの通知を処理
   */
  public handleWebhookNotification(notification: any): void {
    const subscriptionType = notification.subscription?.type;
    const event = notification.event;

    if (!event) {
      console.error('[Twitch EventSub Webhook] Notification missing event');
      return;
    }

    console.log(`[Twitch EventSub Webhook] Event received: ${subscriptionType}`, event);

    let eventType: 'online' | 'offline';
    if (subscriptionType === 'stream.online') {
      eventType = 'online';
    } else if (subscriptionType === 'stream.offline') {
      eventType = 'offline';
    } else {
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

  public async subscribeToUsers(userIds: string[]): Promise<void> {
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
      } catch (error) {
        console.error(`[Twitch EventSub Webhook] Failed to subscribe to user ${userId}:`, error);
      }
    }
  }

  private async createSubscription(
    type: string,
    version: string,
    condition: Record<string, string>
  ): Promise<string> {
    const response = await trackedFetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
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
          method: 'webhook',
          callback: this.webhookUrl,
          secret: this.webhookSecret
        }
      }),
      service: 'twitch',
      endpoint: 'POST /eventsub/subscriptions (webhook)'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create subscription: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { data: Array<{ id: string }> };
    return data.data[0].id;
  }

  public async unsubscribeFromUsers(userIds: string[]): Promise<void> {
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
        } catch (error) {
          console.error(`[Twitch EventSub Webhook] Failed to delete subscription ${subId}:`, error);
        }
      }

      this.subscriptionIds.delete(userId);
      this.subscribedUserIds.delete(userId);
    }
  }

  private async deleteSubscription(subscriptionId: string): Promise<void> {
    const response = await trackedFetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId!
      },
      service: 'twitch',
      endpoint: 'DELETE /eventsub/subscriptions (webhook)'
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`Failed to delete subscription: ${response.status} - ${errorText}`);
    }
  }

  public onStreamEvent(handler: StreamEventHandler): () => void {
    this.eventHandlers.add(handler);
    console.log(`[Twitch EventSub Webhook] Event handler added. Total handlers: ${this.eventHandlers.size}`);

    return () => {
      this.eventHandlers.delete(handler);
      console.log(`[Twitch EventSub Webhook] Event handler removed. Total handlers: ${this.eventHandlers.size}`);
    };
  }

  public getSubscribedUserIds(): string[] {
    return Array.from(this.subscribedUserIds);
  }
}

export const twitchEventSubWebhookService = new TwitchEventSubWebhookService();
