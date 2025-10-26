import tmi from 'tmi.js';
import { badgeService } from './badgeService';

export interface TwitchEmote {
  id: string;
  positions: Array<{ start: number; end: number }>;
}

export interface TwitchBadge {
  setId: string;
  version: string;
  imageUrl?: string;
}

export interface TwitchChatMessage {
  id: string;
  platform: 'twitch';
  author: string;
  message: string;
  timestamp: string;
  avatarColor: string;
  channelLogin: string;
  emotes?: TwitchEmote[];
  badges?: TwitchBadge[];
  bits?: number;
  isSubscriber?: boolean;
  isModerator?: boolean;
  isVip?: boolean;
}

type MessageHandler = (message: TwitchChatMessage) => void;

class TwitchChatService {
  private client: tmi.Client | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private joinedChannels: Set<string> = new Set();
  private channelIdMap: Map<string, string> = new Map(); // channelLogin -> channelId
  private connectionPromise: Promise<void> | null = null;
  private accessToken: string | null = null;
  private username: string | null = null;

  constructor() {
    console.log('[Twitch Chat Service] Initializing');
  }

  public setCredentials(accessToken: string, username: string): void {
    console.log(`[Twitch Chat Service] Setting credentials for user: ${username}`);

    // ユーザーが変更された場合のみクライアントをリセット
    const userChanged = this.username !== null && this.username !== username;

    this.accessToken = accessToken;
    this.username = username;

    // バッジサービスにアクセストークンを設定し、グローバルバッジを取得
    badgeService.setAccessToken(accessToken);
    badgeService.fetchGlobalBadges().catch((err) => {
      console.error('[Twitch Chat Service] Failed to fetch global badges:', err);
    });

    // ユーザーが変更された場合のみクライアントをリセット
    if (userChanged && this.client) {
      console.log('[Twitch Chat Service] Resetting client due to user change');
      this.client.disconnect().catch(() => {});
      this.client = null;
      this.connectionPromise = null;
      this.joinedChannels.clear();
      this.channelIdMap.clear();
    }
  }

  private async ensureClient(): Promise<void> {
    if (this.client && this.connectionPromise) {
      // 既に接続中または接続済み
      return this.connectionPromise;
    }

    if (!this.client) {
      console.log('[Twitch Chat Service] Creating TMI client');

      const clientOptions: tmi.Options = {
        options: { debug: true },
        connection: {
          reconnect: true,
          secure: true
        },
        channels: []
      };

      // 認証情報があれば設定
      if (this.accessToken && this.username) {
        clientOptions.identity = {
          username: this.username,
          password: `oauth:${this.accessToken}`
        };
        console.log(`[Twitch Chat Service] Client configured with authentication for user: ${this.username}`);
      } else {
        console.log('[Twitch Chat Service] Client configured without authentication (read-only)');
      }

      this.client = new tmi.Client(clientOptions);

      this.client.on('message', (channel, tags, message, self) => {
        const channelLogin = channel.replace('#', '');

        console.log(`[Twitch Chat] Message from ${tags.username} in ${channelLogin}: ${message}${self ? ' (self)' : ''}`);

        // エモート情報をパース
        const emotes: TwitchEmote[] = [];
        if (tags.emotes) {
          console.log('[Twitch Chat] Raw emotes:', tags.emotes);
          Object.entries(tags.emotes).forEach(([emoteId, positions]) => {
            const parsedPositions = positions.map((pos) => {
              const [start, end] = pos.split('-').map(Number);
              return { start, end };
            });
            emotes.push({ id: emoteId, positions: parsedPositions });
            console.log('[Twitch Chat] Parsed emote:', { id: emoteId, positions: parsedPositions });
          });
        }

        // バッジ情報をパース
        const badges: TwitchBadge[] = [];
        const channelId = this.channelIdMap.get(channelLogin);
        console.log('[Twitch Chat] Raw badges:', tags.badges, 'channelId:', channelId);
        if (tags.badges) {
          Object.entries(tags.badges).forEach(([setId, version]) => {
            const imageUrl = badgeService.getBadgeUrl(setId, version || '1', channelId);
            console.log(`[Twitch Chat] Badge lookup: ${setId}/${version} -> ${imageUrl || 'NOT FOUND'}`);
            badges.push({
              setId,
              version: version || '1',
              imageUrl: imageUrl || undefined
            });
          });
          console.log('[Twitch Chat] Parsed badges:', badges);
        }

        // Bits情報を抽出
        const bits = tags.bits ? parseInt(tags.bits, 10) : undefined;

        // 特別なロール情報
        const isSubscriber = tags.subscriber || false;
        const isModerator = tags.mod || false;
        const isVip = tags.badges?.vip !== undefined;

        const chatMessage: TwitchChatMessage = {
          id: tags.id || `${Date.now()}-${Math.random()}`,
          platform: 'twitch',
          author: tags['display-name'] || tags.username || 'Anonymous',
          message: message,
          timestamp: new Date().toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          avatarColor: tags.color || this.getRandomColor(),
          channelLogin: channelLogin,
          emotes: emotes.length > 0 ? emotes : undefined,
          badges: badges.length > 0 ? badges : undefined,
          bits,
          isSubscriber,
          isModerator,
          isVip
        };

        // すべてのハンドラーに通知
        this.messageHandlers.forEach((handler) => handler(chatMessage));
      });

      this.client.on('connected', () => {
        console.log('[Twitch Chat Service] Connected to Twitch IRC');
      });

      this.client.on('disconnected', (reason) => {
        console.log('[Twitch Chat Service] Disconnected:', reason);
        this.connectionPromise = null;
      });

      // 接続が完了するまで待機
      this.connectionPromise = this.client.connect().catch((error) => {
        console.error('[Twitch Chat Service] Connection failed:', error);
        this.connectionPromise = null;
        throw error;
      });
    }

    return this.connectionPromise!;
  }

  public async joinChannel(channelLogin: string, channelId?: string): Promise<void> {
    if (this.joinedChannels.has(channelLogin)) {
      console.log(`[Twitch Chat Service] Already joined channel: ${channelLogin}`);
      return;
    }

    await this.ensureClient();

    if (!this.client) {
      throw new Error('Failed to create TMI client');
    }

    console.log(`[Twitch Chat Service] Joining channel: ${channelLogin}`);

    try {
      await this.client.join(channelLogin);
      this.joinedChannels.add(channelLogin);

      // チャンネルIDがあればマッピングを保存し、チャンネルバッジを取得
      if (channelId) {
        this.channelIdMap.set(channelLogin, channelId);
        badgeService.fetchChannelBadges(channelId).catch((err) => {
          console.error(`[Twitch Chat Service] Failed to fetch channel badges for ${channelLogin}:`, err);
        });
      }

      console.log(`[Twitch Chat Service] Successfully joined: ${channelLogin}`);
    } catch (error) {
      console.error(`[Twitch Chat Service] Failed to join ${channelLogin}:`, error);
      throw error;
    }
  }

  public async leaveChannel(channelLogin: string): Promise<void> {
    if (!this.joinedChannels.has(channelLogin)) {
      console.log(`[Twitch Chat Service] Not in channel: ${channelLogin}`);
      return;
    }

    if (!this.client) {
      console.log('[Twitch Chat Service] No client to leave channel');
      return;
    }

    console.log(`[Twitch Chat Service] Leaving channel: ${channelLogin}`);

    try {
      await this.client.part(channelLogin);
      this.joinedChannels.delete(channelLogin);
      console.log(`[Twitch Chat Service] Successfully left: ${channelLogin}`);
    } catch (error) {
      console.error(`[Twitch Chat Service] Failed to leave ${channelLogin}:`, error);
    }
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    console.log(`[Twitch Chat Service] Message handler added. Total handlers: ${this.messageHandlers.size}`);

    // クリーンアップ関数を返す
    return () => {
      this.messageHandlers.delete(handler);
      console.log(`[Twitch Chat Service] Message handler removed. Total handlers: ${this.messageHandlers.size}`);
    };
  }

  public getJoinedChannels(): string[] {
    return Array.from(this.joinedChannels);
  }

  private getRandomColor(): string {
    const colors = [
      '#38bdf8', '#a855f7', '#f97316', '#facc15',
      '#22d3ee', '#ec4899', '#10b981', '#f59e0b'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  public async sendMessage(channelLogin: string, message: string): Promise<void> {
    await this.ensureClient();

    if (!this.client) {
      throw new Error('Failed to create TMI client');
    }

    // チャンネルに参加していない場合は参加する
    if (!this.joinedChannels.has(channelLogin)) {
      await this.joinChannel(channelLogin);
    }

    console.log(`[Twitch Chat Service] Sending message to ${channelLogin}: ${message}`);

    try {
      await this.client.say(channelLogin, message);
      console.log(`[Twitch Chat Service] Message sent successfully to ${channelLogin}`);
    } catch (error) {
      console.error(`[Twitch Chat Service] Failed to send message to ${channelLogin}:`, error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.client) return;

    console.log('[Twitch Chat Service] Disconnecting...');
    await this.client.disconnect();
    this.client = null;
    this.joinedChannels.clear();
    this.messageHandlers.clear();
  }
}

export const twitchChatService = new TwitchChatService();
