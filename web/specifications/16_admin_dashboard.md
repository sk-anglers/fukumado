# 16. 管理用ダッシュボード（Admin Dashboard）

## 16.1 概要

### 16.1.1 目的

**ふくまど！管理用ダッシュボード**は、本サービス（ふくまど！）の運用状況を監視・管理するための管理者専用Webアプリケーションです。

主な目的：
- システムの稼働状況をリアルタイムで監視
- ユーザー管理とセキュリティ監視
- 配信データとEventSubの管理
- キャッシュとデータベースの管理
- ログとエラーの追跡
- メンテナンスモードの制御

### 16.1.2 主要機能（15タブ）

1. **ダッシュボード（Dashboard）** 📊
   - システム概要の表示
   - リアルタイム統計情報
   - 稼働状況サマリー
   - 主要メトリクスの可視化

2. **PV統計（PV Stats）** 📈
   - ページビュー統計の表示
   - 日次/週次/月次のアクセス数
   - ユニークユーザー数
   - リアルタイムアクセス状況

3. **アナリティクス（Analytics）** 📉
   - ユーザー行動分析
   - ボタンクリック追跡
   - セッション分析
   - コンバージョン追跡

4. **システム管理（System）** 💻
   - サーバー稼働状況の監視
   - リソース使用状況（CPU、メモリ、ディスク）
   - アプリケーションバージョン情報
   - 環境変数の確認

5. **サーバー監視（ServerMonitor）** 🖥️
   - サーバーリソースの詳細監視
   - プロセス管理
   - ネットワーク統計
   - パフォーマンスメトリクス

6. **セキュリティ（Security）** 🔒
   - ログイン履歴の追跡
   - 不正アクセス試行の検出
   - IPアドレスブロッキング
   - セキュリティイベントの監視
   - リアルタイム攻撃検知

7. **配信管理（Streams）** 📺
   - アクティブ配信の一覧
   - 配信統計情報
   - 配信者ランキング
   - 配信履歴

8. **ユーザー管理（Users）** 👥
   - ユーザー一覧と詳細情報
   - 認証状態の確認
   - ユーザーアクティビティ追跡
   - アカウント管理

9. **ログ閲覧（Logs）** 📋
   - アプリケーションログの表示
   - エラーログの追跡
   - アクセスログの分析
   - ログレベルフィルタリング

10. **監査ログ（AuditLogs）** 📜
    - 管理者操作の記録と追跡
    - 操作履歴の検索とフィルタリング
    - 監査ログのエクスポート
    - セキュリティコンプライアンス

11. **アラート（Alerts）** 🔔
    - システムアラートの管理
    - アラート通知設定
    - 重要度別フィルタリング
    - アラート確認と解決

12. **EventSub管理（EventSub）** 📡
    - Twitch EventSub接続状況の監視
    - 購読チャンネルの管理
    - 接続統計とキャパシティ情報
    - EventSub認証管理
    - Conduit統合状態の確認

13. **キャッシュ/DB（Cache）** 💾
    - Redisキャッシュの状態確認
    - キャッシュキーの検索と削除
    - キャッシュヒット率の分析
    - メモリ使用量の監視
    - データベース接続状態

14. **API監視（API Monitor）** 🌐
    - Twitch APIレート制限状況
    - YouTube API クォータ使用状況
    - API呼び出し統計
    - エラー率の監視

15. **メンテナンス（Maintenance）** 🔧
    - メンテナンスモードの切り替え
    - メンテナンス通知のカスタマイズ
    - データベースマイグレーション
    - システム再起動

### 16.1.3 技術スタック

#### フロントエンド（admin-web）
- **React 18.3.1** + **TypeScript 5.9.3**: 型安全なUI開発
- **React Router 7.5.1**: SPA routing
- **CSS Modules**: スコープ化されたスタイリング
- **Vite 6.2.2**: 高速ビルドツール

#### バックエンド（admin-server）
- **Express 5.1.0**: APIサーバー
- **TypeScript 5.9.3**: 型安全な開発
- **Basic Authentication**: 管理者認証
- **Redis**: セッション管理とキャッシング
- **dotenv**: 環境変数管理

#### 通信プロトコル
- **REST API**: 管理操作とデータ取得
- **HTTP Basic Auth**: 管理者認証
- **CORS**: クロスオリジンリクエスト制御

### 16.1.4 アーキテクチャパターン

```
┌─────────────────┐
│   admin-web     │  React SPA (Port 5174)
│  (Frontend UI)  │  - ユーザーインターフェース
└────────┬────────┘  - 認証管理
         │ HTTP Basic Auth + REST API
         │
┌────────▼────────┐
│  admin-server   │  Express API (Port 4001)
│  (Proxy Layer)  │  - 認証レイヤー
└────────┬────────┘  - リクエストプロキシ
         │ Internal HTTP
         │
┌────────▼────────┐
│     server      │  Main Backend (Port 4000)
│ (Main Backend)  │  - ビジネスロジック
└─────────────────┘  - データアクセス
```

**3層アーキテクチャの利点：**
1. **セキュリティの分離**: 管理機能を本サービスから分離
2. **認証レイヤー**: admin-serverで認証を一元管理
3. **負荷分散**: 管理操作が本サービスに影響を与えない
4. **独立したデプロイメント**: 管理ダッシュボードを独立してデプロイ可能

---

## 16.2 アーキテクチャ

### 16.2.1 全体構成

```
┌──────────────────────────────────────────────────────────────┐
│                        管理者ブラウザ                          │
│  http://localhost:5174 (admin-web)                            │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ HTTP Basic Auth
                            │ username: admin
                            │ password: [ADMIN_PASSWORD]
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                      admin-server                             │
│  Port: 4001                                                   │
│  - Basic認証ミドルウェア                                       │
│  - CORSミドルウェア                                            │
│  - プロキシルーティング (/api/admin/* → server:4000)          │
│  - Twitch OAuth (unused, proxy pattern adopted)              │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ Internal HTTP
                            │ Basic Auth Forwarded
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                         server                                │
│  Port: 4000                                                   │
│  - /api/admin/* エンドポイント                                │
│  - EventSubManager                                            │
│  - StreamSyncService                                          │
│  - WebSocket Server                                           │
│  - Redis Cache                                                │
│  - Database Access                                            │
└───────────────────────────────────────────────────────────────┘
```

### 16.2.2 認証フロー

#### Basic認証フロー
```
1. ユーザーが admin-web にアクセス
   ↓
2. App.tsx が localStorage をチェック
   - admin_username が存在しない → Login.tsx を表示
   ↓
3. ユーザーが認証情報を入力
   ↓
4. apiClient.login() を呼び出し
   ↓
5. admin-server が認証情報を検証
   - ADMIN_USERNAME と ADMIN_PASSWORD を照合
   ↓
6. 成功時: localStorage に認証情報を保存
   失敗時: エラーメッセージを表示
   ↓
7. 以降のAPI呼び出しに Basic Auth ヘッダーを付与
```

#### Twitch OAuth フロー（EventSub用）
```
1. EventSub管理画面で「Twitchログイン」ボタンをクリック
   ↓
2. 本サービス（server:4000）の /auth/twitch?admin=true にリダイレクト
   ↓
3. server が admin=true パラメータを検出
   - req.session.isAdminAuth = true を保存
   ↓
4. Twitch OAuth 画面にリダイレクト
   ↓
5. ユーザーが認証を承認
   ↓
6. Twitch が /auth/twitch/callback にリダイレクト
   ↓
7. server が認証コードをトークンに交換
   ↓
8. isAdminAuth フラグをチェック
   - true の場合: EventSubManager に認証情報を送信
   ↓
9. admin-web の /eventsub?twitch_auth=success にリダイレクト
   ↓
10. admin-web がパラメータを検出して成功メッセージを表示
```

**Proxy Pattern の理由：**
- Twitch Developer Console で複数のリダイレクトURIを登録した場合、最初のURIが優先される
- `http://localhost:4000/auth/twitch/callback` が先に登録されていたため
- 新しいTwitchアプリを作成しても、EventSubは元のClient IDに紐づいているため不可
- 解決策：本サービスをOAuthプロキシとして使用し、`admin=true`パラメータで分岐

### 16.2.3 データフロー

#### 読み取り操作（GET）
```
admin-web → admin-server → server → Redis/DB
            ↓
        Basic Auth 検証
            ↓
        Authorization Header 転送
            ↓
        レスポンスを返却
```

#### 書き込み操作（POST/PUT/DELETE）
```
admin-web → admin-server → server → Redis/DB
            ↓                ↓
        Basic Auth 検証    データ検証
            ↓                ↓
        Authorization    ビジネスロジック実行
            ↓                ↓
        レスポンス返却   状態更新
```

### 16.2.4 セキュリティ層

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Basic Authentication (admin-server)       │
│  - ユーザー名とパスワードの検証                     │
│  - 401 エラー時の自動ログアウト                     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 2: CORS (admin-server)                       │
│  - 許可オリジン: http://localhost:5174              │
│  - 許可メソッド: GET, POST, PUT, DELETE, OPTIONS    │
│  - 認証情報の送信: true                             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 3: Internal Network (admin-server → server)  │
│  - localhost 内部通信のみ                           │
│  - 外部からの直接アクセス不可                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Layer 4: API Authorization (server)                │
│  - /api/admin/* エンドポイントのアクセス制御        │
└─────────────────────────────────────────────────────┘
```

---

## 16.3 ディレクトリ構成

### 16.3.1 admin-web（フロントエンド）

```
C:\Users\s_kus\開発\admin-web\
├── src/
│   ├── components/
│   │   ├── common/              # 共通コンポーネント
│   │   │   ├── Layout.tsx       # レイアウトフレーム
│   │   │   ├── Layout.module.css
│   │   │   ├── Sidebar.tsx      # サイドバーナビゲーション
│   │   │   └── Sidebar.module.css
│   │   └── pages/               # ページコンポーネント
│   │       ├── Dashboard.tsx    # ダッシュボードページ
│   │       ├── Dashboard.module.css
│   │       ├── PVStats.tsx      # PV統計ページ
│   │       ├── PVStats.module.css
│   │       ├── Analytics.tsx    # アナリティクスページ
│   │       ├── Analytics.module.css
│   │       ├── System.tsx       # システムページ
│   │       ├── System.module.css
│   │       ├── Security.tsx     # セキュリティページ
│   │       ├── Security.module.css
│   │       ├── Streams.tsx      # 配信管理ページ
│   │       ├── Streams.module.css
│   │       ├── Users.tsx        # ユーザー管理ページ
│   │       ├── Users.module.css
│   │       ├── Logs.tsx         # ログ閲覧ページ
│   │       ├── Logs.module.css
│   │       ├── EventSub.tsx     # EventSub管理ページ
│   │       ├── EventSub.module.css
│   │       ├── Cache.tsx        # キャッシュ/DBページ
│   │       ├── Cache.module.css
│   │       ├── ApiMonitor.tsx   # API監視ページ
│   │       ├── ApiMonitor.module.css
│   │       ├── Maintenance.tsx  # メンテナンスページ
│   │       ├── Maintenance.module.css
│   │       └── index.ts         # ページエクスポート
│   ├── services/
│   │   └── apiClient.ts         # APIクライアント
│   ├── types/
│   │   └── index.ts             # 型定義
│   ├── App.tsx                  # ルートコンポーネント
│   ├── App.css
│   ├── main.tsx                 # エントリーポイント
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts               # Vite設定
```

### 16.3.2 admin-server（バックエンドプロキシ）

```
C:\Users\s_kus\開発\admin-server\
├── src/
│   ├── config/
│   │   └── env.ts               # 環境変数設定
│   ├── middleware/
│   │   ├── auth.ts              # Basic認証ミドルウェア
│   │   └── cors.ts              # CORSミドルウェア
│   ├── routes/
│   │   └── auth.ts              # Twitch OAuth（未使用）
│   ├── index.ts                 # エントリーポイント
│   └── types.ts                 # 型定義
├── .env                         # 環境変数
├── package.json
└── tsconfig.json
```

### 16.3.3 server（メインバックエンド - 管理API部分）

```
C:\Users\s_kus\開発\server\
├── src/
│   ├── routes/
│   │   ├── auth.ts              # 認証ルート（Twitch OAuth Proxy含む）
│   │   └── eventsub.ts          # EventSub管理API
│   ├── services/
│   │   ├── twitchEventSubManager.ts  # EventSub管理サービス
│   │   └── twitchAppAuth.ts     # Twitch App認証
│   └── index.ts                 # サーバーエントリーポイント
```

---

## 16.4 データモデル

### 16.4.1 EventSub統計情報

**型定義（`admin-web/src/types/index.ts`）:**

```typescript
export interface EventSubStatsResponse {
  success: boolean;
  data: {
    stats: {
      totalConnections: number;          // 総接続数
      activeConnections: number;         // アクティブ接続数
      totalSubscriptions: number;        // 総購読数
      subscribedChannelCount: number;    // 購読チャンネル数
      connections: Array<{
        index: number;                   // 接続インデックス（0-2）
        status: string;                  // 接続状態
        subscriptionCount: number;       // 購読数
        sessionId: string | null;        // セッションID
        connectedAt: string | null;      // 接続時刻
      }>;
    };
    capacity: {
      total: number;                     // 総容量（300）
      used: number;                      // 使用容量
      available: number;                 // 残り容量
      percentage: number;                // 使用率（%）
    };
  };
  timestamp: string;
}
```

**APIエンドポイント:**
```
GET /api/admin/eventsub/stats
```

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalConnections": 3,
      "activeConnections": 3,
      "totalSubscriptions": 6,
      "subscribedChannelCount": 3,
      "connections": [
        {
          "index": 0,
          "status": "connected",
          "subscriptionCount": 2,
          "sessionId": "AQoQILE7VHoLQ...",
          "connectedAt": "2025-10-27T10:30:45.123Z"
        }
      ]
    },
    "capacity": {
      "total": 300,
      "used": 6,
      "available": 294,
      "percentage": 2.0
    }
  },
  "timestamp": "2025-10-27T10:35:00.000Z"
}
```

### 16.4.2 EventSub購読情報

**型定義:**

```typescript
export interface EventSubSubscriptionsResponse {
  success: boolean;
  data: {
    totalChannels: number;               // 総チャンネル数
    channelIds: string[];                // チャンネルID配列
    subscriptions: Array<{
      connectionIndex: number;           // 接続インデックス
      status: string;                    // 接続状態
      sessionId: string | null;          // セッションID
      subscriptionCount: number;         // 購読数
      subscribedUserIds: string[];       // 購読ユーザーID
    }>;
  };
  timestamp: string;
}
```

**APIエンドポイント:**
```
GET /api/admin/eventsub/subscriptions
```

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "totalChannels": 3,
    "channelIds": ["123456789", "987654321", "555555555"],
    "subscriptions": [
      {
        "connectionIndex": 0,
        "status": "connected",
        "sessionId": "AQoQILE7VHoLQ...",
        "subscriptionCount": 2,
        "subscribedUserIds": ["123456789", "987654321"]
      }
    ]
  },
  "timestamp": "2025-10-27T10:35:00.000Z"
}
```

### 16.4.3 認証情報

**ログイン要求:**
```typescript
interface LoginRequest {
  username: string;
  password: string;
}
```

**ログイン応答:**
```typescript
interface LoginResponse {
  success: boolean;
  message: string;
}
```

---

## 16.5 認証とセキュリティ

### 16.5.1 Basic認証

#### 設定（`admin-server/.env`）

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=AdminPassword123456!@$%
```

**注意事項:**
- パスワードに `#` 記号を含めないこと（dotenvがコメントとして解釈）
- 最低16文字以上を推奨
- 本番環境では強力なランダムパスワードを使用

#### 実装（`admin-server/src/middleware/auth.ts`）

```typescript
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function basicAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (username === env.adminUsername && password === env.adminPassword) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    res.status(401).json({ error: 'Invalid credentials' });
  }
}
```

#### フロントエンド実装（`admin-web/src/services/apiClient.ts`）

```typescript
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const username = localStorage.getItem('admin_username');
  const password = localStorage.getItem('admin_password');

  if (!username || !password) {
    throw new Error('Not authenticated');
  }

  const auth = btoa(`${username}:${password}`);

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('auth-error'));
      throw new Error('Authentication failed');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
```

### 16.5.2 自動ログアウト機構

**実装（`admin-web/src/App.tsx`）:**

```typescript
useEffect(() => {
  const handleAuthError = () => {
    console.warn('[Auth] Authentication failed, logging out...');
    setIsAuthenticated(false);
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_password');
  };

  window.addEventListener('auth-error', handleAuthError);

  return () => {
    window.removeEventListener('auth-error', handleAuthError);
  };
}, []);
```

**動作:**
1. APIクライアントが401エラーを受信
2. `auth-error` イベントを発火
3. App.tsx がイベントをキャッチ
4. 認証状態をクリア
5. ログイン画面を表示

### 16.5.3 CORS設定

**実装（`admin-server/src/middleware/cors.ts`）:**

```typescript
import cors from 'cors';

export const corsMiddleware = cors({
  origin: 'http://localhost:5174',  // admin-webのURL
  credentials: true,                 // 認証情報の送信を許可
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});
```

### 16.5.4 環境変数検証

**実装（`admin-server/src/config/env.ts`）:**

```typescript
const requiredEnvVars = [
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'MAIN_BACKEND_URL'
] as const;

// 環境変数の存在確認
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

// パスワードの強度チェック
if (env.adminPassword.length < 16) {
  throw new Error('ADMIN_PASSWORD must be at least 16 characters');
}
```

---

## 16.6 コンポーネント

### 16.6.1 Layout（`components/common/Layout.tsx`）

**責務:**
- 全ページ共通のレイアウトフレーム
- サイドバーとメインコンテンツの配置

**構造:**
```typescript
export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
};
```

### 16.6.2 Sidebar（`components/common/Sidebar.tsx`）

**責務:**
- ナビゲーションメニューの表示
- 現在のページのハイライト

**ナビゲーション項目:**
```typescript
const navItems: NavItem[] = [
  { id: 'dashboard', label: 'ダッシュボード', path: '/', icon: '📊' },
  { id: 'pv-stats', label: 'PV統計', path: '/pv-stats', icon: '📈' },
  { id: 'analytics', label: 'アナリティクス', path: '/analytics', icon: '📉' },
  { id: 'system', label: 'システム', path: '/system', icon: '💻' },
  { id: 'server-monitor', label: 'サーバ監視', path: '/server-monitor', icon: '🖥️' },
  { id: 'security', label: 'セキュリティ', path: '/security', icon: '🔒' },
  { id: 'streams', label: '配信管理', path: '/streams', icon: '📺' },
  { id: 'users', label: 'ユーザー管理', path: '/users', icon: '👥' },
  { id: 'logs', label: 'ログ閲覧', path: '/logs', icon: '📋' },
  { id: 'audit-logs', label: '監査ログ', path: '/audit-logs', icon: '📜' },
  { id: 'alerts', label: 'アラート', path: '/alerts', icon: '🔔' },
  { id: 'eventsub', label: 'EventSub管理', path: '/eventsub', icon: '📡' },
  { id: 'cache', label: 'キャッシュ/DB', path: '/cache', icon: '💾' },
  { id: 'api-monitor', label: 'API監視', path: '/api-monitor', icon: '🌐' },
  { id: 'maintenance', label: 'メンテナンス', path: '/maintenance', icon: '🔧' }
];
```

### 16.6.3 Dashboard（`components/pages/Dashboard.tsx`）

**責務:**
- システム全体のサマリー表示
- 重要指標のダッシュボード

**現在の実装:**
```typescript
export const Dashboard: React.FC = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>管理ダッシュボード</h1>
      <p className={styles.subtitle}>システムの稼働状況を確認できます</p>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>システム状態</h2>
          <div className={styles.status}>🟢 正常稼働中</div>
        </div>

        <div className={styles.card}>
          <h2>クイックアクション</h2>
          <Link to="/eventsub" className={styles.link}>
            EventSub管理へ →
          </Link>
        </div>
      </div>
    </div>
  );
};
```

### 16.6.4 EventSub（`components/pages/EventSub.tsx`）

**責務:**
- EventSub接続状況の表示
- 購読チャンネルの管理
- Twitch認証の管理

**主要機能:**

1. **統計カード表示**
```typescript
<div className={styles.statsGrid}>
  <div className={styles.statCard}>
    <div className={styles.statLabel}>総接続数</div>
    <div className={styles.statValue}>{statsData.stats.totalConnections}</div>
    <div className={styles.statSubtext}>
      アクティブ: {statsData.stats.activeConnections}
    </div>
  </div>
  {/* 他の統計カード */}
</div>
```

2. **接続状況表示**
```typescript
<div className={styles.connectionsGrid}>
  {statsData.stats.connections.map((conn) => (
    <div key={conn.index} className={styles.connectionCard}>
      <div className={styles.connectionHeader}>
        <span className={styles.connectionIndex}>接続 #{conn.index}</span>
        <span className={`${styles.connectionStatus} ${styles[conn.status]}`}>
          {conn.status}
        </span>
      </div>
      {/* 接続詳細 */}
    </div>
  ))}
</div>
```

3. **Twitchログインボタン**
```typescript
const handleTwitchLogin = () => {
  // 本サービス経由で認証（admin=trueパラメータを付与）
  window.location.href = 'http://localhost:4000/auth/twitch?admin=true';
};

{twitchUsername ? (
  <div className={styles.twitchStatus}>
    🟢 {twitchUsername}
  </div>
) : (
  <button onClick={handleTwitchLogin} className={styles.twitchLoginButton}>
    🔓 Twitchログイン
  </button>
)}
```

4. **購読解除機能**
```typescript
const handleUnsubscribe = async (userId: string) => {
  if (!confirm(`チャンネル ${userId} の購読を解除しますか?`)) {
    return;
  }

  try {
    await unsubscribeEventSub(userId);
    await loadData();  // データ再読み込み
  } catch (err) {
    console.error('Failed to unsubscribe:', err);
    alert('購読解除に失敗しました');
  }
};
```

5. **再接続機能**
```typescript
const handleReconnect = async () => {
  if (!confirm('EventSubを再接続しますか?')) {
    return;
  }

  try {
    await reconnectEventSub();
    await loadData();
  } catch (err) {
    console.error('Failed to reconnect:', err);
    alert('再接続に失敗しました');
  }
};
```

6. **自動更新**
```typescript
useEffect(() => {
  loadData();
  const interval = setInterval(loadData, 30000); // 30秒ごとに更新
  return () => clearInterval(interval);
}, []);
```

### 16.6.5 Login（`components/pages/Login.tsx`）

**責務:**
- 管理者ログインフォームの表示
- 認証エラーハンドリング

**実装:**
```typescript
export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>管理ダッシュボード</h1>
        <form onSubmit={handleSubmit}>
          {/* フォームフィールド */}
        </form>
      </div>
    </div>
  );
};
```

### 16.6.6 PVStats（`components/pages/PVStats.tsx`）

**責務:**
- ページビュー統計の表示
- 時系列グラフとトレンド分析
- 日次・週次・月次のPVデータ可視化

**主要機能:**
- リアルタイムPVカウント表示
- 期間別フィルタリング（日次、週次、月次）
- グラフ表示（折れ線グラフ、棒グラフ）
- CSV/JSONエクスポート機能

### 16.6.7 Analytics（`components/pages/Analytics.tsx`）

**責務:**
- ユーザー行動分析の表示
- イベントトラッキングデータの可視化
- ボタンクリック追跡とコンバージョン分析

**主要機能:**
- イベント別トラッキング統計
- ユーザーセッション分析
- コンバージョンファネル表示
- カスタムイベントフィルタリング

### 16.6.8 System（`components/pages/System.tsx`）

**責務:**
- システムメトリクスの表示
- サーバーヘルスチェック
- リソース使用状況のモニタリング

**主要機能:**
- CPU・メモリ使用率表示
- Redis接続状態
- WebSocket接続数
- アップタイム表示
- システムバージョン情報

### 16.6.9 Security（`components/pages/Security.tsx`）

**責務:**
- セキュリティイベントの監視
- 異常検知アラートの表示
- ブロックリスト管理

**主要機能:**
- 攻撃検知ログ表示
- レート制限違反の追跡
- IPブロックリスト管理
- セキュリティアラートの可視化
- 不正アクセス試行の統計

### 16.6.10 Streams（`components/pages/Streams.tsx`）

**責務:**
- 配信リストの管理
- 配信同期設定
- キャッシュ管理

**主要機能:**
- 現在配信中のチャンネル一覧
- 配信リストの手動同期
- キャッシュのクリアと更新
- プラットフォーム別フィルタリング（YouTube、Twitch、ニコニコ）
- 配信統計の表示

### 16.6.11 Users（`components/pages/Users.tsx`）

**責務:**
- ユーザー管理
- フォローチャンネル管理
- OAuth認証状態の確認

**主要機能:**
- 登録ユーザー一覧表示
- ユーザー別フォローチャンネル表示
- OAuth認証状態の確認
- ユーザーセッション管理
- ユーザー別アクティビティログ

### 16.6.12 Logs（`components/pages/Logs.tsx`）

**責務:**
- システムログの閲覧
- エラーログのフィルタリング
- ログレベル別表示

**主要機能:**
- リアルタイムログストリーミング
- ログレベルフィルタリング（ERROR、WARN、INFO、DEBUG）
- 時間範囲指定
- キーワード検索
- ログのエクスポート（JSON、テキスト）

### 16.6.13 Cache（`components/pages/Cache.tsx`）

**責務:**
- Redisキャッシュの管理
- データベース状態の確認
- キャッシュヒット率の監視

**主要機能:**
- Redis接続状態表示
- キャッシュキー一覧
- キャッシュヒット/ミス統計
- 個別キャッシュのクリア
- 全キャッシュのフラッシュ
- キャッシュTTL設定

### 16.6.14 ApiMonitor（`components/pages/ApiMonitor.tsx`）

**責務:**
- API呼び出し状況の監視
- レスポンスタイムの追跡
- エンドポイント別統計

**主要機能:**
- エンドポイント別リクエスト数
- 平均レスポンスタイム表示
- エラーレート監視
- レート制限状態の確認
- API使用量グラフ

### 16.6.15 Maintenance（`components/pages/Maintenance.tsx`）

**責務:**
- メンテナンスモードの管理
- メンテナンス通知の設定
- データベースマイグレーション

**主要機能:**
- メンテナンスモードのON/OFF切り替え
- メンテナンスメッセージの編集
- 予定終了時刻の設定
- バイパストークン生成
- データベースマイグレーション実行

### 16.6.16 ServerMonitor（`components/pages/ServerMonitor.tsx`）

**責務:**
- サーバーリソースの詳細監視
- プロセス情報の表示
- システムパフォーマンスの追跡

**主要機能:**
- CPU使用率の詳細表示
- メモリ使用状況の監視
- ディスクI/O統計
- ネットワーク統計
- プロセス一覧と管理
- システムアップタイム表示

### 16.6.17 AuditLogs（`components/pages/AuditLogs.tsx`）

**責務:**
- 管理者操作の記録と追跡
- セキュリティコンプライアンス
- 操作履歴の監査

**主要機能:**
- 監査ログ一覧表示（ページネーション付き）
- アクション別フィルタリング
- ステータス別フィルタリング（成功/失敗）
- 日時範囲指定
- ログ詳細表示（JSON形式）
- 監査ログのエクスポート
- 古いログの自動クリーンアップ

**データモデル:**
```typescript
interface AuditLog {
  id: string;
  action: string;         // 操作種別
  actor: string;          // 操作者
  actorIp: string;        // IPアドレス
  actorAgent?: string;    // User-Agent
  targetType: string;     // 対象種別
  targetId?: string;      // 対象ID
  details?: any;          // 詳細情報
  status: string;         // success/failure
  errorMessage?: string;  // エラーメッセージ
  createdAt: string;      // 作成日時
}
```

### 16.6.18 Alerts（`components/pages/Alerts.tsx`）

**責務:**
- システムアラートの管理
- アラート通知の設定
- アラートの確認と解決

**主要機能:**
- アラート一覧表示（ページネーション付き）
- タイプ別フィルタリング（CPU高、メモリ高、レート制限低等）
- 重要度別フィルタリング（info/warning/error/critical）
- ステータス別フィルタリング（未読/未解決/全て）
- アラートの確認（Acknowledge）
- アラートの解決（Resolve）
- アラート設定の管理
- 通知設定（メール/Slack/Webhook）

**データモデル:**
```typescript
interface Alert {
  id: string;
  type: string;           // cpu_high, memory_high等
  severity: string;       // info, warning, error, critical
  title: string;          // アラートタイトル
  message: string;        // アラートメッセージ
  details?: any;          // 詳細情報
  acknowledged: boolean;  // 確認済みフラグ
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolved: boolean;      // 解決済みフラグ
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AlertSetting {
  id: number;
  type: string;           // アラート種別
  enabled: boolean;       // 有効/無効
  threshold?: number;     // 閾値
  notifyEmail: boolean;   // メール通知
  notifySlack: boolean;   // Slack通知
  notifyWebhook: boolean; // Webhook通知
  createdAt: string;
  updatedAt: string;
}
```

---

## 16.7 API仕様

### 16.7.1 認証API

#### POST /api/admin/login

**目的:** 管理者認証

**リクエスト:**
```json
{
  "username": "admin",
  "password": "AdminPassword123456!@$%"
}
```

**レスポンス（成功）:**
```json
{
  "success": true,
  "message": "Login successful"
}
```

**レスポンス（失敗）:**
```json
{
  "error": "Invalid credentials"
}
```

**ステータスコード:**
- `200`: 成功
- `401`: 認証失敗

---

### 16.7.2 EventSub管理API

#### GET /api/admin/eventsub/stats

**目的:** EventSub統計情報の取得

**認証:** Basic Auth 必須

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalConnections": 3,
      "activeConnections": 3,
      "totalSubscriptions": 6,
      "subscribedChannelCount": 3,
      "connections": [
        {
          "index": 0,
          "status": "connected",
          "subscriptionCount": 2,
          "sessionId": "AQoQILE7VHoLQ...",
          "connectedAt": "2025-10-27T10:30:45.123Z"
        }
      ]
    },
    "capacity": {
      "total": 300,
      "used": 6,
      "available": 294,
      "percentage": 2.0
    }
  },
  "timestamp": "2025-10-27T10:35:00.000Z"
}
```

**実装（`server/src/routes/eventsub.ts:10-31`）:**
```typescript
eventsubRouter.get('/stats', async (req, res) => {
  try {
    const stats = twitchEventSubManager.getStats();
    const capacity = twitchEventSubManager.getCapacity();

    res.json({
      success: true,
      data: {
        stats,
        capacity
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EventSub] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
```

---

#### GET /api/admin/eventsub/subscriptions

**目的:** 購読チャンネル一覧の取得

**認証:** Basic Auth 必須

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "totalChannels": 3,
    "channelIds": ["123456789", "987654321", "555555555"],
    "subscriptions": [
      {
        "connectionIndex": 0,
        "status": "connected",
        "sessionId": "AQoQILE7VHoLQ...",
        "subscriptionCount": 2,
        "subscribedUserIds": ["123456789", "987654321"]
      }
    ]
  },
  "timestamp": "2025-10-27T10:35:00.000Z"
}
```

**実装（`server/src/routes/eventsub.ts:37-68`）:**
```typescript
eventsubRouter.get('/subscriptions', async (req, res) => {
  try {
    const channelIds = twitchEventSubManager.getSubscribedUserIds();
    const stats = twitchEventSubManager.getStats();

    const subscriptions = stats.connections.map((conn) => ({
      connectionIndex: conn.index,
      status: conn.status,
      sessionId: conn.sessionId,
      subscriptionCount: conn.subscriptionCount,
      subscribedUserIds: conn.subscribedUserIds
    }));

    res.json({
      success: true,
      data: {
        totalChannels: channelIds.length,
        channelIds,
        subscriptions
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EventSub] Error getting subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
```

---

#### DELETE /api/admin/eventsub/subscriptions/:userId

**目的:** 特定チャンネルの購読解除

**認証:** Basic Auth 必須

**パラメータ:**
- `userId`: TwitchユーザーID

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "userId": "123456789",
    "unsubscribed": true
  },
  "timestamp": "2025-10-27T10:35:00.000Z"
}
```

**実装（`server/src/routes/eventsub.ts:74-97`）:**
```typescript
eventsubRouter.delete('/subscriptions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    await twitchEventSubManager.unsubscribeChannel(userId);
    console.log(`[EventSub] Unsubscribed channel: ${userId}`);

    res.json({
      success: true,
      data: {
        userId,
        unsubscribed: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[EventSub] Error unsubscribing channel:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
```

---

#### POST /api/admin/eventsub/reconnect

**目的:** 全接続の再接続

**認証:** Basic Auth 必須

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "reconnected": true
  },
  "timestamp": "2025-10-27T10:35:00.000Z"
}
```

**実装（`server/src/routes/eventsub.ts:103-123`）:**
```typescript
eventsubRouter.post('/reconnect', async (req, res) => {
  try {
    console.log('[EventSub] Reconnecting all connections...');
    await twitchEventSubManager.reconnectAll();

    res.json({
      success: true,
      data: {
        reconnected: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EventSub] Error reconnecting:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
```

---

#### POST /api/admin/eventsub/subscribe

**目的:** チャンネルの購読（テスト用）

**認証:** Basic Auth 必須

**リクエスト:**
```json
{
  "userId": "123456789"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "userId": "123456789",
    "subscribed": true
  },
  "timestamp": "2025-10-27T10:35:00.000Z"
}
```

**実装（`server/src/routes/eventsub.ts:130-161`）:**
```typescript
eventsubRouter.post('/subscribe', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[EventSub] Subscribing to user: ${userId}`);
    await twitchEventSubManager.subscribeToUsers([userId]);

    res.json({
      success: true,
      data: {
        userId,
        subscribed: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[EventSub] Error subscribing to user:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
```

---

### 16.7.3 監査ログ管理API

#### GET /api/admin/audit-logs

**目的:** 監査ログ一覧の取得

**認証:** Basic Auth 必須

**クエリパラメータ:**
- `action` (optional): アクション種別でフィルター
- `status` (optional): ステータスでフィルター（success/failure）
- `limit` (optional): 取得件数（デフォルト: 50）
- `offset` (optional): オフセット（デフォルト: 0）

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "123456",
        "action": "maintenance_enabled",
        "actor": "admin",
        "actorIp": "192.168.1.1",
        "actorAgent": "Mozilla/5.0...",
        "targetType": "maintenance",
        "targetId": null,
        "details": {
          "message": "システムメンテナンス実施中"
        },
        "status": "success",
        "errorMessage": null,
        "createdAt": "2025-11-04T10:00:00.000Z"
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

#### GET /api/admin/audit-logs/summary

**目的:** 監査ログのサマリー情報取得

**認証:** Basic Auth 必須

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "totalLogs": 150,
    "successCount": 145,
    "failureCount": 5,
    "recentActions": [
      { "action": "maintenance_enabled", "count": 10 },
      { "action": "cache_cleared", "count": 25 }
    ],
    "topActors": [
      { "actor": "admin", "count": 100 }
    ]
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

#### POST /api/admin/audit-logs/cleanup

**目的:** 古い監査ログの削除

**認証:** Basic Auth 必須

**リクエスト:**
```json
{
  "days": 30
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "deletedCount": 50
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

### 16.7.4 アラート管理API

#### GET /api/admin/alerts

**目的:** アラート一覧の取得

**認証:** Basic Auth 必須

**クエリパラメータ:**
- `type` (optional): アラートタイプでフィルター
- `severity` (optional): 重要度でフィルター
- `acknowledged` (optional): 確認済みフラグでフィルター
- `resolved` (optional): 解決済みフラグでフィルター
- `limit` (optional): 取得件数（デフォルト: 50）
- `offset` (optional): オフセット（デフォルト: 0）

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "789",
        "type": "cpu_high",
        "severity": "warning",
        "title": "CPU使用率が高くなっています",
        "message": "CPU使用率が85%に達しました",
        "details": {
          "cpuUsage": 85.5,
          "timestamp": "2025-11-04T09:55:00.000Z"
        },
        "acknowledged": false,
        "acknowledgedAt": null,
        "acknowledgedBy": null,
        "resolved": false,
        "resolvedAt": null,
        "createdAt": "2025-11-04T09:55:00.000Z",
        "updatedAt": "2025-11-04T09:55:00.000Z"
      }
    ],
    "total": 25,
    "limit": 50,
    "offset": 0
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

#### GET /api/admin/alerts/unread-count

**目的:** 未読アラート数の取得

**認証:** Basic Auth 必須

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "count": 5
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

#### POST /api/admin/alerts/:id/acknowledge

**目的:** アラートの確認

**認証:** Basic Auth 必須

**パラメータ:**
- `id`: アラートID

**リクエスト:**
```json
{
  "acknowledgedBy": "admin"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "789",
    "acknowledged": true,
    "acknowledgedAt": "2025-11-04T10:00:00.000Z",
    "acknowledgedBy": "admin"
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

#### POST /api/admin/alerts/:id/resolve

**目的:** アラートの解決

**認証:** Basic Auth 必須

**パラメータ:**
- `id`: アラートID

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": "789",
    "resolved": true,
    "resolvedAt": "2025-11-04T10:00:00.000Z"
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

#### GET /api/admin/alert-settings

**目的:** アラート設定一覧の取得

**認証:** Basic Auth 必須

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "settings": [
      {
        "id": 1,
        "type": "cpu_high",
        "enabled": true,
        "threshold": 80.0,
        "notifyEmail": false,
        "notifySlack": false,
        "notifyWebhook": false,
        "createdAt": "2025-11-04T00:00:00.000Z",
        "updatedAt": "2025-11-04T00:00:00.000Z"
      }
    ]
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

#### PUT /api/admin/alert-settings/:type

**目的:** アラート設定の更新

**認証:** Basic Auth 必須

**パラメータ:**
- `type`: アラートタイプ

**リクエスト:**
```json
{
  "enabled": true,
  "threshold": 85.0,
  "notifyEmail": true,
  "notifySlack": false,
  "notifyWebhook": false
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "cpu_high",
    "enabled": true,
    "threshold": 85.0,
    "notifyEmail": true,
    "notifySlack": false,
    "notifyWebhook": false,
    "updatedAt": "2025-11-04T10:00:00.000Z"
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

### 16.7.5 データベースマイグレーションAPI

#### POST /api/admin/database/migrate-audit-logs

**目的:** audit_logsテーブルの作成

**認証:** Basic Auth 必須

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "message": "Audit logs table created successfully",
    "tables": ["audit_logs"]
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

#### POST /api/admin/database/migrate-alerts

**目的:** alerts と alert_settings テーブルの作成

**認証:** Basic Auth 必須

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "message": "Alerts tables created successfully",
    "tables": ["alerts", "alert_settings"]
  },
  "timestamp": "2025-11-04T10:00:00.000Z"
}
```

---

#### POST /api/admin/eventsub/credentials

**目的:** EventSub認証情報の設定

**認証:** なし（内部API）

**リクエスト:**
```json
{
  "accessToken": "abcdef123456...",
  "clientId": "mc01db35sug2j2t5cdekyid3favu2m"
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "updated": true
  },
  "timestamp": "2025-10-27T10:35:00.000Z"
}
```

**実装（`server/src/routes/eventsub.ts:168-205`）:**
```typescript
eventsubRouter.post('/credentials', async (req, res) => {
  try {
    const { accessToken, clientId } = req.body;

    if (!accessToken || !clientId) {
      return res.status(400).json({
        success: false,
        error: 'accessToken and clientId are required',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[EventSub] Setting new credentials...');

    // 認証情報を設定
    twitchEventSubManager.setCredentials(accessToken, clientId);

    // 全接続を再接続
    await twitchEventSubManager.reconnectAll();

    console.log('[EventSub] Credentials updated and connections reestablished');

    res.json({
      success: true,
      data: {
        updated: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EventSub] Error setting credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
```

**呼び出し元（`server/src/routes/auth.ts:160-181`）:**
```typescript
// 管理ダッシュボード用の認証の場合
if (isAdminAuth) {
  console.log('[Twitch Callback] Admin authentication - sending credentials to admin dashboard');

  // トークンをEventSubManagerに送信
  try {
    const { fetch } = await import('undici');
    const response = await fetch('http://localhost:4000/api/admin/eventsub/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken: tokenResponse.access_token,
        clientId: process.env.TWITCH_CLIENT_ID
      })
    });

    if (response.ok) {
      console.log('[Twitch Callback] Credentials sent to EventSubManager successfully');
    } else {
      console.error('[Twitch Callback] Failed to send credentials:', response.status);
    }
  } catch (error) {
    console.error('[Twitch Callback] Error sending credentials:', error);
  }

  // 管理ダッシュボードにリダイレクト
  return res.redirect(`http://localhost:5174/eventsub?twitch_auth=success&username=${encodeURIComponent(userInfo.login)}`);
}
```

---

## 16.8 EventSub統合

### 16.8.1 EventSubManagerの概要

**場所:** `server/src/services/twitchEventSubManager.ts`

**目的:**
- Twitch EventSub WebSocketとの接続管理
- 3つの同時接続を維持（各接続で最大100購読）
- 配信の開始/終了イベントをリアルタイムで受信

**主要メソッド:**

```typescript
class TwitchEventSubManager {
  // 認証情報の設定
  setCredentials(accessToken: string, clientId: string): void

  // 全接続の確立
  async connectAll(): Promise<void>

  // 全接続の切断
  disconnectAll(): void

  // 全接続の再接続（購読も復元）
  async reconnectAll(): Promise<void>

  // ユーザーへの購読
  async subscribeToUsers(userIds: string[]): Promise<void>

  // チャンネルの購読解除
  async unsubscribeChannel(userId: string): Promise<void>

  // 統計情報の取得
  getStats(): EventSubStats

  // 容量情報の取得
  getCapacity(): CapacityInfo

  // 購読ユーザーID一覧の取得
  getSubscribedUserIds(): string[]
}
```

### 16.8.2 reconnectAll()の実装

**コード（`server/src/services/twitchEventSubManager.ts:219-246`）:**

```typescript
/**
 * 全ての接続を再接続
 */
public async reconnectAll(): Promise<void> {
  if (!this.accessToken || !this.clientId) {
    throw new Error('Credentials not set. Call setCredentials() first.');
  }

  console.log('[EventSub Manager] Reconnecting all connections...');

  // 現在のサブスクリプション情報を保存
  const subscribedUserIds = Array.from(this.channelToConnectionMap.keys());
  console.log(`[EventSub Manager] Saving ${subscribedUserIds.length} subscriptions before reconnect`);

  // 全ての接続を切断
  this.disconnectAll();

  // 全ての接続を再接続
  await this.connectAll();

  // サブスクリプションを復元
  if (subscribedUserIds.length > 0) {
    console.log(`[EventSub Manager] Restoring ${subscribedUserIds.length} subscriptions...`);
    await this.subscribeToUsers(subscribedUserIds);
  }

  console.log('[EventSub Manager] Reconnection completed');
}
```

**動作フロー:**
1. 認証情報の確認
2. 現在の購読チャンネルIDを保存
3. 全接続を切断
4. 全接続を再確立
5. 保存した購読チャンネルを復元

### 16.8.3 容量管理

**仕様:**
- 1接続あたり最大100購読
- 合計3接続で最大300購読
- `stream.online` と `stream.offline` で各1購読（1チャンネル = 2購読）

**容量計算:**
```typescript
public getCapacity(): CapacityInfo {
  const totalCapacity = this.connections.length * 100;  // 300
  const usedCapacity = this.connections.reduce(
    (sum, conn) => sum + conn.subscriptionCount,
    0
  );

  return {
    total: totalCapacity,
    used: usedCapacity,
    available: totalCapacity - usedCapacity,
    percentage: (usedCapacity / totalCapacity) * 100
  };
}
```

### 16.8.4 Twitch OAuth認証フロー

**目的:** User Access Tokenの取得

**理由:** WebSocket EventSubはUser Access Tokenが必須
- App Access Tokenでは `stream.online/offline` の購読が不可

**フロー:**
```
1. admin-web: EventSub画面で「Twitchログイン」ボタンをクリック
   ↓
2. window.location.href = 'http://localhost:4000/auth/twitch?admin=true'
   ↓
3. server: admin=true パラメータを検出
   - req.session.isAdminAuth = true
   ↓
4. server: Twitch OAuth画面にリダイレクト
   - https://id.twitch.tv/oauth2/authorize?...
   ↓
5. ユーザー: Twitchで認証を承認
   ↓
6. Twitch: /auth/twitch/callback にリダイレクト
   ↓
7. server: 認証コードをトークンに交換
   ↓
8. server: isAdminAuth フラグをチェック
   - true の場合の処理:
     a. トークンをEventSubManagerに送信
        POST http://localhost:4000/api/admin/eventsub/credentials
     b. EventSubManager.setCredentials(token, clientId)
     c. EventSubManager.reconnectAll()
   ↓
9. server: admin-webにリダイレクト
   - http://localhost:5174/eventsub?twitch_auth=success&username=...
   ↓
10. admin-web: URLパラメータを検出
    - 成功メッセージを表示
    - パラメータをクリア
```

**実装箇所:**
- `admin-web/src/components/pages/EventSub.tsx:67-70` - ログインボタン
- `server/src/routes/auth.ts:87-103` - admin検出
- `server/src/routes/auth.ts:152-184` - 認証後処理
- `server/src/routes/eventsub.ts:168-205` - 認証情報設定

---

## 16.9 開発ガイド

### 16.9.1 ローカル開発環境のセットアップ

#### 1. 前提条件
- Node.js 18以上
- Redis（ローカルまたはDockerで起動）
- Twitch Developer アカウント

#### 2. 環境変数の設定

**server/.env:**
```env
PORT=4000
NODE_ENV=development

# Twitch OAuth
TWITCH_CLIENT_ID=mc01db35sug2j2t5cdekyid3favu2m
TWITCH_CLIENT_SECRET=9r5cc8pv5638xdve5hyb2341cr0irn
TWITCH_REDIRECT_URI=http://localhost:4000/auth/twitch/callback

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback

# Session
SESSION_SECRET=your_session_secret_here_min_32_chars

# Redis
REDIS_URL=redis://localhost:6379

# EventSub
ENABLE_EVENT_SUB=true
```

**admin-server/.env:**
```env
PORT=4001

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=AdminPassword123456!@$%

# Redis
REDIS_URL=redis://localhost:6379

# Main Backend URL
MAIN_BACKEND_URL=http://localhost:4000

# Twitch OAuth (未使用だが設定必要)
TWITCH_CLIENT_ID=mc01db35sug2j2t5cdekyid3favu2m
TWITCH_CLIENT_SECRET=9r5cc8pv5638xdve5hyb2341cr0irn
TWITCH_REDIRECT_URI=http://localhost:4001/auth/twitch/callback
SESSION_SECRET=3TWfDsJPjoAR4UGRFf8ERel0G3rWCbaKIiKxNot3qAJzTg067wqqLPdnXu2UOXfe
```

#### 3. 依存関係のインストール

```bash
# メインサーバー
cd C:\Users\s_kus\開発\server
npm install

# 管理サーバー
cd C:\Users\s_kus\開発\admin-server
npm install

# 管理ウェブ
cd C:\Users\s_kus\開発\admin-web
npm install
```

#### 4. サーバーの起動

**ターミナル1（メインサーバー）:**
```bash
cd C:\Users\s_kus\開発\server
npm run dev
```

**ターミナル2（管理サーバー）:**
```bash
cd C:\Users\s_kus\開発\admin-server
npm run dev
```

**ターミナル3（管理ウェブ）:**
```bash
cd C:\Users\s_kus\開発\admin-web
npm run dev
```

#### 5. アクセス

- **admin-web:** http://localhost:5174
- **admin-server:** http://localhost:4001
- **server:** http://localhost:4000

### 16.9.2 開発ワークフロー

#### コンポーネント追加
```bash
# 新しいページコンポーネントを作成
cd admin-web/src/components/pages
# System.tsx と System.module.css を作成

# Sidebar にルートを追加
# admin-web/src/components/common/Sidebar.tsx

# App.tsx にルートを追加
# admin-web/src/App.tsx
```

#### API追加
```bash
# server側にエンドポイントを追加
# server/src/routes/admin.ts など

# admin-webのapiClientに関数を追加
# admin-web/src/services/apiClient.ts

# 型定義を追加
# admin-web/src/types/index.ts
```

### 16.9.3 ビルド

```bash
# admin-web
cd admin-web
npm run build
# dist/ ディレクトリに出力

# admin-server
cd admin-server
npm run build
# dist/ ディレクトリに出力
```

---

## 16.10 トラブルシューティング

### 16.10.1 無限ログインループ

**症状:**
- ログインダイアログが無限に表示される
- 正しい認証情報を入力しても成功しない

**原因1: パスワードに `#` 記号が含まれている**

`.env` ファイルでは `#` がコメント記号として扱われるため、パスワードが途中で切れる。

**解決策:**
```bash
# admin-server/.env
# ❌ 悪い例
ADMIN_PASSWORD="MX!+Fr87Dn#abuc3Zu4F*sqh"  # '#' 以降が無視される

# ✅ 良い例
ADMIN_PASSWORD=AdminPassword123456!@$%  # '#' を含まない
```

**原因2: localStorage に古い認証情報が残っている**

認証情報変更後も、ブラウザのlocalStorageに古い認証情報が残っている。

**解決策:**
```javascript
// ブラウザコンソールで実行
localStorage.removeItem('admin_username');
localStorage.removeItem('admin_password');
// ページをリロード
```

**原因3: admin-serverの起動失敗**

パスワードが16文字未満で起動時エラー。

**確認方法:**
```bash
# admin-serverのログを確認
cd admin-server
npm run dev
# エラーメッセージを確認
```

### 16.10.2 EventSub 500エラー

**症状:**
- `/api/admin/eventsub/subscriptions` が500エラー
- "Internal Server Error" が表示される

**原因: メソッド名の不一致**

`getSubscribedChannels()` を呼び出しているが、実際のメソッドは `getSubscribedUserIds()`。

**解決済み（`server/src/routes/eventsub.ts:39`）:**
```typescript
// ❌ 修正前
const channelIds = twitchEventSubManager.getSubscribedChannels();

// ✅ 修正後
const channelIds = twitchEventSubManager.getSubscribedUserIds();
```

### 16.10.3 EventSub再接続失敗

**症状:**
- 「再接続に失敗しました」エラー
- EventSubの接続がアクティブにならない

**原因1: reconnectAll() メソッドが存在しない**

**解決済み:** `reconnectAll()` メソッドを実装（`twitchEventSubManager.ts:219-246`）

**原因2: 認証情報が未設定**

App Access Token を使用しているか、認証情報が設定されていない。

**解決策:**
1. EventSub管理画面で「Twitchログイン」を実行
2. User Access Token を取得
3. 自動的に `setCredentials()` と `reconnectAll()` が実行される

**原因3: App Access Token の使用**

WebSocket EventSubはUser Access Tokenが必須。

**確認方法:**
```bash
# serverログを確認
[EventSub] Failed to create subscription: 400 - {"error":"Bad Request","status":400,"message":"invalid transport and auth combination"}
```

**解決策:**
管理ダッシュボードからTwitchログインを実行してUser Access Tokenを取得。

### 16.10.4 Redirect Mismatch

**症状:**
- `{"error":"redirect_mismatch"}`
- Twitch OAuth時にエラー

**原因:** リダイレクトURIがTwitch Developer Consoleに登録されていない

**解決策:**
1. https://dev.twitch.tv/console にアクセス
2. アプリケーション設定を開く
3. OAuth Redirect URLs に以下を追加:
   - `http://localhost:4000/auth/twitch/callback`
4. 保存

### 16.10.5 本サービスにリダイレクトされる

**症状:**
- 管理ダッシュボードからTwitchログインを実行
- 本サービス（port 4000）にリダイレクトされる

**原因:** Twitchは複数のリダイレクトURIが登録されている場合、最初のURIを優先使用

**解決策（実装済み）:**
Proxy Pattern を採用：
1. 管理ダッシュボードから本サービスの `/auth/twitch?admin=true` にリダイレクト
2. 本サービスが認証を処理
3. トークンをEventSubManagerに送信
4. 管理ダッシュボードにリダイレクト

### 16.10.6 CORS エラー

**症状:**
```
Access to fetch at 'http://localhost:4001/api/admin/...' from origin 'http://localhost:5174' has been blocked by CORS policy
```

**原因:** CORSの設定不足

**解決策（`admin-server/src/middleware/cors.ts`）:**
```typescript
export const corsMiddleware = cors({
  origin: 'http://localhost:5174',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});
```

### 16.10.7 401エラーで自動ログアウトしない

**症状:**
- 認証エラー時にログアウトされず、古い認証情報が残る

**原因:** auth-error イベントのリスナーが設定されていない

**解決策（実装済み）:**
```typescript
// admin-web/src/App.tsx
useEffect(() => {
  const handleAuthError = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_password');
  };

  window.addEventListener('auth-error', handleAuthError);
  return () => window.removeEventListener('auth-error', handleAuthError);
}, []);

// admin-web/src/services/apiClient.ts
if (response.status === 401) {
  window.dispatchEvent(new Event('auth-error'));
  throw new Error('Authentication failed');
}
```

---

## 16.11 デプロイメント

### 16.11.1 本番環境の考慮事項

#### セキュリティ
- **強力なパスワード:** 本番環境では最低32文字のランダムパスワードを使用
- **HTTPS必須:** 本番環境ではHTTPS接続のみを許可
- **環境変数の保護:** `.env` ファイルをgitignoreに追加
- **IP制限:** 管理ダッシュボードへのアクセスを特定IPに制限
- **セッションタイムアウト:** 一定時間操作がない場合は自動ログアウト
- **監査ログ:** 管理操作のログを記録

#### パフォーマンス
- **ビルド最適化:** `npm run build` で本番ビルドを作成
- **静的ファイル配信:** admin-webはCDNまたはNginxで配信
- **APIキャッシング:** 頻繁にアクセスされるデータをキャッシュ
- **WebSocket接続:** EventSub用WebSocketの安定性を監視

#### 可用性
- **ヘルスチェック:** `/health` エンドポイントを追加
- **自動再起動:** PM2やSystemdでプロセス管理
- **エラー通知:** Slackやメールでエラー通知
- **バックアップ:** Redisデータの定期バックアップ

### 16.11.2 Docker化（推奨）

**admin-server/Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 4001

CMD ["node", "dist/index.js"]
```

**admin-web/Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  admin-server:
    build: ./admin-server
    ports:
      - "4001:4001"
    environment:
      - PORT=4001
      - ADMIN_USERNAME=${ADMIN_USERNAME}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - MAIN_BACKEND_URL=http://server:4000
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  admin-web:
    build: ./admin-web
    ports:
      - "5174:80"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### 16.11.3 環境変数の管理

**本番環境での推奨方法:**
- AWS Secrets Manager
- Google Cloud Secret Manager
- HashiCorp Vault
- Kubernetes Secrets

**セキュリティベストプラクティス:**
```bash
# .env.production.example を用意
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<CHANGE_THIS_TO_STRONG_PASSWORD>
SESSION_SECRET=<GENERATE_RANDOM_32_CHARS>
REDIS_URL=redis://redis:6379
MAIN_BACKEND_URL=http://server:4000
```

### 16.11.4 監視とログ

**推奨ツール:**
- **アプリケーション監視:** New Relic, Datadog
- **ログ集約:** ELK Stack, CloudWatch Logs
- **エラートラッキング:** Sentry
- **アップタイム監視:** UptimeRobot, Pingdom

**実装例（Winston Logger）:**
```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

---

## 16.12 将来の拡張計画

### 16.12.1 Phase 6: システム管理機能

- **サーバー情報**
  - CPU使用率
  - メモリ使用量
  - ディスク使用量
  - ネットワーク統計
- **プロセス管理**
  - サーバーの再起動
  - プロセスのステータス確認
- **環境変数**
  - 環境変数の表示（機密情報は非表示）
  - 設定の動的変更

### 16.12.2 Phase 7: セキュリティ機能

- **ログイン履歴**
  - 成功/失敗の記録
  - IPアドレスの追跡
  - デバイス情報
- **不正アクセス検出**
  - 連続失敗の検出
  - 異常なアクセスパターンの検出
- **IPブロッキング**
  - 特定IPの手動ブロック
  - 自動ブロックルール

### 16.12.3 Phase 8: 配信管理機能

- **配信一覧**
  - アクティブ配信の表示
  - 配信統計（視聴者数、チャット数）
- **配信者管理**
  - 配信者ランキング
  - 配信履歴
- **配信分析**
  - 時間帯別統計
  - プラットフォーム別統計

### 16.12.4 Phase 9: ユーザー管理機能

- **ユーザー一覧**
  - 登録ユーザーの表示
  - 認証状態の確認
- **ユーザー詳細**
  - 視聴履歴
  - アクティビティログ
- **アカウント管理**
  - アカウントの有効化/無効化
  - パスワードリセット

### 16.12.5 Phase 10: ログ管理機能

- **ログビューア**
  - リアルタイムログストリーム
  - ログレベルフィルタリング
  - 全文検索
- **エラー追跡**
  - エラー一覧
  - スタックトレース表示
  - エラー統計
- **アクセスログ**
  - APIエンドポイントごとの統計
  - レスポンスタイム分析

### 16.12.6 Phase 11: キャッシュ管理機能

- **Redis管理**
  - キーの検索
  - キーの削除
  - TTLの確認
- **キャッシュ統計**
  - ヒット率
  - メモリ使用量
  - キーの数
- **キャッシュクリア**
  - 全キャッシュクリア
  - パターンマッチでクリア

### 16.12.7 Phase 12: メンテナンスモード

- **モード切り替え**
  - メンテナンスモードのON/OFF
  - メンテナンス通知のカスタマイズ
- **スケジュール**
  - 定期メンテナンスのスケジュール設定
  - 自動ON/OFF
- **通知**
  - ユーザーへの事前通知
  - 完了通知

---

## 16.13 付録

### 16.13.1 用語集

- **EventSub**: Twitch のリアルタイムイベント通知システム（WebSocket版）
- **Basic Auth**: HTTPの基本認証方式（Base64エンコードされたユーザー名とパスワード）
- **Proxy Pattern**: 中間サーバーを介してリクエストを転送するアーキテクチャパターン
- **User Access Token**: ユーザー認証により取得されるアクセストークン
- **App Access Token**: アプリケーション認証により取得されるアクセストークン
- **Redirect URI**: OAuth認証後にリダイレクトされるURL
- **CORS**: Cross-Origin Resource Sharing（オリジン間リソース共有）
- **localStorage**: ブラウザのローカルストレージ（永続データ保存）
- **WebSocket**: 双方向通信プロトコル

### 16.13.2 参考リンク

- **Twitch EventSub Documentation**: https://dev.twitch.tv/docs/eventsub/
- **Twitch OAuth Documentation**: https://dev.twitch.tv/docs/authentication/
- **Express.js Documentation**: https://expressjs.com/
- **React Documentation**: https://react.dev/
- **TypeScript Documentation**: https://www.typescriptlang.org/docs/

### 16.13.3 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-10-27 | 1.0.0 | 初版作成 - Phase 5完了時点の仕様書 |
| 2025-11-04 | 1.1.0 | 監査ログ・アラート機能追加<br>- 監査ログシステム（AuditLogs）の実装<br>- アラート・通知システム（Alerts）の実装<br>- サーバー監視（ServerMonitor）の追加<br>- データベースマイグレーションAPI追加<br>- 管理タブ数: 12 → 15 |

---

## 16.14 まとめ

**ふくまど！管理用ダッシュボード**は、本サービスの運用を効率化するための重要なツールです。

### 主要な設計思想

1. **セキュリティファースト**: 3層アーキテクチャとBasic認証による多重防御
2. **シンプルな構成**: 必要最小限の機能から始め、段階的に拡張
3. **リアルタイム監視**: EventSubの状態をリアルタイムで把握
4. **保守性**: TypeScriptとモジュラー設計による長期保守性

### 現在の実装状態（2025-11-04時点）

- ✅ 基本アーキテクチャの構築（3層アーキテクチャ）
- ✅ Basic認証の実装
- ✅ EventSub管理機能
- ✅ Twitch OAuth統合（Proxy Pattern）
- ✅ 自動ログアウト機能
- ✅ 統計情報の可視化
- ✅ 監査ログシステム（管理者操作の記録と追跡）
- ✅ アラート・通知システム（システムアラートの管理）
- ✅ サーバー監視機能（リソース詳細監視）
- ✅ データベースマイグレーション機能
- ✅ 15タブの管理画面（ダッシュボード、PV統計、アナリティクス、システム、サーバー監視、セキュリティ、配信管理、ユーザー管理、ログ閲覧、監査ログ、アラート、EventSub、キャッシュ/DB、API監視、メンテナンス）

### 実装済み機能の詳細

#### コンプライアンス・セキュリティ
- **監査ログ**: 全管理者操作の記録、フィルタリング、エクスポート
- **アラートシステム**: CPU/メモリ高、レート制限低、セキュリティアラート等の管理
- **IPブロッキング**: 不正アクセスの自動・手動ブロック

#### 運用管理
- **メンテナンスモード**: バイパストークン、スケジュール設定
- **データベース管理**: マイグレーション実行、接続状態監視
- **キャッシュ管理**: Redis統計、キャッシュクリア

#### 監視・分析
- **リアルタイム監視**: WebSocket経由のシステムメトリクス更新
- **PV統計**: ページビュー分析、エクスポート機能
- **アナリティクス**: ユーザー行動追跡、イベント分析

### 今後の展開

管理ダッシュボードは継続的に機能強化が行われます。将来の拡張候補：
- より高度なアラート通知（メール/Slack/Webhook統合）
- ダッシュボードのカスタマイズ機能
- レポート自動生成
- 多言語対応

この仕様書は、開発の進捗に応じて随時更新されます。
