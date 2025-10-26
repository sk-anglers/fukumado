# Render.com デプロイメント実装計画書

**対象アプリケーション**: ふくまど！(Fukumado) - Multi-Streaming Viewer
**バージョン**: 1.0.0
**作成日**: 2025-10-26
**デプロイ先**: Render.com

---

## 目次

1. [概要](#1-概要)
2. [現状のシステム構成](#2-現状のシステム構成)
3. [Render.com の選択理由](#3-rendercom-の選択理由)
4. [デプロイ対象の詳細](#4-デプロイ対象の詳細)
5. [事前準備](#5-事前準備)
6. [バックエンドのデプロイ手順](#6-バックエンドのデプロイ手順)
7. [フロントエンドのデプロイ手順](#7-フロントエンドのデプロイ手順)
8. [環境変数の設定](#8-環境変数の設定)
9. [Redis の設定（オプション）](#9-redis-の設定オプション)
10. [コード修正が必要な箇所](#10-コード修正が必要な箇所)
11. [デプロイ後の動作確認](#11-デプロイ後の動作確認)
12. [トラブルシューティング](#12-トラブルシューティング)
13. [コスト試算](#13-コスト試算)

---

## 1. 概要

### 1.1 デプロイメント構成

```
┌──────────────────────────────────────────────────────┐
│                   Render.com                          │
│                                                        │
│  ┌──────────────────┐         ┌──────────────────┐   │
│  │  Static Site     │────────▶│  Web Service     │   │
│  │  (Frontend)      │  API    │  (Backend)       │   │
│  │                  │  /ws    │                  │   │
│  │  - React + Vite  │         │  - Node.js       │   │
│  │  - Static Files  │         │  - Express       │   │
│  │  - Port: 443     │         │  - WebSocket     │   │
│  │    (HTTPS)       │         │  - Port: 443     │   │
│  └──────────────────┘         │    (HTTPS/WSS)   │   │
│                                └──────────────────┘   │
│                                         │             │
│                                         ▼             │
│                                ┌──────────────────┐   │
│                                │  Redis (Optional)│   │
│                                │  - Cache         │   │
│                                │  - TTL: 70s      │   │
│                                └──────────────────┘   │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │  External APIs            │
        │  - YouTube Data API v3    │
        │  - Twitch Helix API       │
        └───────────────────────────┘
```

### 1.2 デプロイするサービス

| サービス名 | タイプ | 用途 | 必須 |
|-----------|--------|------|------|
| fukumado-backend | Web Service | バックエンドAPI・WebSocket | ✓ |
| fukumado-frontend | Static Site | フロントエンド | ✓ |
| fukumado-redis | Redis | キャッシング | △ (推奨) |

---

## 2. 現状のシステム構成

### 2.1 フロントエンド (web/)

- **フレームワーク**: React 18.3.1
- **ビルドツール**: Vite 5.4.2
- **言語**: TypeScript 5.5.4
- **状態管理**: Zustand 4.5.2
- **開発ポート**: 5173
- **ビルドコマンド**: `npm run build`
- **ビルド出力先**: `dist/`

**特徴**:
- OAuth認証（Google/Twitch）
- WebSocket接続でリアルタイム配信更新
- Resource Timing API でデータ使用量監視

### 2.2 バックエンド (server/)

- **フレームワーク**: Node.js + Express
- **言語**: TypeScript
- **ポート**: 4000
- **WebSocket**: ws ライブラリ
  - `/chat`: Twitchチャット用
  - クエリパラメータでsessionId管理
- **主要依存関係**:
  - express 5.1.0
  - ws 8.18.3
  - ioredis 5.4.1
  - tmi.js 1.8.5 (Twitch IRC)
  - express-session 1.18.2

**特徴**:
- StreamSyncService（60秒間隔で配信同期）
- OAuth 2.0 認証エンドポイント
- Redisキャッシング（オプション）
- WebSocket による配信更新プッシュ通知

### 2.3 現在の開発環境

```
開発時:
- Frontend: http://localhost:5173 (Vite dev server)
- Backend:  http://localhost:4000 (Express)
- WebSocket: ws://localhost:4000/chat

Vite Proxy設定:
- /api/* → http://localhost:4000
- /auth/* → http://localhost:4000
```

---

## 3. Render.com の選択理由

### 3.1 メリット

| メリット | 詳細 |
|---------|------|
| **無料プランあり** | 個人開発に最適（有料プランへのアップグレードも容易） |
| **WebSocket対応** | WebSocketがHTTPS/WSSで自動対応 |
| **Git連携** | GitHub/GitLabからの自動デプロイ |
| **環境変数管理** | UIから簡単に設定可能 |
| **Redis統合** | マネージドRedisサービスあり |
| **SSL/TLS自動** | 全てのサービスに無料のSSL証明書 |
| **ログ管理** | リアルタイムログ閲覧機能 |
| **スケーラブル** | 必要に応じてスケールアップ可能 |

### 3.2 他サービスとの比較

| サービス | WebSocket | 無料枠 | Redis | 複雑度 |
|---------|-----------|--------|-------|--------|
| **Render.com** | ◎ | ◎ | ◎ | 低 |
| Vercel | △ (制限あり) | ◎ | × | 低 |
| Heroku | ◎ | △ (2022年終了) | ◎ | 中 |
| Railway | ◎ | ○ | ◎ | 低 |
| AWS (EC2/ECS) | ◎ | ○ | ◎ | 高 |

---

## 4. デプロイ対象の詳細

### 4.1 バックエンド (Web Service)

**リポジトリルート**: `/server`

| 項目 | 設定値 |
|-----|--------|
| **Name** | fukumado-backend |
| **Region** | Singapore (asia-southeast1) |
| **Branch** | main |
| **Root Directory** | server |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | Starter (Free) → 有料プランへ移行推奨 |

**必要なファイル**:
- `package.json` ✓（既存）
- `tsconfig.json` ✓（既存）
- `.env` → Render の環境変数で設定

### 4.2 フロントエンド (Static Site)

**リポジトリルート**: `/web`

| 項目 | 設定値 |
|-----|--------|
| **Name** | fukumado-frontend |
| **Region** | Singapore (asia-southeast1) |
| **Branch** | main |
| **Root Directory** | web |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | dist |
| **Plan** | Free |

**必要なファイル**:
- `package.json` ✓（既存）
- `vite.config.ts` ✓（既存、要修正）
- `src/config.ts` → バックエンドURL設定（要修正）

### 4.3 Redis (Managed Redis)

| 項目 | 設定値 |
|-----|--------|
| **Name** | fukumado-redis |
| **Region** | Singapore (asia-southeast1) |
| **Plan** | Starter ($10/月) または Free (制限あり) |
| **Max Memory Policy** | allkeys-lru |

---

## 5. 事前準備

### 5.1 必要なアカウント・認証情報

#### 5.1.1 Render.com アカウント

1. https://render.com にアクセス
2. GitHubアカウントでサインアップ（推奨）
3. リポジトリへのアクセス権限を付与

#### 5.1.2 YouTube (Google Cloud) OAuth 認証情報

既存の認証情報に **Render.comのリダイレクトURI** を追加:

1. Google Cloud Console → https://console.cloud.google.com
2. 「認証情報」→ 既存のOAuth 2.0クライアントを選択
3. 「承認済みのリダイレクトURI」に追加:
   ```
   https://fukumado-backend.onrender.com/auth/google/callback
   ```
   ※ `fukumado-backend` は実際のサービス名に置き換え

#### 5.1.3 Twitch OAuth 認証情報

既存の認証情報に **Render.comのリダイレクトURI** を追加:

1. Twitch Developers Console → https://dev.twitch.tv/console
2. 既存のアプリケーションを選択
3. 「OAuth Redirect URLs」に追加:
   ```
   https://fukumado-backend.onrender.com/auth/twitch/callback
   ```

#### 5.1.4 必要な環境変数の収集

`.env.example` を参考に以下を準備:

```env
# Server
PORT=4000
SESSION_SECRET=<ランダムな文字列64文字以上>

# Google / YouTube
YOUTUBE_API_KEY=<YouTube Data API v3 キー>
YOUTUBE_CLIENT_ID=<Google OAuth クライアントID>
YOUTUBE_CLIENT_SECRET=<Google OAuth クライアントシークレット>
YOUTUBE_REDIRECT_URI=https://fukumado-backend.onrender.com/auth/google/callback

# Twitch
TWITCH_CLIENT_ID=<Twitch クライアントID>
TWITCH_CLIENT_SECRET=<Twitch クライアントシークレット>
TWITCH_REDIRECT_URI=https://fukumado-backend.onrender.com/auth/twitch/callback

# Redis (Optional)
REDIS_URL=<Render Redis の内部URL>
```

**SESSION_SECRET の生成方法**:
```bash
# Node.js で生成
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# または OpenSSL で生成
openssl rand -hex 64
```

### 5.2 Gitリポジトリの準備

#### 5.2.1 .gitignore の確認

以下のファイルが除外されていることを確認:

```gitignore
# 環境変数
.env
.env.local
.env.production

# ビルド成果物
dist/
build/
node_modules/

# ログ
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db
```

#### 5.2.2 リポジトリ構造

```
/
├── server/          ← バックエンド
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── web/             ← フロントエンド
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── RENDER_DEPLOYMENT.md  ← この文書
└── README.md
```

---

## 6. バックエンドのデプロイ手順

### 6.1 Render.com でバックエンドサービスを作成

#### ステップ1: 新規 Web Service の作成

1. Render.com ダッシュボードにログイン
2. 「New +」→「Web Service」をクリック
3. GitHubリポジトリを選択
4. 以下の設定を入力:

| フィールド | 値 |
|-----------|---|
| **Name** | `fukumado-backend` |
| **Region** | `Singapore (Southeast Asia)` |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

#### ステップ2: 環境変数の設定

「Environment」タブで以下を追加:

```env
PORT=4000
NODE_ENV=production
SESSION_SECRET=<生成したランダム文字列>

YOUTUBE_API_KEY=<あなたのYouTube API Key>
YOUTUBE_CLIENT_ID=<Google OAuth Client ID>
YOUTUBE_CLIENT_SECRET=<Google OAuth Client Secret>
YOUTUBE_REDIRECT_URI=https://fukumado-backend.onrender.com/auth/google/callback

TWITCH_CLIENT_ID=<Twitch Client ID>
TWITCH_CLIENT_SECRET=<Twitch Client Secret>
TWITCH_REDIRECT_URI=https://fukumado-backend.onrender.com/auth/twitch/callback
```

**注意**:
- `fukumado-backend` の部分は実際のRenderサービス名に置き換えてください
- Renderは自動的に `https://` プロトコルと `.onrender.com` ドメインを付与します

#### ステップ3: Health Check の設定（オプション）

「Settings」→「Health & Alerts」:

| フィールド | 値 |
|-----------|---|
| **Health Check Path** | `/api/health` (要実装) |
| **Response Timeout** | 30 seconds |

#### ステップ4: デプロイ実行

1. 「Create Web Service」をクリック
2. 自動的にビルド・デプロイが開始される
3. ログを確認して正常にデプロイされたか確認

**期待されるログ出力**:
```
==> Building...
npm install
npm run build

==> Deploying...
npm start

Server is running on port 4000
[StreamSync] Service started
Redis connection established (または Redis not available - using memory cache)
```

#### ステップ5: サービスURLの確認

デプロイ完了後、以下のURLが割り当てられます:
```
https://fukumado-backend.onrender.com
```

このURLをメモしておいてください（フロントエンドの設定で使用）。

### 6.2 バックエンドの動作確認

#### 確認1: APIの疎通確認

ブラウザまたはcurlで以下にアクセス:

```bash
# Health Check (要実装)
curl https://fukumado-backend.onrender.com/api/health

# 期待されるレスポンス
{"status":"ok","timestamp":"2025-10-26T..."}
```

#### 確認2: CORS設定の確認

ブラウザの開発者ツールで、フロントエンドからのリクエストがCORSエラーなく通ることを確認。

---

## 7. フロントエンドのデプロイ手順

### 7.1 Render.com でフロントエンドサービスを作成

#### ステップ1: 新規 Static Site の作成

1. Render.com ダッシュボードで「New +」→「Static Site」
2. 同じGitHubリポジトリを選択
3. 以下の設定を入力:

| フィールド | 値 |
|-----------|---|
| **Name** | `fukumado-frontend` |
| **Region** | `Singapore (Southeast Asia)` |
| **Branch** | `main` |
| **Root Directory** | `web` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

#### ステップ2: 環境変数の設定

「Environment」タブで以下を追加:

```env
# バックエンドURL（実際のRenderサービスURLに置き換え）
VITE_API_BASE_URL=https://fukumado-backend.onrender.com
VITE_WS_URL=wss://fukumado-backend.onrender.com
```

**重要**: Viteの環境変数は `VITE_` プレフィックスが必須です。

#### ステップ3: カスタムドメインの設定（オプション）

独自ドメインを使用する場合:

1. 「Settings」→「Custom Domains」
2. ドメインを追加（例: `fukumado.example.com`）
3. DNSレコードを設定:
   ```
   CNAME fukumado → fukumado-frontend.onrender.com
   ```

#### ステップ4: リダイレクトルールの設定

SPA（Single Page Application）のため、すべてのルートを `index.html` にリダイレクト。

Renderの`render.yaml`を使用するか、`_redirects`ファイルを作成:

**方法1: _redirects ファイル（推奨）**

`web/public/_redirects` を作成:
```
/*    /index.html   200
```

このファイルはビルド時に `dist/` にコピーされます。

**方法2: render.yaml**

プロジェクトルートに `render.yaml` を作成（後述）。

#### ステップ5: デプロイ実行

1. 「Create Static Site」をクリック
2. 自動ビルド・デプロイが開始
3. 完了後、以下のようなURLが割り当てられます:
   ```
   https://fukumado-frontend.onrender.com
   ```

### 7.2 フロントエンドの動作確認

#### 確認1: ページの表示

ブラウザで `https://fukumado-frontend.onrender.com` にアクセスし、正常に表示されるか確認。

#### 確認2: WebSocket接続

開発者ツールのコンソールで以下を確認:
```
[WebSocketService] Connected successfully
[useStreamUpdates] Ensuring WebSocket connection...
```

#### 確認3: OAuth認証フロー

1. YouTubeログインボタンをクリック
2. Google認証画面にリダイレクトされるか確認
3. 認証後、正しくアプリにリダイレクトされるか確認

---

## 8. 環境変数の設定

### 8.1 バックエンド環境変数（完全版）

Render.com の「Environment」タブで設定:

```env
# ===== Server Configuration =====
PORT=4000
NODE_ENV=production
SESSION_SECRET=<64文字以上のランダム文字列>

# ===== Google / YouTube API =====
YOUTUBE_API_KEY=<YouTube Data API v3 キー>
YOUTUBE_CLIENT_ID=<Google OAuth Client ID>
YOUTUBE_CLIENT_SECRET=<Google OAuth Client Secret>
YOUTUBE_REDIRECT_URI=https://fukumado-backend.onrender.com/auth/google/callback

# ===== Twitch API =====
TWITCH_CLIENT_ID=<Twitch Client ID>
TWITCH_CLIENT_SECRET=<Twitch Client Secret>
TWITCH_REDIRECT_URI=https://fukumado-backend.onrender.com/auth/twitch/callback

# ===== Redis (Optional) =====
# Render Redisサービスを作成した場合、自動的に REDIS_URL が設定される
# 手動で設定する場合:
REDIS_URL=redis://red-xxxxx:6379

# ===== CORS Settings =====
# フロントエンドのURLを指定（カンマ区切りで複数指定可能）
ALLOWED_ORIGINS=https://fukumado-frontend.onrender.com,https://fukumado.example.com

# ===== Logging =====
LOG_LEVEL=info
```

### 8.2 フロントエンド環境変数（完全版）

Render.com の「Environment」タブで設定:

```env
# ===== API Endpoints =====
VITE_API_BASE_URL=https://fukumado-backend.onrender.com
VITE_WS_URL=wss://fukumado-backend.onrender.com

# ===== Feature Flags =====
VITE_ENABLE_YOUTUBE=true
VITE_ENABLE_TWITCH=true
VITE_ENABLE_NICONICO=false

# ===== Analytics (Optional) =====
# VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

### 8.3 環境変数の管理ベストプラクティス

#### セキュリティ
- ✅ **DO**: Render の Environment Variables を使用
- ❌ **DON'T**: `.env` ファイルをGitにコミット
- ✅ **DO**: シークレットキーは64文字以上のランダム文字列
- ✅ **DO**: 本番環境と開発環境で異なる値を使用

#### 更新方法
1. Render ダッシュボードで環境変数を変更
2. 変更を保存すると自動的に再デプロイが実行される
3. サービスが再起動され、新しい環境変数が適用される

---

## 9. Redis の設定（オプション）

### 9.1 Redis の必要性

Redisは**オプション**ですが、以下の理由で推奨されます:

| 機能 | Redis無し | Redis有り |
|-----|----------|----------|
| **配信リストキャッシュ** | メモリのみ（再起動で消失） | 永続化 |
| **複数インスタンス** | 各インスタンスが独自キャッシュ | 共有キャッシュ |
| **パフォーマンス** | API呼び出し頻度が高い | キャッシュヒット率向上 |
| **コスト** | 無料 | $10/月〜 |

**結論**: 個人開発の初期段階ではRedis無しでも動作しますが、本番運用では推奨。

### 9.2 Render Redis の作成手順

#### ステップ1: Redisサービスの作成

1. Render ダッシュボードで「New +」→「Redis」
2. 設定を入力:

| フィールド | 値 |
|-----------|---|
| **Name** | `fukumado-redis` |
| **Region** | `Singapore (Southeast Asia)` ※バックエンドと同じリージョン |
| **Plan** | `Starter ($10/月)` または `Free (制限あり)` |
| **Max Memory Policy** | `allkeys-lru` |

#### ステップ2: 内部URLの取得

Redisサービスが作成されると、**Internal Redis URL** が発行されます:
```
redis://red-xxxxxxxxxxxxx:6379
```

#### ステップ3: バックエンドに接続情報を設定

バックエンドサービスの「Environment」タブで設定:

**方法1: 環境変数リンク（推奨）**

Render は同じプロジェクト内のサービス間で環境変数を共有できます:

1. バックエンドの「Environment」タブ
2. 「Add Environment Variable」→「From Another Service」
3. `fukumado-redis` を選択
4. `REDIS_URL` が自動的に追加される

**方法2: 手動設定**

```env
REDIS_URL=redis://red-xxxxxxxxxxxxx:6379
```

#### ステップ4: バックエンドの再デプロイ

環境変数を追加後、バックエンドが自動的に再デプロイされます。

#### ステップ5: Redis接続の確認

バックエンドのログで以下を確認:
```
Redis connection established
Redis client ready
```

### 9.3 Redis接続エラーのハンドリング

現在のコードは Redis が利用できない場合、自動的にメモリキャッシュにフォールバックします:

```typescript
// server/src/services/cacheService.ts
if (!cacheService.isConnected()) {
  console.warn('[Cache] Redis not available - using memory cache');
}
```

このため、Redisが無くてもアプリケーションは動作します。

---

## 10. コード修正が必要な箇所

デプロイ前に以下のコード修正が必要です。

### 10.1 バックエンド修正

#### 10.1.1 CORS設定の修正

**ファイル**: `server/src/index.ts`

**現在のコード**:
```typescript
app.use(cors({
  origin: 'http://localhost:5173', // 開発環境のみ
  credentials: true
}));
```

**修正後のコード**:
```typescript
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173']; // 開発環境用フォールバック

app.use(cors({
  origin: (origin, callback) => {
    // originがない場合（同一オリジンリクエスト）は許可
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

**環境変数の設定**:
```env
ALLOWED_ORIGINS=https://fukumado-frontend.onrender.com,https://fukumado.example.com
```

#### 10.1.2 セッションCookie設定の修正

**ファイル**: `server/src/index.ts`

**現在のコード**:
```typescript
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // HTTPで動作
}));
```

**修正後のコード**:
```typescript
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS必須
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24時間
  }
}));
```

#### 10.1.3 WebSocket接続のホスト確認

**ファイル**: `server/src/index.ts` または WebSocket初期化部分

WebSocketサーバーは既に正しく設定されている可能性が高いですが、確認:

```typescript
const server = createServer(app);
const wss = new WebSocketServer({ server }); // ← pathを指定しない場合、全てのWSリクエストを受け付ける

// または
const wss = new WebSocketServer({ server, path: '/chat' });
```

**重要**: Render は自動的にHTTPS/WSSにアップグレードするため、コード変更は不要です。

#### 10.1.4 Health Check エンドポイントの追加（推奨）

**ファイル**: `server/src/routes/index.ts` または `server/src/index.ts`

```typescript
// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: cacheService.isConnected() ? 'connected' : 'disconnected',
      streamSync: streamSyncService.getStats().isRunning ? 'running' : 'stopped'
    }
  });
});
```

### 10.2 フロントエンド修正

#### 10.2.1 API URLの環境変数化

**ファイル**: `web/src/config.ts` （存在しない場合は作成）

**新規作成**:
```typescript
// web/src/config.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';

export const config = {
  apiBaseUrl: API_BASE_URL,
  wsUrl: WS_URL,
  enableYoutube: import.meta.env.VITE_ENABLE_YOUTUBE !== 'false',
  enableTwitch: import.meta.env.VITE_ENABLE_TWITCH !== 'false',
  enableNiconico: import.meta.env.VITE_ENABLE_NICONICO === 'true'
} as const;
```

#### 10.2.2 WebSocketService の URL修正

**ファイル**: `web/src/services/websocketService.ts`

**現在のコード**:
```typescript
const WS_URL = 'ws://localhost:4000/chat';
```

**修正後のコード**:
```typescript
import { config } from '../config';

const WS_URL = `${config.wsUrl}/chat`;
```

#### 10.2.3 API呼び出しの修正

**ファイル**: `web/src/utils/api.ts` （存在しない場合は作成）

**新規作成**:
```typescript
// web/src/utils/api.ts
import { config } from '../config';

export const apiFetch = async (path: string, options?: RequestInit): Promise<Response> => {
  const url = path.startsWith('http') ? path : `${config.apiBaseUrl}${path}`;

  return fetch(url, {
    ...options,
    credentials: 'include', // Cookieを含める
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
};
```

**既存のfetch呼び出しを置き換え**:

**例**: `web/src/hooks/useAuthStatus.ts`

**変更前**:
```typescript
const response = await fetch('/api/auth/status');
```

**変更後**:
```typescript
import { apiFetch } from '../utils/api';

const response = await apiFetch('/api/auth/status');
```

#### 10.2.4 Vite設定の修正（開発環境用）

**ファイル**: `web/vite.config.ts`

開発環境でのプロキシ設定は維持しつつ、本番環境では環境変数を使用:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:4000',
        changeOrigin: true
      },
      '/auth': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173
  }
});
```

#### 10.2.5 _redirects ファイルの作成

**ファイル**: `web/public/_redirects` （新規作成）

```
# SPA用リダイレクト - 全てのルートをindex.htmlに
/*    /index.html   200
```

このファイルはビルド時に `dist/_redirects` にコピーされ、Renderが自動的に読み込みます。

### 10.3 環境変数ファイルの作成（ローカル開発用）

#### バックエンド用

**ファイル**: `server/.env.development` （新規作成、Gitには含めない）

```env
PORT=4000
SESSION_SECRET=development-secret-key

YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_CLIENT_ID=your_google_client_id
YOUTUBE_CLIENT_SECRET=your_google_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:4000/auth/google/callback

TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=http://localhost:4000/auth/twitch/callback

ALLOWED_ORIGINS=http://localhost:5173
```

#### フロントエンド用

**ファイル**: `web/.env.development` （新規作成、Gitには含めない）

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
VITE_ENABLE_YOUTUBE=true
VITE_ENABLE_TWITCH=true
VITE_ENABLE_NICONICO=false
```

---

## 11. デプロイ後の動作確認

### 11.1 デプロイメントチェックリスト

デプロイ完了後、以下の項目を順番に確認してください。

#### ✅ バックエンドの確認

| 項目 | 確認方法 | 期待される結果 |
|-----|---------|--------------|
| **1. サービス起動** | Renderダッシュボードのログ確認 | `Server is running on port 4000` |
| **2. Health Check** | `curl https://fukumado-backend.onrender.com/api/health` | `{"status":"ok"}` |
| **3. StreamSync起動** | ログ確認 | `[StreamSync] Service started` |
| **4. Redis接続** | ログ確認 | `Redis connection established` または `using memory cache` |
| **5. CORS動作** | ブラウザ開発者ツール | CORSエラーが無い |

#### ✅ フロントエンドの確認

| 項目 | 確認方法 | 期待される結果 |
|-----|---------|--------------|
| **1. ページ表示** | ブラウザで https://fukumado-frontend.onrender.com にアクセス | 正常に表示される |
| **2. WebSocket接続** | 開発者ツール → コンソール | `[WebSocketService] Connected successfully` |
| **3. APIリクエスト** | Network タブ | `/api/*` リクエストが成功 (200 OK) |
| **4. OAuth認証** | ログインボタンクリック | 認証画面にリダイレクト → アプリに戻る |
| **5. 配信表示** | サイドバー確認 | フォローチャンネルの配信が表示される |

### 11.2 詳細な動作確認手順

#### ステップ1: バックエンドAPI疎通確認

ターミナルで以下のコマンドを実行:

```bash
# Health Check
curl https://fukumado-backend.onrender.com/api/health

# 期待される出力:
# {"status":"ok","timestamp":"2025-10-26T12:34:56.789Z","services":{"redis":"connected","streamSync":"running"}}
```

#### ステップ2: フロントエンド表示確認

1. ブラウザで `https://fukumado-frontend.onrender.com` を開く
2. 開発者ツール（F12）を開く
3. Consoleタブで以下のログを確認:

```
[WebSocketService] Establishing connection...
[WebSocketService] Connected successfully
[useStreamUpdates] Ensuring WebSocket connection...
[App] Followed channels loaded: { total: 0, youtube: 0, twitch: 0 }
```

#### ステップ3: YouTube OAuth 認証フロー確認

1. ヘッダーの「YouTube ログイン」ボタンをクリック
2. Google認証画面にリダイレクトされる
3. アカウントを選択して許可
4. アプリにリダイレクトされる（`https://fukumado-frontend.onrender.com/`）
5. ヘッダーにユーザー名とアイコンが表示される

**トラブル発生時の確認**:
- リダイレクトURIが正しく設定されているか（Google Cloud Console）
- `YOUTUBE_REDIRECT_URI` 環境変数が正しいか

#### ステップ4: Twitch OAuth 認証フロー確認

YouTube認証と同様の手順で確認。

#### ステップ5: 配信リストの表示確認

1. YouTubeまたはTwitchでログイン済みの状態
2. サイドバーの「配信リスト」を確認
3. フォローしているチャンネルの配信が表示される

**表示されない場合**:
- ブラウザのコンソールで以下を確認:
  ```
  [useStreamUpdates] Sending subscribe_streams message: { youtube: 10, twitch: 5, sessionId: "xxx" }
  [StreamSync] Syncing YouTube streams for 10 channels
  [StreamSync] Found 3 YouTube live streams
  ```

#### ステップ6: WebSocket配信更新確認

1. サイドバーで配信が表示されている状態
2. 新しい配信が開始されるのを待つ（またはテスト配信を開始）
3. 通知が表示されるか確認
4. サイドバーの配信リストが自動更新されるか確認

**ログ確認**:
```
[useStreamUpdates] Stream update received: { platform: 'youtube', count: 4, added: 1, removed: 0 }
[useStreamUpdates] New stream detected: チャンネル名 配信タイトル
```

#### ステップ7: 配信視聴の確認

1. サイドバーから配信を選択
2. グリッドに配信が割り当てられる
3. 配信が正常に再生されるか確認
4. 音量調整・ミュートが動作するか確認

#### ステップ8: データ使用量監視の確認

1. Footerの「データ使用状況」を確認
2. 配信視聴中にデータ量が増加するか確認

### 11.3 パフォーマンス確認

#### 応答時間の計測

```bash
# バックエンドAPI応答時間
time curl https://fukumado-backend.onrender.com/api/health

# 期待値: < 500ms (Singaporeリージョンの場合)
```

#### WebSocketレイテンシ確認

ブラウザ開発者ツール → Networkタブ → WSフィルタ:
- Ping/Pong間隔: 30秒
- レイテンシ: < 300ms

---

## 12. トラブルシューティング

### 12.1 一般的な問題と解決策

#### 問題1: バックエンドがビルドに失敗する

**症状**:
```
Error: Cannot find module 'express'
```

**原因**: `dependencies` が `devDependencies` に誤って配置されている

**解決策**:
`server/package.json` を確認し、本番環境で必要なパッケージが `dependencies` にあることを確認:

```json
{
  "dependencies": {
    "express": "^5.1.0",
    "ws": "^8.18.3",
    "dotenv": "^17.2.3",
    // ...
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "ts-node": "^10.9.2",
    // ...
  }
}
```

#### 問題2: フロントエンドがビルドに失敗する

**症状**:
```
[vite]: Rollup failed to resolve import "..." from "...".
```

**原因**: 存在しないファイルをimportしている、またはパスが間違っている

**解決策**:
1. エラーメッセージのファイルパスを確認
2. `web/src/` 内のファイルが正しく存在するか確認
3. import文のパスが正しいか確認（大文字小文字の違いに注意）

#### 問題3: WebSocket接続エラー

**症状**:
```
[WebSocketService] Error: WebSocket connection failed
```

**原因**: バックエンドURLが間違っている、またはCORS設定の問題

**解決策**:

1. **環境変数の確認**:
   ```env
   VITE_WS_URL=wss://fukumado-backend.onrender.com
   ```
   ※ `wss://` (セキュアWebSocket) であることを確認

2. **バックエンドのCORS設定**:
   ```typescript
   const allowedOrigins = ['https://fukumado-frontend.onrender.com'];
   ```

3. **WebSocketパスの確認**:
   ```typescript
   const WS_URL = `${config.wsUrl}/chat`; // '/chat' がバックエンドのWSパスと一致しているか
   ```

#### 問題4: OAuth認証後にリダイレクトされない

**症状**: 認証画面でアカウント選択後、エラーページに遷移

**原因**: リダイレクトURIの不一致

**解決策**:

1. **Google Cloud Console** で設定されているリダイレクトURI:
   ```
   https://fukumado-backend.onrender.com/auth/google/callback
   ```

2. **Render環境変数** の `YOUTUBE_REDIRECT_URI`:
   ```
   https://fukumado-backend.onrender.com/auth/google/callback
   ```

3. **両方が完全に一致**していることを確認（末尾のスラッシュ有無も含めて）

#### 問題5: 配信リストが表示されない

**症状**: ログイン後もサイドバーに配信が表示されない

**デバッグ手順**:

1. **ブラウザコンソールの確認**:
   ```
   [App] Followed channels loaded: { total: 0, youtube: 0, twitch: 0 }
   ```
   → フォローチャンネルが0の場合、購読同期に失敗している

2. **購読チャンネル取得の確認**:
   ```
   [App] Fetching YouTube subscriptions...
   [App] Adding YouTube subscribed channels: 10
   ```
   → このログが無い場合、OAuth認証に問題がある

3. **WebSocket subscribe_streams メッセージの確認**:
   ```
   [useStreamUpdates] Sending subscribe_streams message: { youtube: 10, twitch: 5, sessionId: "xxx" }
   ```
   → このログが無い場合、sessionIdが設定されていない

4. **バックエンドログの確認**:
   ```
   [StreamSync] User registered: user-xxx, YouTube: 10, Twitch: 5
   [StreamSync] Syncing YouTube streams for 10 channels
   [StreamSync] Found 3 YouTube live streams
   ```

#### 問題6: "Not allowed by CORS" エラー

**症状**:
```
Access to fetch at 'https://fukumado-backend.onrender.com/api/...' from origin 'https://fukumado-frontend.onrender.com' has been blocked by CORS policy
```

**解決策**:

バックエンドの環境変数 `ALLOWED_ORIGINS` にフロントエンドのURLを追加:

```env
ALLOWED_ORIGINS=https://fukumado-frontend.onrender.com
```

複数のオリジンを許可する場合:
```env
ALLOWED_ORIGINS=https://fukumado-frontend.onrender.com,https://fukumado.example.com
```

#### 問題7: Cookie が保存されない（認証状態が維持されない）

**症状**: ログイン後にページをリロードすると、再度ログインが必要

**原因**: Cookie の `SameSite` 設定の問題

**解決策**:

`server/src/index.ts` のセッション設定を確認:

```typescript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS必須
    httpOnly: true,
    sameSite: 'none', // クロスオリジンCookie許可
    maxAge: 24 * 60 * 60 * 1000
  }
}));
```

**重要**:
- `secure: true` → HTTPSでのみCookieを送信
- `sameSite: 'none'` → クロスオリジンリクエストでもCookieを送信
- この設定には HTTPS が必須

#### 問題8: Render の無料プランでサービスがスリープする

**症状**: しばらくアクセスしないと、次回アクセス時に起動に時間がかかる

**原因**: Renderの無料プランは15分間アクセスがないとサービスがスリープする

**解決策**:

1. **有料プランにアップグレード** ($7/月〜)
   - スリープしない
   - より高速な起動

2. **外部サービスでkeep-alive**（非推奨、規約違反の可能性）
   - UptimeRobotなどでHealth Checkを定期実行
   - **注意**: Renderの規約で禁止されている可能性があるため推奨しません

3. **ユーザーに初回ロード時間を案内**
   - スリープから復帰には30秒〜1分かかることをユーザーに説明

### 12.2 ログの確認方法

#### Renderダッシュボードでのログ確認

1. Render.com にログイン
2. 対象サービスを選択（fukumado-backend または fukumado-frontend）
3. 「Logs」タブをクリック
4. リアルタイムでログが表示される

**ログのフィルタリング**:
- 検索ボックスで特定の文字列を検索
- 例: `[StreamSync]`, `[WebSocket]`, `ERROR`

#### ログレベルの設定

バックエンドで環境変数 `LOG_LEVEL` を設定:

```env
LOG_LEVEL=debug  # 開発時: すべてのログを表示
LOG_LEVEL=info   # 本番環境: 通常の動作ログ
LOG_LEVEL=error  # 本番環境: エラーのみ
```

### 12.3 Renderサポートへの問い合わせ

解決できない問題が発生した場合:

1. Render ダッシュボード右下の「Help」アイコンをクリック
2. 問題の詳細とログを添えて問い合わせ
3. 通常24時間以内に返信がある

---

## 13. コスト試算

### 13.1 Render.com 料金プラン

| サービス | プラン | 月額 | 特徴 |
|---------|-------|------|------|
| **Web Service (Backend)** | Starter (Free) | $0 | 750時間/月、15分スリープ |
| | Starter | $7 | スリープなし、カスタムドメイン |
| | Standard | $25 | より高性能、オートスケーリング |
| **Static Site (Frontend)** | Free | $0 | 100GB転送/月 |
| | Starter | $19 | カスタムドメイン、プレビュー環境 |
| **Redis** | Free | $0 | 25MB、接続数制限 |
| | Starter | $10 | 256MB、十分な接続数 |

### 13.2 推奨プラン構成

#### 個人開発・テスト用（最小構成）

| サービス | プラン | 月額 |
|---------|-------|------|
| fukumado-backend | Starter (Free) | $0 |
| fukumado-frontend | Free | $0 |
| Redis | 無し（メモリキャッシュ） | $0 |
| **合計** | | **$0** |

**制約**:
- バックエンドが15分間アクセスなしでスリープ
- Redis無し（キャッシュがサーバー再起動で消失）

#### 小規模本番環境（推奨）

| サービス | プラン | 月額 |
|---------|-------|------|
| fukumado-backend | Starter | $7 |
| fukumado-frontend | Free | $0 |
| fukumado-redis | Starter | $10 |
| **合計** | | **$17** |

**利点**:
- スリープしない → 常時アクセス可能
- Redis永続化 → パフォーマンス向上
- カスタムドメイン利用可能

#### 中規模本番環境（高トラフィック対応）

| サービス | プラン | 月額 |
|---------|-------|------|
| fukumado-backend | Standard | $25 |
| fukumado-frontend | Starter | $19 |
| fukumado-redis | Standard | $25 |
| **合計** | | **$69** |

**利点**:
- オートスケーリング
- 高速レスポンス
- プレビュー環境（ステージング）

### 13.3 トラフィック試算

#### 想定ユーザー数とトラフィック

| ユーザー数 | 月間リクエスト数 | 推奨プラン |
|-----------|-----------------|-----------|
| 〜10人 | 〜10万リクエスト | Free |
| 10〜100人 | 10万〜100万リクエスト | Starter ($7) |
| 100〜1000人 | 100万〜1000万リクエスト | Standard ($25) |

**計算方法**:
```
月間リクエスト数 = ユーザー数 × 1日あたりの使用時間 × APIリクエスト頻度 × 30日

例: 50ユーザー × 2時間/日 × 10リクエスト/分 × 60分 × 30日 = 180万リクエスト
```

### 13.4 コスト最適化のヒント

1. **開発環境は無料プラン**: GitHubブランチごとにプレビュー環境を作成せず、mainブランチのみデプロイ
2. **Redisの適切なサイジング**: 配信リスト程度なら256MBで十分
3. **CDNの活用**: Renderの Static Site は CloudFlare CDN を自動で使用するため追加コスト不要
4. **モニタリング**: Renderのメトリクスでトラフィックを監視し、必要に応じてプランを調整

---

## 14. render.yaml（オプション）

プロジェクト全体の設定を一元管理できる `render.yaml` を作成すると、複数サービスの一括デプロイが可能です。

### 14.1 render.yaml の作成

**ファイル**: `render.yaml` （プロジェクトルートに配置）

```yaml
# Render.com 設定ファイル
# https://render.com/docs/infrastructure-as-code

services:
  # バックエンド Web Service
  - type: web
    name: fukumado-backend
    runtime: node
    region: singapore
    plan: starter
    branch: main
    rootDir: server
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: PORT
        value: 4000
      - key: NODE_ENV
        value: production
      - key: SESSION_SECRET
        generateValue: true # ランダム値を自動生成
      - key: YOUTUBE_API_KEY
        sync: false # 手動で設定する必要がある
      - key: YOUTUBE_CLIENT_ID
        sync: false
      - key: YOUTUBE_CLIENT_SECRET
        sync: false
      - key: YOUTUBE_REDIRECT_URI
        value: https://fukumado-backend.onrender.com/auth/google/callback
      - key: TWITCH_CLIENT_ID
        sync: false
      - key: TWITCH_CLIENT_SECRET
        sync: false
      - key: TWITCH_REDIRECT_URI
        value: https://fukumado-backend.onrender.com/auth/twitch/callback
      - key: ALLOWED_ORIGINS
        value: https://fukumado-frontend.onrender.com
      # Redis URL は Redis サービス作成後に手動で設定
      - key: REDIS_URL
        fromService:
          type: redis
          name: fukumado-redis
          property: connectionString

  # フロントエンド Static Site
  - type: web
    name: fukumado-frontend
    runtime: static
    region: singapore
    plan: free
    branch: main
    rootDir: web
    buildCommand: npm install && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_BASE_URL
        value: https://fukumado-backend.onrender.com
      - key: VITE_WS_URL
        value: wss://fukumado-backend.onrender.com
      - key: VITE_ENABLE_YOUTUBE
        value: true
      - key: VITE_ENABLE_TWITCH
        value: true
      - key: VITE_ENABLE_NICONICO
        value: false

# Redis
databases:
  - name: fukumado-redis
    plan: starter
    region: singapore
    maxmemoryPolicy: allkeys-lru
```

### 14.2 render.yaml を使ったデプロイ

1. `render.yaml` をリポジトリルートに配置
2. Render ダッシュボードで「New」→「Blueprint」
3. リポジトリを選択
4. `render.yaml` が自動検出される
5. 「Apply」をクリック
6. 全サービスが一括デプロイされる

**利点**:
- 設定のバージョン管理が可能
- 複数環境（staging, production）の管理が容易
- チームメンバーとの設定共有が簡単

---

## 15. デプロイ後の運用・メンテナンス

### 15.1 継続的デプロイ（CD）

Renderは Git プッシュで自動デプロイされます:

```bash
# コード修正後
git add .
git commit -m "feat: 新機能追加"
git push origin main

# Render が自動的に検出してデプロイ開始
```

**デプロイトリガー**:
- `main` ブランチへのプッシュ（デフォルト）
- 環境変数の変更
- 手動デプロイ（Render ダッシュボードから）

### 15.2 ロールバック

問題が発生した場合、Render で簡単にロールバック可能:

1. Render ダッシュボードでサービスを選択
2. 「Deploys」タブをクリック
3. 以前のデプロイバージョンを選択
4. 「Redeploy」をクリック

### 15.3 モニタリング

#### Render 標準メトリクス

Renderダッシュボードの「Metrics」タブで以下を確認:

- **CPU使用率**
- **メモリ使用率**
- **リクエスト数/秒**
- **レスポンス時間**
- **エラー率**

#### カスタムモニタリング（推奨）

本番環境では外部モニタリングサービスの導入を推奨:

| サービス | 用途 | 料金 |
|---------|------|------|
| **Sentry** | エラートラッキング | Free tier あり |
| **LogRocket** | セッションリプレイ | Free tier あり |
| **UptimeRobot** | 死活監視 | Free tier あり |

### 15.4 バックアップ

#### データのバックアップ

- **Redis**: Render の Redisは自動バックアップされる（有料プランのみ）
- **ユーザーデータ**: セッション情報のみ（永続化不要）
- **設定**: `render.yaml` と環境変数のバックアップを推奨

#### 設定のバックアップ

```bash
# 環境変数をエクスポート（Render CLI使用）
render env pull fukumado-backend > .env.backup

# または手動でコピー
```

### 15.5 セキュリティアップデート

定期的に依存パッケージを更新:

```bash
# バックエンド
cd server
npm audit
npm update

# フロントエンド
cd web
npm audit
npm update

# 重大な脆弱性がある場合
npm audit fix
```

---

## 16. まとめ

### 16.1 デプロイフロー全体像

```
┌─────────────────────────────────────────────────┐
│ 1. 事前準備                                      │
│    - OAuth認証情報の準備                         │
│    - 環境変数の収集                             │
│    - コード修正                                 │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. バックエンドデプロイ                          │
│    - Web Service 作成                            │
│    - 環境変数設定                               │
│    - デプロイ実行                               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Redis セットアップ（オプション）              │
│    - Redis サービス作成                          │
│    - バックエンドに接続情報を追加               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. フロントエンドデプロイ                        │
│    - Static Site 作成                            │
│    - 環境変数設定                               │
│    - デプロイ実行                               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 5. 動作確認                                      │
│    - API疎通確認                                │
│    - WebSocket接続確認                          │
│    - OAuth認証フロー確認                        │
│    - 配信表示確認                               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 6. 本番運用開始                                  │
│    - モニタリング設定                           │
│    - ログ監視                                   │
│    - 定期アップデート                           │
└─────────────────────────────────────────────────┘
```

### 16.2 チェックリスト

デプロイ前の最終確認:

- [ ] OAuth リダイレクトURIを両プラットフォームで設定
- [ ] 環境変数を全て準備（SESSION_SECRET含む）
- [ ] CORSの修正を実施
- [ ] セッションCookieの設定を修正
- [ ] WebSocketServiceのURL環境変数化
- [ ] API呼び出しのURL環境変数化
- [ ] `_redirects` ファイルを作成
- [ ] `.gitignore` で `.env` を除外
- [ ] Health Check エンドポイントを実装

### 16.3 推奨される次のステップ

デプロイ完了後、以下の改善を検討:

1. **カスタムドメインの設定**: `fukumado.example.com` など
2. **Redisの導入**: パフォーマンス向上
3. **エラートラッキングの導入**: Sentryなど
4. **アナリティクス**: Google Analyticsなど
5. **有料プランへのアップグレード**: スリープ対策

---

## 17. 参考リンク

### 17.1 公式ドキュメント

- **Render.com**: https://render.com/docs
- **Render Blueprint (render.yaml)**: https://render.com/docs/infrastructure-as-code
- **Render Environment Variables**: https://render.com/docs/environment-variables
- **YouTube Data API v3**: https://developers.google.com/youtube/v3
- **Twitch API**: https://dev.twitch.tv/docs/api
- **Vite Environment Variables**: https://vitejs.dev/guide/env-and-mode.html

### 17.2 関連する技術記事

- Render.com でのNode.jsアプリデプロイ
- WebSocketのHTTPS/WSS対応
- React + Vite での環境変数管理
- OAuth 2.0 の実装ベストプラクティス

---

**実装計画書 終わり**

ご質問やサポートが必要な場合は、Render.com のサポート、または本プロジェクトのメンテナーにお問い合わせください。
