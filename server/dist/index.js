"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const ws_1 = require("ws");
const env_1 = require("./config/env");
const auth_1 = require("./routes/auth");
const youtube_1 = require("./routes/youtube");
const twitch_1 = require("./routes/twitch");
const streams_1 = require("./routes/streams");
const twitchChatService_1 = require("./services/twitchChatService");
const streamSyncService_1 = require("./services/streamSyncService");
const twitchEventSubManager_1 = require("./services/twitchEventSubManager");
const twitchEventSubWebhookService_1 = require("./services/twitchEventSubWebhookService");
const priorityManager_1 = require("./services/priorityManager");
const security_1 = require("./middleware/security");
const websocketSecurity_1 = require("./middleware/websocketSecurity");
const app = (0, express_1.default)();
// CORS設定（モバイル対応）
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173',
        'http://192.168.11.18:5173',
        'http://127.0.0.1:5173'
    ],
    credentials: true
}));
// セキュリティミドルウェア
app.use(security_1.securityHeaders); // セキュリティヘッダー
app.use(security_1.checkBlockedIP); // IPブロックチェック
app.use(security_1.validateRequestSize); // リクエストサイズ検証
app.use(express_1.default.json({ limit: '10kb' })); // JSONパーサー（サイズ制限付き）;
// セッションミドルウェア（WebSocketでも使用するためexport）
const sessionMiddleware = (0, express_session_1.default)({
    secret: env_1.env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // ngrok使用時はfalseに設定
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
});
app.use(sessionMiddleware);
app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// 認証ルーター（厳しいレート制限）
app.use('/auth', security_1.authRateLimiter, auth_1.authRouter);
// YouTube機能が有効な場合のみルーターを登録
if (env_1.env.enableYoutube) {
    app.use('/api/youtube', security_1.apiRateLimiter, youtube_1.youtubeRouter);
    console.log('[server] YouTube API enabled');
}
else {
    console.log('[server] YouTube API disabled');
}
// APIルーター（レート制限付き）
app.use('/api/twitch', security_1.apiRateLimiter, twitch_1.twitchRouter);
app.use('/api/streams', security_1.apiRateLimiter, streams_1.streamsRouter);
// HTTPサーバーを作成
const server = (0, http_1.createServer)(app);
// WebSocketサーバーを作成
const wss = new ws_1.WebSocketServer({ server, path: '/chat' });
console.log('[WebSocket] WebSocket server initialized on path /chat');
const clients = new Map();
// EventSubイベントハンドラー（全クライアントに通知）
// 旧: 単一接続版（後方互換性のため保持）
// twitchEventSubService.onStreamEvent((event) => {
//   console.log('[EventSub] Stream event received:', event);
//   const payload = JSON.stringify({
//     type: 'eventsub_stream_event',
//     event
//   });
//   clients.forEach((_, ws) => {
//     if (ws.readyState === WebSocket.OPEN) {
//       ws.send(payload);
//     }
//   });
// });
// 新: 3本接続版（EventSubManager使用）
twitchEventSubManager_1.twitchEventSubManager.onStreamEvent((event) => {
    console.log('[EventSub Manager] Stream event received:', event);
    // 全クライアントに通知
    const payload = JSON.stringify({
        type: 'eventsub_stream_event',
        event
    });
    clients.forEach((_, ws) => {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(payload);
        }
    });
});
// StreamSyncServiceのイベントハンドラー（配信リスト更新を全クライアントに通知）
streamSyncService_1.streamSyncService.onStreamUpdate((event) => {
    console.log('[StreamSync] Stream update event:', {
        platform: event.platform,
        streamCount: event.streams.length,
        added: event.changes.added.length,
        removed: event.changes.removed.length
    });
    // 全クライアントに配信リスト更新を通知
    const payload = JSON.stringify({
        type: 'stream_list_updated',
        platform: event.platform,
        streams: event.streams,
        changes: event.changes
    });
    clients.forEach((_, ws) => {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(payload);
            console.log(`[StreamSync] Sent update to client (${event.platform})`);
        }
    });
});
// PriorityManagerのイベントハンドラー（優先度変更を全クライアントに通知）
priorityManager_1.priorityManager.onChange((event) => {
    console.log('[PriorityManager] Priority change event:', {
        toRealtime: event.changes.toRealtime.length,
        toDelayed: event.changes.toDelayed.length,
        timestamp: event.timestamp
    });
    // 優先度変更の詳細をログ出力
    if (event.changes.toRealtime.length > 0) {
        console.log('[PriorityManager] Channels upgraded to REALTIME:', event.changes.toRealtime);
    }
    if (event.changes.toDelayed.length > 0) {
        console.log('[PriorityManager] Channels downgraded to DELAYED:', event.changes.toDelayed);
    }
    // 全クライアントに優先度変更を通知
    const payload = JSON.stringify({
        type: 'priority_changed',
        changes: event.changes,
        timestamp: event.timestamp
    });
    clients.forEach((_, ws) => {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(payload);
        }
    });
});
// Webhookサービスのイベントハンドラー（Webhook経由のイベントも全クライアントに通知）
twitchEventSubWebhookService_1.twitchEventSubWebhookService.onStreamEvent((event) => {
    console.log('[EventSub Webhook] Stream event received:', event);
    // 全クライアントに通知（EventSubManagerと同じ形式）
    const payload = JSON.stringify({
        type: 'eventsub_stream_event',
        event
    });
    clients.forEach((_, ws) => {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(payload);
        }
    });
});
wss.on('connection', (ws, request) => {
    const clientIP = request.socket.remoteAddress || 'unknown';
    console.log(`[WebSocket] Client attempting connection from ${clientIP}`);
    // セキュリティチェック：接続数制限
    const canConnect = websocketSecurity_1.wsConnectionManager.canConnect(clientIP);
    if (!canConnect.allowed) {
        console.warn(`[WebSocket Security] Connection rejected: ${clientIP} - ${canConnect.reason}`);
        ws.close(1008, canConnect.reason);
        return;
    }
    // 接続を記録
    websocketSecurity_1.wsConnectionManager.registerConnection(clientIP);
    console.log('[WebSocket] Client connected');
    // ハートビートを開始
    websocketSecurity_1.wsHeartbeat.start(ws);
    // セッション情報を取得するためにミドルウェアを手動で適用
    const mockResponse = {
        getHeader: () => { },
        setHeader: () => { },
        end: () => { }
    };
    sessionMiddleware(request, mockResponse, () => {
        const req = request;
        const session = req.session;
        const sessionId = req.sessionID || 'default';
        const clientData = {
            userId: sessionId, // セッションIDを使用
            channels: new Set(),
            channelMapping: {},
            youtubeChannels: [],
            twitchChannels: [],
            youtubeAccessToken: session?.streamSyncTokens?.youtube,
            twitchAccessToken: session?.streamSyncTokens?.twitch
        };
        clients.set(ws, clientData);
        console.log(`[WebSocket] Client connected with session ID: ${clientData.userId}`);
        console.log(`[WebSocket] Session tokens - YouTube: ${!!clientData.youtubeAccessToken}, Twitch: ${!!clientData.twitchAccessToken}`);
        // Twitchチャットメッセージハンドラー
        const messageHandler = (message) => {
            console.log('[WebSocket] Message received from Twitch:', {
                channelLogin: message.channelLogin,
                subscribedChannels: Array.from(clientData.channels),
                hasChannel: clientData.channels.has(message.channelLogin)
            });
            // このクライアントが購読しているチャンネルのメッセージのみ送信
            if (clientData.channels.has(message.channelLogin)) {
                // channelLoginをdisplayNameに変換
                const displayName = clientData.channelMapping[message.channelLogin] || message.channelLogin;
                const payload = JSON.stringify({
                    ...message,
                    channelName: displayName
                });
                console.log('[WebSocket] Sending message to client:', payload);
                ws.send(payload);
            }
            else {
                console.log('[WebSocket] Message filtered out - channel not subscribed');
            }
        };
        // メッセージハンドラーを登録
        clientData.cleanup = twitchChatService_1.twitchChatService.onMessage(messageHandler);
        ws.on('message', async (data) => {
            try {
                // レート制限チェック
                const canSend = websocketSecurity_1.wsConnectionManager.canSendMessage(clientIP);
                if (!canSend.allowed) {
                    console.warn(`[WebSocket Security] Message rate limit exceeded: ${clientIP}`);
                    ws.send(JSON.stringify({ type: 'error', error: canSend.reason }));
                    return;
                }
                const payload = JSON.parse(data.toString());
                console.log('[WebSocket] Received message:', payload);
                // メッセージ検証
                const validation = (0, websocketSecurity_1.validateWebSocketMessage)(payload);
                if (!validation.valid) {
                    console.warn(`[WebSocket Security] Invalid message from ${clientIP}: ${validation.reason}`);
                    ws.send(JSON.stringify({ type: 'error', error: validation.reason }));
                    return;
                }
                if (payload.type === 'subscribe') {
                    // Twitchチャットチャンネル購読
                    const { channels, channelMapping, channelIdMapping } = payload;
                    if (Array.isArray(channels)) {
                        // 新しいチャンネルセット
                        const newChannels = new Set(channels);
                        // チャンネルマッピングを更新
                        if (channelMapping && typeof channelMapping === 'object') {
                            clientData.channelMapping = channelMapping;
                            console.log('[WebSocket] Channel mapping updated:', channelMapping);
                        }
                        // 削除されたチャンネルから退出
                        for (const oldChannel of clientData.channels) {
                            if (!newChannels.has(oldChannel)) {
                                await twitchChatService_1.twitchChatService.leaveChannel(oldChannel);
                                console.log(`[WebSocket] Unsubscribed from channel: ${oldChannel}`);
                            }
                        }
                        // 新しいチャンネルに参加
                        for (const newChannel of newChannels) {
                            if (!clientData.channels.has(newChannel)) {
                                // channelIdMappingからchannelIdを取得
                                const channelId = channelIdMapping?.[newChannel];
                                await twitchChatService_1.twitchChatService.joinChannel(newChannel, channelId);
                                console.log(`[WebSocket] Subscribed to channel: ${newChannel} (ID: ${channelId || 'unknown'})`);
                            }
                        }
                        clientData.channels = newChannels;
                        console.log('[WebSocket] Client channels updated:', Array.from(clientData.channels));
                    }
                }
                else if (payload.type === 'subscribe_streams') {
                    // 配信リスト同期のためのフォローチャンネル登録
                    const { youtubeChannels, twitchChannels, sessionId } = payload;
                    if (Array.isArray(youtubeChannels)) {
                        clientData.youtubeChannels = youtubeChannels;
                    }
                    if (Array.isArray(twitchChannels)) {
                        clientData.twitchChannels = twitchChannels;
                    }
                    // TokenStorageからトークンを取得
                    const tokens = sessionId ? streamSyncService_1.tokenStorage.getTokens(sessionId) : {};
                    clientData.youtubeAccessToken = tokens.youtube;
                    clientData.twitchAccessToken = tokens.twitch;
                    console.log(`[WebSocket] Retrieved tokens for session: ${sessionId || 'none'}`);
                    console.log(`[WebSocket] Tokens available - YouTube: ${!!clientData.youtubeAccessToken}, Twitch: ${!!clientData.twitchAccessToken}`);
                    // StreamSyncServiceにユーザーを登録（トークンも含める）
                    streamSyncService_1.streamSyncService.registerUser(clientData.userId, {
                        youtube: clientData.youtubeChannels,
                        twitch: clientData.twitchChannels
                    }, {
                        youtube: clientData.youtubeAccessToken,
                        twitch: clientData.twitchAccessToken
                    });
                    console.log(`[WebSocket] Registered user ${clientData.userId} with YouTube: ${youtubeChannels?.length || 0}, Twitch: ${twitchChannels?.length || 0}`);
                    // 初回登録時にStreamSyncServiceを起動（まだ起動していない場合）
                    const stats = streamSyncService_1.streamSyncService.getStats();
                    if (!stats.isRunning && (youtubeChannels?.length > 0 || twitchChannels?.length > 0)) {
                        console.log('[WebSocket] Starting StreamSyncService...');
                        streamSyncService_1.streamSyncService.start();
                    }
                    // 即座に同期を実行
                    streamSyncService_1.streamSyncService.manualSync().catch(err => {
                        console.error('[WebSocket] Manual sync failed:', err);
                    });
                }
            }
            catch (error) {
                console.error('[WebSocket] Error handling message:', error);
            }
        });
        ws.on('close', async () => {
            console.log(`[WebSocket] Client disconnected: ${clientIP}`);
            // ハートビートを停止
            websocketSecurity_1.wsHeartbeat.stop(ws);
            // 接続を解除
            websocketSecurity_1.wsConnectionManager.unregisterConnection(clientIP);
            // クリーンアップ
            if (clientData.cleanup) {
                clientData.cleanup();
            }
            // 購読していたチャンネルから退出
            for (const channel of clientData.channels) {
                // 他のクライアントが購読していない場合のみ退出
                let otherClientSubscribed = false;
                for (const [otherWs, otherData] of clients) {
                    if (otherWs !== ws && otherData.channels.has(channel)) {
                        otherClientSubscribed = true;
                        break;
                    }
                }
                if (!otherClientSubscribed) {
                    await twitchChatService_1.twitchChatService.leaveChannel(channel);
                    console.log(`[WebSocket] Left channel ${channel} (no other clients subscribed)`);
                }
            }
            // StreamSyncServiceからユーザーを削除
            streamSyncService_1.streamSyncService.unregisterUser(clientData.userId);
            console.log(`[WebSocket] Unregistered user ${clientData.userId} from StreamSyncService`);
            clients.delete(ws);
            console.log(`[WebSocket] Total clients: ${clients.size}`);
        });
        ws.on('error', (error) => {
            console.error('[WebSocket] Client error:', error);
        });
    }); // sessionMiddlewareコールバックの終了
});
server.listen(env_1.env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://localhost:${env_1.env.port}`);
    console.log('[server] StreamSyncService will start automatically when clients connect');
});
//# sourceMappingURL=index.js.map