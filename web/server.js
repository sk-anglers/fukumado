import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// プロキシ先のバックエンドURL（環境変数から取得、デフォルトはbeta-api）
const API_TARGET = process.env.API_TARGET || 'https://beta-api.fukumado.jp';

console.log(`[Proxy Server] Starting with API_TARGET: ${API_TARGET}`);

// プロキシ設定：/api/* と /auth/* をバックエンドにプロキシ
app.use(
  ['/api', '/auth'],
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    ws: false, // WebSocketは別途処理
    onProxyReq: (proxyReq, req) => {
      console.log(`[Proxy] ${req.method} ${req.path} -> ${API_TARGET}${req.path}`);
    },
    onError: (err, req, res) => {
      console.error(`[Proxy Error] ${req.path}:`, err.message);
      res.status(502).json({ error: 'Bad Gateway', message: err.message });
    }
  })
);

// WebSocketプロキシ：/chat をバックエンドにプロキシ
const wsProxy = createProxyMiddleware('/chat', {
  target: API_TARGET.replace('https://', 'wss://').replace('http://', 'ws://'),
  changeOrigin: true,
  ws: true,
  onProxyReqWs: (proxyReq, req, socket) => {
    console.log(`[WebSocket Proxy] ${req.url} -> ${API_TARGET.replace('https://', 'wss://')}${req.url}`);
  },
  onError: (err, req, res) => {
    console.error(`[WebSocket Proxy Error]:`, err.message);
  }
});

app.use(wsProxy);

// 静的ファイルの配信（Viteビルド出力）
const distPath = join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA用のフォールバック：すべてのルートでindex.htmlを返す
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`[Proxy Server] Listening on port ${PORT}`);
  console.log(`[Proxy Server] Proxying /api/* and /auth/* to ${API_TARGET}`);
  console.log(`[Proxy Server] Serving static files from ${distPath}`);
});

// WebSocketアップグレードをプロキシに転送
server.on('upgrade', wsProxy.upgrade);
