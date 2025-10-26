import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { env } from './config/env';
import { authRouter } from './routes/auth';
import { youtubeRouter } from './routes/youtube';
import { twitchRouter } from './routes/twitch';
import { streamsRouter } from './routes/streams';
import { twitchChatService } from './services/twitchChatService';
import { streamSyncService, tokenStorage } from './services/streamSyncService';
import { twitchEventSubService } from './services/twitchEventSubService';

const app = express();

// CORS設定（モバイル対応）
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://192.168.11.18:5173',
      'http://127.0.0.1:5173'
    ],
    credentials: true
  })
);

app.use(express.json());

// セッションミドルウェア（WebSocketでも使用するためexport）
const sessionMiddleware = session({
  secret: env.sessionSecret,
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

app.use('/auth', authRouter);

// YouTube機能が有効な場合のみルーターを登録
if (env.enableYoutube) {
  app.use('/api/youtube', youtubeRouter);
  console.log('[server] YouTube API enabled');
} else {
  console.log('[server] YouTube API disabled');
}

app.use('/api/twitch', twitchRouter);
app.use('/api/streams', streamsRouter);

// HTTPサーバーを作成
const server = createServer(app);

// WebSocketサーバーを作成
const wss = new WebSocketServer({ server, path: '/chat' });

console.log('[WebSocket] WebSocket server initialized on path /chat');

// クライアントごとの購読チャンネル管理
interface ClientData {
  userId: string; // ユニークなクライアントID
  channels: Set<string>; // Twitchチャットチャンネル
  channelMapping: Record<string, string>;
  youtubeChannels: string[]; // YouTubeフォローチャンネル
  twitchChannels: string[]; // Twitchフォローチャンネル
  youtubeAccessToken?: string; // YouTubeアクセストークン
  twitchAccessToken?: string; // Twitchアクセストークン
  cleanup?: () => void;
}

const clients = new Map<WebSocket, ClientData>();

// EventSubイベントハンドラー（全クライアントに通知）
twitchEventSubService.onStreamEvent((event) => {
  console.log('[EventSub] Stream event received:', event);

  // 全クライアントに通知
  const payload = JSON.stringify({
    type: 'eventsub_stream_event',
    event
  });

  clients.forEach((_, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
});

// StreamSyncServiceのイベントハンドラー（配信リスト更新を全クライアントに通知）
streamSyncService.onStreamUpdate((event) => {
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
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      console.log(`[StreamSync] Sent update to client (${event.platform})`);
    }
  });
});

wss.on('connection', (ws, request) => {
  console.log('[WebSocket] Client connected');

  // セッション情報を取得するためにミドルウェアを手動で適用
  const mockResponse = {
    getHeader: () => {},
    setHeader: () => {},
    end: () => {}
  } as any;

  sessionMiddleware(request as any, mockResponse, () => {
    const req = request as any;
    const session = req.session;
    const sessionId = req.sessionID || 'default';

    const clientData: ClientData = {
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
  const messageHandler = (message: any) => {
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
    } else {
      console.log('[WebSocket] Message filtered out - channel not subscribed');
    }
  };

  // メッセージハンドラーを登録
  clientData.cleanup = twitchChatService.onMessage(messageHandler);

  ws.on('message', async (data) => {
    try {
      const payload = JSON.parse(data.toString());
      console.log('[WebSocket] Received message:', payload);

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
              await twitchChatService.leaveChannel(oldChannel);
              console.log(`[WebSocket] Unsubscribed from channel: ${oldChannel}`);
            }
          }

          // 新しいチャンネルに参加
          for (const newChannel of newChannels) {
            if (!clientData.channels.has(newChannel)) {
              // channelIdMappingからchannelIdを取得
              const channelId = channelIdMapping?.[newChannel];
              await twitchChatService.joinChannel(newChannel, channelId);
              console.log(`[WebSocket] Subscribed to channel: ${newChannel} (ID: ${channelId || 'unknown'})`);
            }
          }

          clientData.channels = newChannels;
          console.log('[WebSocket] Client channels updated:', Array.from(clientData.channels));
        }
      } else if (payload.type === 'subscribe_streams') {
        // 配信リスト同期のためのフォローチャンネル登録
        const { youtubeChannels, twitchChannels, sessionId } = payload;

        if (Array.isArray(youtubeChannels)) {
          clientData.youtubeChannels = youtubeChannels;
        }
        if (Array.isArray(twitchChannels)) {
          clientData.twitchChannels = twitchChannels;
        }

        // TokenStorageからトークンを取得
        const tokens = sessionId ? tokenStorage.getTokens(sessionId) : {};
        clientData.youtubeAccessToken = tokens.youtube;
        clientData.twitchAccessToken = tokens.twitch;

        console.log(`[WebSocket] Retrieved tokens for session: ${sessionId || 'none'}`);
        console.log(`[WebSocket] Tokens available - YouTube: ${!!clientData.youtubeAccessToken}, Twitch: ${!!clientData.twitchAccessToken}`);

        // StreamSyncServiceにユーザーを登録（トークンも含める）
        streamSyncService.registerUser(
          clientData.userId,
          {
            youtube: clientData.youtubeChannels,
            twitch: clientData.twitchChannels
          },
          {
            youtube: clientData.youtubeAccessToken,
            twitch: clientData.twitchAccessToken
          }
        );

        console.log(`[WebSocket] Registered user ${clientData.userId} with YouTube: ${youtubeChannels?.length || 0}, Twitch: ${twitchChannels?.length || 0}`);

        // 初回登録時にStreamSyncServiceを起動（まだ起動していない場合）
        const stats = streamSyncService.getStats();
        if (!stats.isRunning && (youtubeChannels?.length > 0 || twitchChannels?.length > 0)) {
          console.log('[WebSocket] Starting StreamSyncService...');
          streamSyncService.start();
        }

        // 即座に同期を実行
        streamSyncService.manualSync().catch(err => {
          console.error('[WebSocket] Manual sync failed:', err);
        });
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
    }
  });

  ws.on('close', async () => {
    console.log('[WebSocket] Client disconnected');

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
        await twitchChatService.leaveChannel(channel);
        console.log(`[WebSocket] Left channel ${channel} (no other clients subscribed)`);
      }
    }

    // StreamSyncServiceからユーザーを削除
    streamSyncService.unregisterUser(clientData.userId);
    console.log(`[WebSocket] Unregistered user ${clientData.userId} from StreamSyncService`);

    clients.delete(ws);
    console.log(`[WebSocket] Total clients: ${clients.size}`);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Client error:', error);
  });
  }); // sessionMiddlewareコールバックの終了
});

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${env.port}`);
  console.log('[server] StreamSyncService will start automatically when clients connect');
});
