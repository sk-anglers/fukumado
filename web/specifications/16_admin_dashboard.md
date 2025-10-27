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

### 16.1.2 主要機能

1. **ダッシュボード（Dashboard）**
   - システム概要の表示
   - リアルタイム統計情報
   - 稼働状況サマリー

2. **システム管理（System）**
   - サーバー稼働状況の監視
   - リソース使用状況（CPU、メモリ、ディスク）
   - アプリケーションバージョン情報
   - 環境変数の確認

3. **セキュリティ（Security）**
   - ログイン履歴の追跡
   - 不正アクセス試行の検出
   - IPアドレスブロッキング
   - セキュリティイベントの監視

4. **配信管理（Streams）**
   - アクティブ配信の一覧
   - 配信統計情報
   - 配信者ランキング
   - 配信履歴

5. **ユーザー管理（Users）**
   - ユーザー一覧と詳細情報
   - 認証状態の確認
   - ユーザーアクティビティ追跡
   - アカウント管理

6. **ログ管理（Logs）**
   - アプリケーションログの表示
   - エラーログの追跡
   - アクセスログの分析
   - ログレベルフィルタリング

7. **EventSub管理（EventSub）**
   - Twitch EventSub接続状況の監視
   - 購読チャンネルの管理
   - 接続統計とキャパシティ情報
   - EventSub認証管理

8. **キャッシュ管理（Cache）**
   - Redisキャッシュの状態確認
   - キャッシュキーの検索と削除
   - キャッシュヒット率の分析
   - メモリ使用量の監視

9. **メンテナンスモード（Maintenance）**
   - メンテナンスモードの切り替え
   - メンテナンス通知のカスタマイズ
   - スケジュール設定

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
│   │       ├── EventSub.tsx     # EventSub管理ページ
│   │       ├── EventSub.module.css
│   │       └── Login.tsx        # ログインページ
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
const menuItems = [
  { path: '/', label: 'ダッシュボード', icon: '📊' },
  { path: '/eventsub', label: 'EventSub管理', icon: '📡' },
  // 将来の拡張用
  // { path: '/system', label: 'システム', icon: '⚙️' },
  // { path: '/security', label: 'セキュリティ', icon: '🔒' },
  // { path: '/streams', label: '配信管理', icon: '📹' },
  // { path: '/users', label: 'ユーザー', icon: '👥' },
  // { path: '/logs', label: 'ログ', icon: '📝' },
  // { path: '/cache', label: 'キャッシュ', icon: '💾' },
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

---

## 16.14 まとめ

**ふくまど！管理用ダッシュボード**は、本サービスの運用を効率化するための重要なツールです。

### 主要な設計思想

1. **セキュリティファースト**: 3層アーキテクチャとBasic認証による多重防御
2. **シンプルな構成**: 必要最小限の機能から始め、段階的に拡張
3. **リアルタイム監視**: EventSubの状態をリアルタイムで把握
4. **保守性**: TypeScriptとモジュラー設計による長期保守性

### 現在の実装状態（Phase 5完了）

- ✅ 基本アーキテクチャの構築
- ✅ Basic認証の実装
- ✅ EventSub管理機能
- ✅ Twitch OAuth統合（Proxy Pattern）
- ✅ 自動ログアウト機能
- ✅ 統計情報の可視化

### 今後の展開

管理ダッシュボードは、Phase 6以降でシステム管理、セキュリティ、配信管理、ユーザー管理、ログ管理、キャッシュ管理、メンテナンスモードなどの機能が追加される予定です。

この仕様書は、開発の進捗に応じて随時更新されます。
