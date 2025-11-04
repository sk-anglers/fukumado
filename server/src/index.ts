import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { Pool } from 'pg';
import Redis from 'ioredis';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { env } from './config/env';
import { authRouter } from './routes/auth';
import { youtubeRouter } from './routes/youtube';
import { twitchRouter } from './routes/twitch';
import { streamsRouter } from './routes/streams';
import { channelsRouter } from './routes/channels';
import { securityRouter } from './routes/security';
import { consentRouter } from './routes/consent';
import { legalRouter } from './routes/legal';
import { maintenanceRouter } from './routes/maintenance';
import { usersRouter } from './routes/users';
import { logsRouter } from './routes/logs';
import { eventsubRouter } from './routes/eventsub';
import { cacheRouter } from './routes/cache';
import { adminStreamsRouter } from './routes/adminStreams';
import { adminRouter } from './routes/admin';
import { twitchChatService } from './services/twitchChatService';
import { streamSyncService, tokenStorage } from './services/streamSyncService';
import { fetchChannelEmotes } from './services/twitchService';
import { startDataSync } from './services/dataSyncService';
import { maintenanceService } from './services/maintenanceService';
import { twitchEventSubService } from './services/twitchEventSubService';
import { twitchEventSubManager } from './services/twitchEventSubManager';
import { twitchEventSubWebhookService } from './services/twitchEventSubWebhookService';
import { twitchConduitManager } from './services/twitchConduitManager';
import { liveStreamsCacheService } from './services/liveStreamsCacheService';
import { priorityManager } from './services/priorityManager';
import { dynamicChannelAllocator } from './services/dynamicChannelAllocator';
import { getTwitchAppAccessToken } from './services/twitchAppAuth';
import {
  generateNonce,
  securityHeaders,
  apiRateLimiter,
  authRateLimiter,
  checkBlockedIP,
  validateRequestSize,
} from './middleware/security';
import { maintenanceMode } from './middleware/maintenanceMode';
import { adminApiAuth } from './middleware/adminAuth';
import {
  wsConnectionManager,
  validateWebSocketMessage,
  wsHeartbeat,
} from './middleware/websocketSecurity';
import { requestLogger, recordAccessStats, SecurityLogger } from './middleware/logging';
import { anomalyDetectionService } from './services/anomalyDetection';
import { metricsCollector } from './services/metricsCollector';
import { systemMetricsCollector } from './services/systemMetricsCollector';
import { initializeSession, detectSessionHijacking, checkSessionTimeout, includeCSRFToken } from './middleware/sessionSecurity';
import { PVTracker } from './services/pvTracker';
import { createPVCounterMiddleware } from './middleware/pvCounter';
import { AnalyticsTracker } from './services/analyticsTracker';
import { analyticsRouter, setAnalyticsTracker } from './routes/analytics';

const app = express();

// Renderのリバースプロキシを信頼
app.set('trust proxy', true);

// Redisクライアントの作成（ioredis）
const redisClient = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('[Redis] Max reconnection attempts reached');
      return null;
    }
    return Math.min(times * 100, 3000);
  }
});

redisClient.on('error', (err) => console.error('[Redis] Client Error:', err));
redisClient.on('connect', () => console.log('[Redis] Client Connected'));
redisClient.on('ready', () => console.log('[Redis] Client Ready'));
redisClient.on('reconnecting', () => console.log('[Redis] Client Reconnecting...'));

// PV計測サービスの初期化
export const pvTracker = new PVTracker(redisClient);
console.log('[PVTracker] PV tracking service initialized');

// アナリティクストラッキングサービスの初期化
export const analyticsTracker = new AnalyticsTracker(redisClient);
setAnalyticsTracker(analyticsTracker);
console.log('[AnalyticsTracker] Analytics tracking service initialized');

// StreamSyncServiceをエクスポート（admin APIで統計情報にアクセスするため）
export { streamSyncService };

// CORS設定（モバイル対応 + 本番環境）
const allowedOrigins = [
  env.frontendUrl,  // 環境変数から取得（デフォルト: localhost:5173）
  'http://192.168.11.18:5173',  // モバイル開発用（ローカルネットワーク）
  'http://127.0.0.1:5173'
];

// 本番環境の場合は本番URLを追加
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push(
    'https://fukumado.jp',
    'https://www.fukumado.jp',
    'https://admin.fukumado.jp',
    // ベータ環境
    'https://beta.fukumado.jp',
    'https://beta-admin.fukumado.jp'
  );
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

// セキュリティミドルウェア
app.use(generateNonce); // Nonce生成（CSP用）
app.use(securityHeaders); // セキュリティヘッダー
app.use(checkBlockedIP); // IPブロックチェック
app.use(validateRequestSize); // リクエストサイズ検証
app.use(express.json({ limit: '10kb' })); // JSONパーサー（サイズ制限付き）

// ロギングミドルウェア
app.use(requestLogger); // HTTPリクエストログ
app.use(recordAccessStats); // アクセス統計記録

// 異常検知用のリクエスト記録 & メトリクス収集
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const duration = Date.now() - startTime;

    // 異常検知サービスに記録
    anomalyDetectionService.recordRequest(ip, req.path, res.statusCode);

    // メトリクス収集
    metricsCollector.recordHttpRequest(req.method, req.path, res.statusCode, duration);
  });
  next();
});

// PostgreSQLセッションストア
const PgSession = connectPg(session);
const pgPool = new Pool({
  connectionString: env.databaseUrl
});

// セッションミドルウェア（WebSocketでも使用するためexport）
const sessionMiddleware = session({
  store: new PgSession({
    pool: pgPool,
    tableName: 'sessions' // schema.sqlで作成したsessionsテーブルを使用
  }),
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // 本番環境のみHTTPS必須
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Safari対応：本番環境では'none'、開発環境では'lax'
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
});

app.use(sessionMiddleware);

// セッションセキュリティミドルウェア
app.use(initializeSession); // セッション初期化
app.use(detectSessionHijacking); // セッションハイジャック検出
app.use(checkSessionTimeout(30)); // 30分のタイムアウト
app.use(includeCSRFToken); // CSRFトークンをレスポンスに含める

// メンテナンスモードチェック（/healthは除外される）
app.use(maintenanceMode);

// PVカウントミドルウェア（ボット除外、API除外）
app.use(createPVCounterMiddleware(pvTracker));

app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 認証ルーター（厳しいレート制限）
app.use('/auth', authRateLimiter, authRouter);

// YouTube機能が有効な場合のみルーターを登録
if (env.enableYoutube) {
  app.use('/api/youtube', apiRateLimiter, youtubeRouter);
  console.log('[server] YouTube API enabled');
} else {
  console.log('[server] YouTube API disabled');
}

// APIルーター（レート制限付き）
app.use('/api/twitch', apiRateLimiter, twitchRouter);
app.use('/api/streams', apiRateLimiter, streamsRouter);
app.use('/api/channels', apiRateLimiter, channelsRouter);
app.use('/api/security', apiRateLimiter, securityRouter);
app.use('/api/consent', apiRateLimiter, consentRouter);
app.use('/api/legal', apiRateLimiter, legalRouter);

// 管理APIルーター（APIキー認証必須）
app.use('/api/admin/maintenance', adminApiAuth, maintenanceRouter);
app.use('/api/admin/users', adminApiAuth, usersRouter);
app.use('/api/admin/logs', adminApiAuth, logsRouter);
app.use('/api/admin/eventsub', adminApiAuth, eventsubRouter);
app.use('/api/admin/cache', adminApiAuth, cacheRouter);
app.use('/api/admin/streams', adminApiAuth, adminStreamsRouter);
app.use('/api/admin', adminApiAuth, adminRouter);
app.use('/api/analytics', apiRateLimiter, analyticsRouter);

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
  lastMessageAt: number; // 最終メッセージ受信時刻（タイムアウト検出用）
}

const clients = new Map<WebSocket, ClientData>();

// クライアントタイムアウトチェック（60秒間メッセージがなければ切断）
const CLIENT_TIMEOUT_MS = 60 * 1000; // 60秒
setInterval(() => {
  const now = Date.now();
  clients.forEach((clientData, ws) => {
    const timeSinceLastMessage = now - clientData.lastMessageAt;
    if (timeSinceLastMessage > CLIENT_TIMEOUT_MS) {
      console.warn(`[WebSocket] Client timeout detected: ${clientData.userId} (${Math.floor(timeSinceLastMessage / 1000)}s since last message)`);
      ws.close(1001, 'Client timeout');
    }
  });
}, 30 * 1000); // 30秒ごとにチェック

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
twitchEventSubManager.onStreamEvent((event) => {
  console.log('[EventSub Manager] Stream event received:', event);

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

// PriorityManagerのイベントハンドラー（優先度変更を全クライアントに通知）
priorityManager.onChange((event) => {
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
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
});

// Webhookサービスのイベントハンドラー（Webhook経由のイベントも全クライアントに通知）
twitchEventSubWebhookService.onStreamEvent((event) => {
  console.log('[EventSub Webhook] Stream event received:', event);

  // 全クライアントに通知（EventSubManagerと同じ形式）
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

// Conduit Managerのイベントハンドラー（Conduits経由のイベント + キャッシュ更新）
twitchConduitManager.onStreamEvent((event) => {
  console.log('[Conduit Manager] Stream event received:', event);

  // キャッシュを即時更新
  if (event.type === 'online') {
    // 配信開始：キャッシュに追加
    const streamInfo = {
      id: '', // IDは後でAPI呼び出しで取得される
      userId: event.broadcasterId,
      login: event.broadcasterLogin,
      displayName: event.broadcasterName,
      title: '', // タイトルは後でAPI呼び出しで取得される
      viewerCount: 0,
      thumbnailUrl: '',
      startedAt: event.startedAt || new Date().toISOString()
    };
    liveStreamsCacheService.addLiveStream(streamInfo);
    console.log(`[Conduit Manager] Added stream to cache: ${event.broadcasterName}`);
  } else if (event.type === 'offline') {
    // 配信終了：キャッシュから削除
    liveStreamsCacheService.removeLiveStream(event.broadcasterId);
    console.log(`[Conduit Manager] Removed stream from cache: ${event.broadcasterName}`);
  }

  // 全クライアントに通知（EventSubManagerと同じ形式）
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

// MaintenanceServiceのイベントハンドラー（メンテナンス状態変更を全クライアントに通知）
maintenanceService.on('statusChanged', (event) => {
  console.log('[Maintenance] Status change event:', {
    enabled: event.enabled,
    message: event.message,
    duration: event.duration
  });

  // 全クライアントに通知
  const payload = JSON.stringify({
    type: 'maintenance_status_changed',
    enabled: event.enabled,
    message: event.message,
    enabledAt: event.enabledAt,
    duration: event.duration,
    scheduledEndAt: event.scheduledEndAt
  });

  clients.forEach((_, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      console.log('[Maintenance] Sent status change to client');
    }
  });
});

wss.on('connection', (ws, request) => {
  const clientIP = request.socket.remoteAddress || 'unknown';
  console.log(`[WebSocket] Client attempting connection from ${clientIP}`);

  // セキュリティチェック：接続数制限
  const canConnect = wsConnectionManager.canConnect(clientIP);
  if (!canConnect.allowed) {
    console.warn(`[WebSocket Security] Connection rejected: ${clientIP} - ${canConnect.reason}`);
    ws.close(1008, canConnect.reason);
    return;
  }

  // 接続を記録
  wsConnectionManager.registerConnection(clientIP);
  metricsCollector.recordWebSocketConnection(true); // メトリクス記録
  console.log('[WebSocket] Client connected');

  // ハートビートを開始（無効化：アプリケーションレベルのheartbeatのみ使用）
  // wsHeartbeat.start(ws);

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
      twitchAccessToken: session?.streamSyncTokens?.twitch,
      lastMessageAt: Date.now() // 初期化時の現在時刻
    };

    clients.set(ws, clientData);
    console.log(`[WebSocket] Client connected with session ID: ${clientData.userId}`);
    console.log(`[WebSocket] Session tokens - YouTube: ${!!clientData.youtubeAccessToken}, Twitch: ${!!clientData.twitchAccessToken}`);

  // Twitchチャットメッセージハンドラー
  const messageHandler = (message: any) => {
    // このクライアントが購読しているチャンネルのメッセージのみ送信
    if (clientData.channels.has(message.channelLogin)) {
      // channelLoginをdisplayNameに変換
      const displayName = clientData.channelMapping[message.channelLogin] || message.channelLogin;
      const payload = JSON.stringify({
        ...message,
        channelName: displayName
      });

      try {
        ws.send(payload);
      } catch (error) {
        console.error('[MessageHandler] Error sending message:', error);
      }
    }
  };

  // メッセージハンドラーを登録
  clientData.cleanup = twitchChatService.onMessage(messageHandler);

  ws.on('message', async (data) => {
    try {
      // レート制限チェック
      const canSend = wsConnectionManager.canSendMessage(clientIP);
      if (!canSend.allowed) {
        console.warn(`[WebSocket Security] Message rate limit exceeded: ${clientIP}`);
        ws.send(JSON.stringify({ type: 'error', error: canSend.reason }));
        return;
      }

      const payload = JSON.parse(data.toString());
      console.log('[WebSocket] Received message:', payload);

      // メトリクス記録
      metricsCollector.recordWebSocketMessage(payload.type || 'unknown', 'in');

      // メッセージ検証
      const validation = validateWebSocketMessage(payload);
      if (!validation.valid) {
        console.warn(`[WebSocket Security] Invalid message from ${clientIP}: ${validation.reason}`);
        ws.send(JSON.stringify({ type: 'error', error: validation.reason }));
        return;
      }

      // 最終メッセージ時刻を更新（タイムアウト検出用）
      clientData.lastMessageAt = Date.now();

      // ハートビートメッセージは何もせず終了
      if (payload.type === 'heartbeat') {
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

          // チャンネルエモートの先読み（非同期、ノンブロッキング）
          if (channelIdMapping && typeof channelIdMapping === 'object') {
            const tokens = req.session?.twitchTokens;
            if (tokens?.accessToken) {
              Object.values(channelIdMapping).forEach((channelId) => {
                if (channelId && typeof channelId === 'string') {
                  fetchChannelEmotes(tokens.accessToken, channelId)
                    .then(() => {
                      console.log(`[WebSocket] Channel emotes preloaded for ${channelId}`);
                    })
                    .catch((error) => {
                      console.error(`[WebSocket] Failed to preload emotes for ${channelId}:`, error.message);
                    });
                }
              });
            }
          }
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
    console.log(`[WebSocket] Client disconnected: ${clientIP}`);

    // ハートビートを停止（無効化：アプリケーションレベルのheartbeatのみ使用）
    // wsHeartbeat.stop(ws);

    // 接続を解除
    wsConnectionManager.unregisterConnection(clientIP);
    metricsCollector.recordWebSocketConnection(false); // メトリクス記録

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

/**
 * WebSocket統計を取得（管理API用）
 */
export function getWebSocketStats() {
  const now = Date.now();
  const CLIENT_TIMEOUT_MS = 60 * 1000; // 60秒

  let activeConnections = 0;

  clients.forEach((clientData) => {
    const timeSinceLastMessage = now - clientData.lastMessageAt;
    if (timeSinceLastMessage <= CLIENT_TIMEOUT_MS) {
      activeConnections++;
    }
  });

  return {
    totalConnections: clients.size,
    activeConnections: activeConnections,
    zombieConnections: clients.size - activeConnections
  };
}

server.listen(env.port, async () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${env.port}`);
  console.log('[server] StreamSyncService will start automatically when clients connect');

  // SystemMetricsCollectorを開始
  systemMetricsCollector.start();

  // 動的閾値モニタリングを開始
  try {
    const appAccessToken = await getTwitchAppAccessToken();
    priorityManager.setAccessToken(appAccessToken);
    priorityManager.startDynamicThresholdMonitoring();
    console.log('[server] Dynamic threshold monitoring started');

    // データ同期サービスを開始（グローバルエモート、古いチャンネルデータの同期）
    startDataSync(appAccessToken);
    console.log('[server] Data sync service started');
  } catch (error) {
    console.error('[server] Failed to start dynamic threshold monitoring:', error);
    console.log('[server] Using default threshold (10 viewers)');
  }

  // EventSubが有効な場合の処理
  if (env.enableEventSub) {
    console.log('[server] EventSub is enabled');

    const eventSubMode = process.env.EVENTSUB_MODE || 'websocket';
    console.log(`[server] EventSub mode: ${eventSubMode}`);

    if (eventSubMode === 'conduit') {
      // Conduitsモード: サーバー起動時に自動初期化
      console.log('[server] Initializing Conduits mode...');
      try {
        await twitchEventSubManager.connectAll();
        console.log('[server] Conduits mode initialized successfully');
      } catch (error) {
        console.error('[server] Failed to initialize Conduits mode:', error);
      }
    } else {
      // WebSocketモード: 管理者ログイン時に初期化
      console.log('[server] EventSub will be initialized when admin authenticates via dashboard');
    }
  } else {
    console.log('[server] EventSub is disabled');
  }
});
