import express from 'express';
import session from 'express-session';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { env } from './config/env';
import { authRouter } from './routes/auth';
import { youtubeRouter } from './routes/youtube';
import { twitchRouter } from './routes/twitch';
import { twitchChatService } from './services/twitchChatService';
import { streamSyncService } from './services/streamSyncService';

const app = express();

app.use(express.json());
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);

app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api/twitch', twitchRouter);

// HTTPサーバーを作成
const server = createServer(app);

// WebSocketサーバーを作成
const wss = new WebSocketServer({ server, path: '/chat' });

console.log('[WebSocket] WebSocket server initialized on path /chat');

// クライアントごとの購読チャンネル管理
interface ClientData {
  channels: Set<string>;
  channelMapping: Record<string, string>;
  cleanup?: () => void;
}

const clients = new Map<WebSocket, ClientData>();

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');

  const clientData: ClientData = {
    channels: new Set(),
    channelMapping: {}
  };
  clients.set(ws, clientData);

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
        // チャンネル購読
        const { channels, channelMapping } = payload;
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
              await twitchChatService.joinChannel(newChannel);
              console.log(`[WebSocket] Subscribed to channel: ${newChannel}`);
            }
          }

          clientData.channels = newChannels;
          console.log('[WebSocket] Client channels updated:', Array.from(clientData.channels));
        }
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

    clients.delete(ws);
    console.log(`[WebSocket] Total clients: ${clients.size}`);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Client error:', error);
  });
});

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${env.port}`);

  // バックグラウンド同期サービスを開始
  streamSyncService.start();
});
