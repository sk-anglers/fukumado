import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { env } from './config/env';
import { basicAuth } from './middleware/auth';
import { ipFilter } from './middleware/ipFilter';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { metricsRouter } from './routes/metrics';
import { securityRouter } from './routes/security';
import { maintenanceRouter } from './routes/maintenance';
import { streamsRouter } from './routes/streams';
import { usersRouter } from './routes/users';
import { logsRouter } from './routes/logs';
import { eventsubRouter } from './routes/eventsub';
import { cacheRouter } from './routes/cache';
import { apiMonitorRouter } from './routes/apiMonitor';
import { auditLogsRouter } from './routes/auditLogs';
import { alertsRouter } from './routes/alerts';
import { servicesRouter } from './routes/services';
import { helpRouter } from './routes/help';
import { announcementsRouter } from './routes/announcements';
import pvRouter from './routes/pv';
import analyticsRouter from './routes/analytics';
import { adminRouter } from './routes/admin';
import { metricsCollector } from './services/metricsCollector';
import { securityMonitor } from './services/securityMonitor';

const app = express();

// CORS設定
const allowedOrigins = [
  env.adminFrontendUrl  // 環境変数から取得（デフォルト: localhost:5174）
];

// 本番環境の場合は本番URLも追加
if (env.nodeEnv === 'production') {
  allowedOrigins.push(
    'https://admin.fukumado.jp',
    // ベータ環境
    'https://beta-admin.fukumado.jp'
  );
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// セッション設定
app.use(session({
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: env.nodeEnv === 'production', // httpsのみ（本番環境）
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24時間
  }
}));

// IP制限ミドルウェア（全エンドポイントに適用）
app.use(ipFilter);

// ヘルスチェック（認証不要・Render対応）
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/admin/health', healthRouter);

// 認証エンドポイント（認証不要）
app.use('/auth', authRouter);

// 以降のエンドポイントはBasic認証必須
app.use('/api/admin', basicAuth);

// セキュリティログ記録ミドルウェア
app.use('/api/admin', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  securityMonitor.logAccess(ip, req.path, userAgent);
  next();
});

// APIルート
app.use('/api/admin/metrics', metricsRouter);
app.use('/api/admin/security', securityRouter);
app.use('/api/admin/maintenance', maintenanceRouter);
app.use('/api/admin/streams', streamsRouter);
app.use('/api/admin/users', usersRouter);
app.use('/api/admin/logs', logsRouter);
app.use('/api/admin/eventsub', eventsubRouter);
app.use('/api/admin/cache', cacheRouter);
app.use('/api/admin/api-monitor', apiMonitorRouter);
app.use('/api/admin/audit-logs', auditLogsRouter);
app.use('/api/admin/alerts', alertsRouter);
app.use('/api/admin/alert-settings', alertsRouter);
app.use('/api/admin/services', servicesRouter);
app.use('/api/admin/pv', pvRouter);
app.use('/api/admin/analytics', analyticsRouter);
app.use('/api/admin/help', helpRouter);
app.use('/api/admin/announcements', announcementsRouter);
app.use('/api/admin', adminRouter);

// HTTPサーバーを作成
const server = createServer(app);

// WebSocketサーバーを作成
const wss = new WebSocketServer({ server, path: '/admin/ws' });

// WebSocket接続管理
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  console.log('[WebSocket] Admin client connected');
  clients.add(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[WebSocket] Received message:', message);

      // TODO: メッセージハンドリング実装
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Admin client disconnected');
    clients.delete(ws);
    metricsCollector.setWebSocketConnections(clients.size);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Client error:', error);
  });

  // 接続数を更新
  metricsCollector.setWebSocketConnections(clients.size);
});

// メトリクス収集を開始
metricsCollector.start();

// 定期的にメトリクスをWebSocketで配信（10秒間隔）
setInterval(async () => {
  if (clients.size === 0) return;

  const metrics = await metricsCollector.getLatestMetrics();
  if (!metrics) return;

  const message = JSON.stringify({
    type: 'metrics_update',
    data: { system: metrics },
    timestamp: new Date().toISOString()
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}, 10000);

// グレースフルシャットダウン
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  metricsCollector.stop();

  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  metricsCollector.stop();

  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

// サーバー起動
server.listen(env.port, () => {
  console.log('========================================');
  console.log('  Fukumado Admin Dashboard Backend');
  console.log('========================================');
  console.log(`[Server] Listening on http://localhost:${env.port}`);
  console.log(`[Server] Environment: ${env.nodeEnv}`);
  console.log(`[Server] WebSocket: ws://localhost:${env.port}/admin/ws`);
  console.log('========================================');
});
