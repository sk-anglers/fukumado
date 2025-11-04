# 9. 設定・環境変数

このセクションでは、ふくまど！の設定ファイルと環境変数について説明します。

## 9.1 config.ts (src/config.ts)

アプリケーション設定を一元管理するファイル。

```typescript
export const config = {
  enableYoutube: import.meta.env.VITE_ENABLE_YOUTUBE === 'true',
  enableNiconico: import.meta.env.VITE_ENABLE_NICONICO === 'true'
} as const;
```

### 使用例
```typescript
import { config } from './config';

if (config.enableYoutube) {
  // YouTube機能を有効化
}
```

## 9.2 環境変数

### VITE_ENABLE_YOUTUBE
- **型**: string
- **値**: 'true' / 'false'
- **デフォルト**: 未設定（false扱い）
- **説明**: YouTube機能の有効/無効
- **影響範囲**:
  - Sidebar: YouTube配信の表示/非表示
  - ChatPanel: YouTubeタブの表示/非表示
  - useYoutubeStreams: フックの実行/スキップ

### VITE_ENABLE_NICONICO
- **型**: string
- **値**: 'true' / 'false'
- **デフォルト**: 未設定（false扱い）
- **説明**: ニコニコ生放送機能の有効/無効
- **影響範囲**:
  - Sidebar: ニコニコ配信の表示/非表示
  - ChatPanel: ニコニコタブの表示/非表示

### VITE_BACKEND_ORIGIN
- **型**: string
- **デフォルト**: 開発時は `http://localhost:4000`（自動判定）
- **説明**: バックエンドAPIのオリジン
- **本番環境**: `https://api.fukumado.example.com`

### VITE_WS_URL
- **型**: string
- **デフォルト**: 開発時は `ws://localhost:4000`
- **説明**: WebSocketサーバーのURL
- **本番環境**: `wss://api.fukumado.example.com`

## 9.3 Vite設定 (vite.config.ts)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'zustand-vendor': ['zustand']
        }
      }
    }
  }
});
```

### 主要設定

#### server.proxy
開発時に `/api` と `/auth` へのリクエストをバックエンド（localhost:4000）にプロキシします。

#### build.rollupOptions.output.manualChunks
大きな依存関係を別チャンクに分割し、初回ロード時間を短縮します。

## 9.4 TypeScript設定 (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 重要な設定

#### strict: true
厳格な型チェックを有効化：
- `noImplicitAny`: any型の推論を禁止
- `strictNullChecks`: null/undefinedチェック
- `strictFunctionTypes`: 関数型の厳格チェック

#### noUnusedLocals / noUnusedParameters
未使用変数・パラメータを検出してエラーにします。

## 9.5 package.json

```json
{
  "name": "fukumado-web",
  "version": "0.2.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "lint:fix": "eslint \"src/**/*.{ts,tsx}\" --fix"
  },
  "dependencies": {
    "@heroicons/react": "^2.1.3",
    "clsx": "^2.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.6",
    "@types/react-dom": "^18.3.2",
    "@vitejs/plugin-react": "^4.3.1",
    "@typescript-eslint/eslint-plugin": "^8.4.0",
    "@typescript-eslint/parser": "^8.4.0",
    "@eslint/js": "^9.10.0",
    "eslint": "^9.10.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.2"
  }
}
```

### スクリプト

- **dev**: 開発サーバー起動（HMR有効）
- **build**: TypeScriptコンパイル + Viteビルド
- **preview**: ビルド済みファイルのプレビュー
- **lint**: ESLintで静的解析
- **lint:fix**: ESLintで自動修正

## 9.6 ESLint設定 (eslint.config.js)

```javascript
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
];
```

### 主要ルール

- **@typescript-eslint/no-unused-vars**: 未使用変数を禁止
- **@typescript-eslint/no-explicit-any**: any型を禁止
- **react-hooks/rules-of-hooks**: Hooksルールを強制
- **react-hooks/exhaustive-deps**: useEffectの依存配列を検証

## 9.7 .env ファイル例

### 開発環境 (.env.development)
```env
VITE_ENABLE_YOUTUBE=true
VITE_ENABLE_NICONICO=false
VITE_BACKEND_ORIGIN=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
```

### 本番環境 (.env.production)
```env
VITE_ENABLE_YOUTUBE=true
VITE_ENABLE_NICONICO=true
VITE_BACKEND_ORIGIN=https://api.fukumado.example.com
VITE_WS_URL=wss://api.fukumado.example.com
```

## 9.8 バックエンド設定

### サーバー設定 (server/src/config/index.ts)
```typescript
export const config = {
  port: process.env.PORT || 4000,

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI
  },

  // Twitch OAuth
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    redirectUri: process.env.TWITCH_REDIRECT_URI
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },

  // Session
  session: {
    secret: process.env.SESSION_SECRET || 'development-secret',
    secure: process.env.NODE_ENV === 'production'
  }
};
```

### 必須環境変数（server）

| 変数名 | 説明 | 取得方法 |
|---|---|---|
| `PORT` | サーバーポート | デフォルト: 4000 |
| `SESSION_SECRET` | セッション暗号化キー | ランダム文字列生成 |
| `YOUTUBE_API_KEY` | YouTube Data API v3 APIキー | Google Cloud Console |
| `YOUTUBE_CLIENT_ID` | Google OAuth2 クライアントID | Google Cloud Console |
| `YOUTUBE_CLIENT_SECRET` | Google OAuth2 クライアントシークレット | Google Cloud Console |
| `YOUTUBE_REDIRECT_URI` | Google OAuthリダイレクトURI | 例: http://localhost:4000/auth/google/callback |
| `TWITCH_CLIENT_ID` | Twitch OAuth2 クライアントID | Twitch Developer Console |
| `TWITCH_CLIENT_SECRET` | Twitch OAuth2 クライアントシークレット | Twitch Developer Console |
| `TWITCH_REDIRECT_URI` | Twitch OAuthリダイレクトURI | 例: http://localhost:4000/auth/twitch/callback |
| `EVENTSUB_MODE` | EventSubモード（websocket or conduit） | websocket: 最大900購読, conduit: 最大100,000購読 |
| `REDIS_HOST` | Redisホスト | デフォルト: localhost |
| `REDIS_PORT` | Redisポート | デフォルト: 6379 |
| `REDIS_PASSWORD` | Redisパスワード（オプション） | - |

### 必須環境変数（admin-server）

| 変数名 | 説明 | デフォルト値 |
|---|---|---|
| `PORT` | 管理サーバーポート | 4001 |
| `ADMIN_USERNAME` | 管理者ユーザー名 | admin |
| `ADMIN_PASSWORD` | 管理者パスワード（最低16文字） | - |
| `MAIN_BACKEND_URL` | メインバックエンドURL | http://localhost:4000 |
| `REDIS_URL` | Redis接続URL | redis://localhost:6379 |
| `ADMIN_ALLOWED_IPS` | 許可IPアドレス（カンマ区切り、オプション） | - |
| `SLACK_WEBHOOK_URL` | Slack通知WebhookURL（オプション） | - |
| `TWITCH_CLIENT_ID` | Twitch OAuth2 クライアントID（EventSub用） | - |
| `TWITCH_CLIENT_SECRET` | Twitch OAuth2 クライアントシークレット（EventSub用） | - |
| `TWITCH_REDIRECT_URI` | Twitch OAuthリダイレクトURI（EventSub用） | http://localhost:5174/eventsub |

**注意事項:**
- `ADMIN_PASSWORD` には `#` 記号を含めないこと（dotenvがコメントとして解釈）
- 本番環境では強力なランダムパスワードを使用すること
- EventSub管理機能を使用する場合は、Twitch OAuth設定が必要

## 9.9 設定のベストプラクティス

### 環境ごとの設定分離
```
.env                 # 共通設定
.env.development     # 開発環境固有
.env.production      # 本番環境固有
.env.local           # ローカル環境固有（Gitignore）
```

### シークレット管理
- **開発環境**: .env.local（Gitignore）
- **本番環境**: 環境変数（Vercel, Netlifyなど）
- **絶対に避ける**: ソースコードにハードコード

### 型安全な設定アクセス
```typescript
const getRequiredEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  apiUrl: getRequiredEnv('VITE_BACKEND_ORIGIN'),
  // ...
};
```
