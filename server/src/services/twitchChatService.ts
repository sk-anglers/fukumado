import tmi from 'tmi.js';

export interface TwitchChatMessage {
  id: string;
  platform: 'twitch';
  author: string;
  message: string;
  timestamp: string;
  avatarColor: string;
  channelLogin: string;
}

type MessageHandler = (message: TwitchChatMessage) => void;

class TwitchChatService {
  private client: tmi.Client | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private joinedChannels: Set<string> = new Set();
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    console.log('[Twitch Chat Service] Initializing');
  }

  private async ensureClient(): Promise<void> {
    if (this.client && this.connectionPromise) {
      // 既に接続中または接続済み
      return this.connectionPromise;
    }

    if (!this.client) {
      console.log('[Twitch Chat Service] Creating TMI client');
      this.client = new tmi.Client({
        options: { debug: true },
        connection: {
          reconnect: true,
          secure: true
        },
        channels: []
      });

      this.client.on('message', (channel, tags, message, self) => {
        if (self) return; // 自分のメッセージは無視

        const channelLogin = channel.replace('#', '');

        console.log(`[Twitch Chat] Message from ${tags.username} in ${channelLogin}: ${message}`);

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
          channelLogin: channelLogin
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

  public async joinChannel(channelLogin: string): Promise<void> {
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
