"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twitchChatService = void 0;
const tmi_js_1 = __importDefault(require("tmi.js"));
const badgeService_1 = require("./badgeService");
class TwitchChatService {
    constructor() {
        this.client = null;
        this.messageHandlers = new Set();
        this.joinedChannels = new Set();
        this.channelIdMap = new Map(); // channelLogin -> channelId
        this.connectionPromise = null;
        this.accessToken = null;
        this.username = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.lastConnectedAt = null;
        this.isManualDisconnect = false;
        this.healthCheckInterval = null;
        this.lastMessageReceivedAt = null;
        this.sentMessagesCache = new Map(); // channelLogin -> SentMessageCache
        console.log('[Twitch Chat Service] Initializing');
        this.startHealthCheck();
    }
    setCredentials(accessToken, username) {
        console.log(`[Twitch Chat Service] Setting credentials for user: ${username}`);
        // 認証情報が変更された場合、クライアントをリセット
        const credentialsChanged = this.accessToken !== accessToken ||
            this.username !== username;
        this.accessToken = accessToken;
        this.username = username;
        // バッジサービスにアクセストークンを設定し、グローバルバッジを取得
        badgeService_1.badgeService.setAccessToken(accessToken);
        badgeService_1.badgeService.fetchGlobalBadges().catch((err) => {
            console.error('[Twitch Chat Service] Failed to fetch global badges:', err);
        });
        // 認証情報が変更された場合、クライアントをリセット
        if (credentialsChanged && this.client) {
            console.log('[Twitch Chat Service] Resetting client due to credentials change');
            this.client.disconnect().catch(() => { });
            this.client = null;
            this.connectionPromise = null;
            this.joinedChannels.clear();
            this.channelIdMap.clear();
        }
    }
    async ensureClient() {
        if (this.client && this.connectionPromise) {
            // 既に接続中または接続済み
            return this.connectionPromise;
        }
        if (!this.client) {
            console.log('[Twitch Chat Service] Creating TMI client');
            const clientOptions = {
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
            }
            else {
                console.log('[Twitch Chat Service] Client configured without authentication (read-only)');
            }
            this.client = new tmi_js_1.default.Client(clientOptions);
            this.client.on('message', (channel, tags, message, self) => {
                try {
                    // メッセージ受信時刻を記録
                    this.lastMessageReceivedAt = new Date();
                    const channelLogin = channel.replace('#', '');
                    // 自分が送信したメッセージの場合、バッジ情報をキャッシュに保存してからスキップ
                    if (self) {
                        console.log('[Twitch Chat Service] Own message detected, caching badges:', message);
                        // バッジ情報をパース
                        const selfBadges = [];
                        const channelId = this.channelIdMap.get(channelLogin);
                        if (tags.badges) {
                            Object.entries(tags.badges).forEach(([setId, version]) => {
                                const imageUrl = badgeService_1.badgeService.getBadgeUrl(setId, version || '1', channelId);
                                selfBadges.push({
                                    setId,
                                    version: version || '1',
                                    imageUrl: imageUrl || undefined
                                });
                            });
                        }
                        // キャッシュに保存（既存のキャッシュを上書き）
                        const cached = this.sentMessagesCache.get(channelLogin);
                        if (cached && cached.message === message) {
                            cached.badges = selfBadges;
                            console.log('[Twitch Chat Service] Updated cache with badges:', selfBadges);
                        }
                        return; // 自分のメッセージはフロントに送信しない
                    }
                    // エモート情報をパース
                    let emotes = [];
                    if (tags.emotes) {
                        Object.entries(tags.emotes).forEach(([emoteId, positions]) => {
                            const parsedPositions = positions.map((pos) => {
                                const [start, end] = pos.split('-').map(Number);
                                return { start, end };
                            });
                            emotes.push({ id: emoteId, positions: parsedPositions });
                        });
                        console.log(`[Twitch Chat Service] Emotes from tags for ${channelLogin}:`, emotes.length);
                    }
                    else {
                        // エモート情報がない場合、キャッシュから取得（自分が送信したメッセージ）
                        console.log(`[Twitch Chat Service] No emotes in tags for ${channelLogin}, checking cache...`);
                        console.log(`[Twitch Chat Service]   - Message: "${message}"`);
                        const cached = this.sentMessagesCache.get(channelLogin);
                        console.log(`[Twitch Chat Service]   - Cache exists: ${!!cached}`);
                        if (cached) {
                            console.log(`[Twitch Chat Service]   - Cached message: "${cached.message}"`);
                            console.log(`[Twitch Chat Service]   - Message match: ${cached.message === message}`);
                            console.log(`[Twitch Chat Service]   - Cached emotes count: ${cached.emotes.length}`);
                        }
                        if (cached && cached.message === message) {
                            emotes = cached.emotes;
                            console.log('[Twitch Chat Service] ✓ Retrieved emotes from cache for sent message:', emotes);
                            // キャッシュから削除
                            this.sentMessagesCache.delete(channelLogin);
                        }
                        else {
                            console.log('[Twitch Chat Service] ✗ Cache miss or message mismatch');
                        }
                    }
                    // バッジ情報をパース
                    const badges = [];
                    const channelId = this.channelIdMap.get(channelLogin);
                    if (tags.badges) {
                        Object.entries(tags.badges).forEach(([setId, version]) => {
                            const imageUrl = badgeService_1.badgeService.getBadgeUrl(setId, version || '1', channelId);
                            badges.push({
                                setId,
                                version: version || '1',
                                imageUrl: imageUrl || undefined
                            });
                        });
                    }
                    // Bits情報を抽出
                    const bits = tags.bits ? parseInt(tags.bits, 10) : undefined;
                    // 特別なロール情報
                    const isSubscriber = tags.subscriber || false;
                    const isModerator = tags.mod || false;
                    const isVip = tags.badges?.vip !== undefined;
                    const chatMessage = {
                        id: tags.id || `${Date.now()}-${Math.random()}`,
                        platform: 'twitch',
                        author: tags['display-name'] || tags.username || 'Anonymous',
                        message: message,
                        timestamp: new Date().toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Tokyo'
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
                    this.messageHandlers.forEach((handler) => {
                        try {
                            handler(chatMessage);
                        }
                        catch (error) {
                            console.error('[Twitch Chat Service] Error in message handler:', error);
                        }
                    });
                }
                catch (error) {
                    console.error('[Twitch Chat Service] Error processing message:', error);
                }
            });
            this.client.on('connected', () => {
                console.log('[Twitch Chat Service] Connected to Twitch IRC');
                this.reconnectAttempts = 0; // 接続成功したらカウンターをリセット
                this.lastConnectedAt = new Date();
                console.log(`[Twitch Chat Service] Connection established at ${this.lastConnectedAt.toISOString()}`);
            });
            this.client.on('disconnected', (reason) => {
                console.log('[Twitch Chat Service] Disconnected:', reason);
                this.connectionPromise = null;
                // 手動切断の場合は再接続しない
                if (this.isManualDisconnect) {
                    console.log('[Twitch Chat Service] Manual disconnect - not reconnecting');
                    return;
                }
                // 再接続を試行
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect();
                }
                else {
                    console.error('[Twitch Chat Service] Max reconnect attempts reached. Giving up.');
                }
            });
            // エラーイベントハンドラー（TMI.jsの型定義に含まれていないため、型アサーションを使用）
            this.client.on('error', (error) => {
                console.error('[Twitch Chat Service] IRC Error:', error);
                // 認証エラーの場合は再接続を試みない
                if (error?.message && error.message.includes('Login authentication failed')) {
                    console.error('[Twitch Chat Service] Authentication failed - token may be invalid');
                    this.connectionPromise = null;
                    return;
                }
                // その他のエラーの場合は再接続を試みる
                if (!this.isManualDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    console.log('[Twitch Chat Service] Error detected, will attempt reconnection');
                }
            });
            // notice イベント（Twitchからの通知）
            this.client.on('notice', (channel, msgid, message) => {
                console.log(`[Twitch Chat Service] Notice in ${channel}: [${msgid}] ${message}`);
                // msg_channel_suspended などの重要な通知をログ
                if (msgid === 'msg_channel_suspended' || msgid === 'msg_banned') {
                    console.error(`[Twitch Chat Service] Channel issue: ${msgid} - ${message}`);
                }
            });
            // reconnect イベント
            this.client.on('reconnect', () => {
                console.log('[Twitch Chat Service] TMI.js is attempting to reconnect...');
            });
            // connecting イベント
            this.client.on('connecting', (address, port) => {
                console.log(`[Twitch Chat Service] Connecting to ${address}:${port}...`);
            });
            // logon イベント
            this.client.on('logon', () => {
                console.log('[Twitch Chat Service] Logged on to Twitch IRC');
            });
            // 接続が完了するまで待機
            this.connectionPromise = this.client.connect()
                .then(() => { }) // void を返すように変換
                .catch((error) => {
                console.error('[Twitch Chat Service] Connection failed:', error);
                this.connectionPromise = null;
                throw error;
            });
        }
        return this.connectionPromise;
    }
    async joinChannel(channelLogin, channelId) {
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
                badgeService_1.badgeService.fetchChannelBadges(channelId).catch((err) => {
                    console.error(`[Twitch Chat Service] Failed to fetch channel badges for ${channelLogin}:`, err);
                });
            }
            console.log(`[Twitch Chat Service] Successfully joined: ${channelLogin}`);
        }
        catch (error) {
            console.error(`[Twitch Chat Service] Failed to join ${channelLogin}:`, error);
            throw error;
        }
    }
    async leaveChannel(channelLogin) {
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
        }
        catch (error) {
            console.error(`[Twitch Chat Service] Failed to leave ${channelLogin}:`, error);
        }
    }
    onMessage(handler) {
        this.messageHandlers.add(handler);
        console.log(`[Twitch Chat Service] Message handler added. Total handlers: ${this.messageHandlers.size}`);
        // クリーンアップ関数を返す
        return () => {
            this.messageHandlers.delete(handler);
            console.log(`[Twitch Chat Service] Message handler removed. Total handlers: ${this.messageHandlers.size}`);
        };
    }
    getJoinedChannels() {
        return Array.from(this.joinedChannels);
    }
    getRandomColor() {
        const colors = [
            '#38bdf8', '#a855f7', '#f97316', '#facc15',
            '#22d3ee', '#ec4899', '#10b981', '#f59e0b'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    /**
     * 送信したメッセージのエモート情報をキャッシュに保存
     * （自分が送信したメッセージをIRCから受信したときにバッジ情報を取得するため）
     */
    cacheEmotesForMessage(channelLogin, message, emotes) {
        this.sentMessagesCache.set(channelLogin, {
            message,
            emotes,
            badges: [], // 初期値は空配列（IRCから受信時に更新）
            timestamp: Date.now()
        });
        console.log(`[Twitch Chat Service] Cached emotes for message in ${channelLogin}:`);
        console.log(`[Twitch Chat Service]   - Message: "${message}"`);
        console.log(`[Twitch Chat Service]   - Emotes count: ${emotes.length}`);
        console.log(`[Twitch Chat Service]   - Emotes:`, JSON.stringify(emotes, null, 2));
        // 10秒後にキャッシュをクリア
        setTimeout(() => {
            const cached = this.sentMessagesCache.get(channelLogin);
            if (cached && cached.message === message && Date.now() - cached.timestamp >= 10000) {
                this.sentMessagesCache.delete(channelLogin);
                console.log(`[Twitch Chat Service] Cleared expired cache for ${channelLogin}`);
            }
        }, 10000);
    }
    /**
     * キャッシュからバッジ情報を取得
     */
    getCachedBadges(channelLogin, message) {
        const cached = this.sentMessagesCache.get(channelLogin);
        if (cached && cached.message === message) {
            return cached.badges;
        }
        return [];
    }
    async sendMessage(channelLogin, message) {
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
        }
        catch (error) {
            console.error(`[Twitch Chat Service] Failed to send message to ${channelLogin}:`, error);
            throw error;
        }
    }
    /**
     * 定期的な健全性チェックを開始
     */
    startHealthCheck() {
        // 既存のインターバルをクリア
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        // 1分ごとにチェック
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 60000);
        console.log('[Twitch Chat Service] Health check started (interval: 1 minute)');
    }
    /**
     * 健全性チェックを実行
     */
    performHealthCheck() {
        // クライアントが存在しない場合はスキップ
        if (!this.client) {
            return;
        }
        const now = new Date();
        // 接続状態をチェック
        const readyState = this.client.readyState();
        console.log(`[Twitch Chat Service] Health check - Ready state: ${readyState}, Channels: ${this.joinedChannels.size}`);
        // 接続されていない場合
        if (readyState !== 'OPEN') {
            console.warn(`[Twitch Chat Service] Health check failed - Connection not open (state: ${readyState})`);
            // 手動切断でない場合は再接続を試みる
            if (!this.isManualDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log('[Twitch Chat Service] Initiating reconnection from health check...');
                this.attemptReconnect();
            }
            return;
        }
        // 接続時刻からの経過時間をチェック（5分以上メッセージがない場合は警告）
        if (this.joinedChannels.size > 0 && this.lastMessageReceivedAt) {
            const timeSinceLastMessage = now.getTime() - this.lastMessageReceivedAt.getTime();
            const minutesSinceLastMessage = Math.floor(timeSinceLastMessage / 60000);
            if (minutesSinceLastMessage >= 5) {
                console.warn(`[Twitch Chat Service] No messages received for ${minutesSinceLastMessage} minutes (${this.joinedChannels.size} channels joined)`);
            }
        }
        // 接続時刻からの経過時間をログ
        if (this.lastConnectedAt) {
            const connectionDuration = now.getTime() - this.lastConnectedAt.getTime();
            const minutesConnected = Math.floor(connectionDuration / 60000);
            console.log(`[Twitch Chat Service] Health check - Connected for ${minutesConnected} minutes`);
        }
    }
    /**
     * 再接続を試行（指数バックオフ付き）
     */
    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // 最大30秒
        console.log(`[Twitch Chat Service] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(async () => {
            try {
                console.log(`[Twitch Chat Service] Reconnection attempt ${this.reconnectAttempts} starting...`);
                // 既存のクライアントを破棄
                if (this.client) {
                    this.client.removeAllListeners();
                    this.client = null;
                }
                // 参加していたチャンネルのリストを保存
                const channelsToRejoin = Array.from(this.joinedChannels);
                const channelIdMapBackup = new Map(this.channelIdMap);
                // クライアントを再作成して接続
                await this.ensureClient();
                console.log(`[Twitch Chat Service] Reconnection successful. Rejoining ${channelsToRejoin.length} channels...`);
                // 以前参加していたチャンネルに再参加
                for (const channelLogin of channelsToRejoin) {
                    try {
                        const channelId = channelIdMapBackup.get(channelLogin);
                        await this.joinChannel(channelLogin, channelId);
                        console.log(`[Twitch Chat Service] Rejoined channel: ${channelLogin}`);
                    }
                    catch (error) {
                        console.error(`[Twitch Chat Service] Failed to rejoin ${channelLogin}:`, error);
                    }
                }
                console.log('[Twitch Chat Service] Reconnection process completed');
            }
            catch (error) {
                console.error(`[Twitch Chat Service] Reconnection attempt ${this.reconnectAttempts} failed:`, error);
                // 再接続に失敗した場合、さらに試行
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect();
                }
                else {
                    console.error('[Twitch Chat Service] Max reconnect attempts reached after failure');
                }
            }
        }, delay);
    }
    async disconnect() {
        if (!this.client)
            return;
        console.log('[Twitch Chat Service] Disconnecting...');
        this.isManualDisconnect = true; // 手動切断フラグを設定
        // ヘルスチェックを停止
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('[Twitch Chat Service] Health check stopped');
        }
        await this.client.disconnect();
        this.client = null;
        this.joinedChannels.clear();
        this.messageHandlers.clear();
        this.isManualDisconnect = false; // フラグをリセット
    }
}
exports.twitchChatService = new TwitchChatService();
//# sourceMappingURL=twitchChatService.js.map