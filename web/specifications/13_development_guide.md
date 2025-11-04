# 13. 開発ガイド

このセクションでは、ふくまど！の開発環境のセットアップ、開発フロー、デプロイ手順について説明します。

## 13.1 開発環境セットアップ

### 前提条件
- Node.js 18以上
- npm または yarn
- バックエンドサーバー（ポート4000で起動）
- Redis（オプション、キャッシング用）

### インストール
```bash
cd C:\Users\s_kus\開発\web
npm install
```

### 環境変数設定
`.env` ファイルを作成：
```env
VITE_ENABLE_YOUTUBE=true
VITE_ENABLE_NICONICO=false
VITE_BACKEND_ORIGIN=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
```

### バックエンドセットアップ
```bash
cd C:\Users\s_kus\開発\server
npm install

# .env ファイルを作成
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
SESSION_SECRET=your_random_secret
```

## 13.2 開発コマンド

### 開発サーバー起動
```bash
npm run dev
```
- ポート: 5173
- HMR（ホットモジュールリプレイスメント）有効
- `/api` と `/auth` は `localhost:4000` にプロキシ

### ビルド
```bash
npm run build
```
- TypeScriptコンパイル → Viteビルド
- 出力: `dist/`

### プレビュー
```bash
npm run preview
```
- ポート: 4173
- ビルド済みファイルをプレビュー

### Lint
```bash
npm run lint
npm run lint:fix  # 自動修正
```
- ESLintで静的解析

### 管理ダッシュボード開発（admin-web + admin-server）

**admin-server起動**:
```bash
cd admin-server
npm install
npm run dev
```
- ポート: 4001
- Basic認証: `ADMIN_USERNAME` / `ADMIN_PASSWORD` (.envで設定)
- メインバックエンド（localhost:4000）へのプロキシ

**admin-web起動**:
```bash
cd admin-web
npm install
npm run dev
```
- ポート: 5174
- admin-server（localhost:4001）への接続が必要
- ログイン画面から管理ダッシュボードへアクセス

**推奨起動順序**:
1. Redis起動
2. メインバックエンド（server）起動
3. admin-server起動
4. admin-web起動
5. フロントエンド（web）起動

## 13.3 ディレクトリ追加ガイドライン

### 新規コンポーネント
```
src/components/NewComponent/
├── NewComponent.tsx
├── NewComponent.module.css
└── (必要に応じてサブコンポーネント)
```

**例**:
```typescript
// NewComponent.tsx
import styles from './NewComponent.module.css';

export const NewComponent = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>New Component</h1>
    </div>
  );
};
```

### 新規Store
```
src/stores/newStore.ts
```

**例**:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NewState {
  value: string;
  setValue: (value: string) => void;
}

export const useNewStore = create<NewState>()(
  persist(
    (set) => ({
      value: '',
      setValue: (value) => set({ value }),
    }),
    {
      name: 'fukumado-new',
      version: 1,
    }
  )
);
```

### 新規Hook
```
src/hooks/useNewFeature.ts
```

**例**:
```typescript
import { useEffect, useState } from 'react';

export const useNewFeature = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    // データ取得ロジック
  }, []);

  return data;
};
```

## 13.4 コーディング規約

### TypeScript
- **厳格な型チェック**: `tsconfig.json` の `strict: true`
- **any禁止**: 極力型を明示
- **型定義**: `src/types/index.ts` に集約

**良い例**:
```typescript
interface User {
  id: string;
  name: string;
}

const getUser = (id: string): User => {
  // ...
};
```

**悪い例**:
```typescript
const getUser = (id: any): any => {
  // ...
};
```

### React
- **関数コンポーネント**: アロー関数で定義
- **Hooks**: カスタムフックは `use` プレフィックス
- **Props型**: `interface` で定義

**良い例**:
```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button = ({ label, onClick }: ButtonProps) => {
  return <button onClick={onClick}>{label}</button>;
};
```

### CSS
- **CSS Modules**: コンポーネントごとに `.module.css`
- **命名**: BEM風（`.component__element--modifier`）
- **カラー**: CSS変数またはブランドカラーを使用

**良い例**:
```css
.button {
  background-color: var(--primary-blue);
}

.button__icon {
  margin-right: 0.5rem;
}

.button--disabled {
  opacity: 0.5;
}
```

### Zustand
- **State型**: `interface XxxState` で定義
- **Actions**: Stateインターフェース内に関数型で定義
- **永続化**: partializeで保存対象を明示

## 13.5 デバッグ

### ブラウザコンソール
- `[DataUsage]` でフィルタ: データ使用量監視のログ
- `[Twitch]` / `[YouTube]` でフィルタ: 配信取得のログ
- `[useTwitchChat]` でフィルタ: チャットWebSocketのログ

### React DevTools
- コンポーネントツリー、Hooks状態の確認
- プロファイラーでパフォーマンス分析

### Zustand DevTools（推奨）
```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useStore = create()(
  devtools(
    (set) => ({
      // ...
    }),
    { name: 'MyStore' }
  )
);
```

## 13.6 テスト

### 現状
- テストフレームワーク未導入

### 今後の推奨
- **単体テスト**: Vitest
- **コンポーネントテスト**: React Testing Library
- **E2Eテスト**: Playwright

### テストの書き方例
```typescript
// Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

## 13.7 デプロイ

### ビルド成果物
```bash
npm run build
# dist/ フォルダに静的ファイル生成
```

### デプロイ先（推奨）
- **Vercel**: 環境変数設定、プレビューデプロイ対応
- **Netlify**: 同上
- **Cloudflare Pages**: 同上

### Vercel デプロイ手順
1. Vercelにプロジェクトをインポート
2. ビルドコマンド: `npm run build`
3. 出力ディレクトリ: `dist`
4. 環境変数を設定:
   - `VITE_ENABLE_YOUTUBE`
   - `VITE_ENABLE_NICONICO`
   - `VITE_BACKEND_ORIGIN`（本番バックエンドURL）
   - `VITE_WS_URL`（本番WebSocket URL）
5. デプロイ

### バックエンドデプロイ
- Node.js + Expressサーバーを別途デプロイ
- CORS設定でフロントエンドドメインを許可
- 環境変数を設定（OAuth クレデンシャル、セッションシークレット等）

**Docker デプロイ例**:
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## 13.8 トラブルシューティング

### 配信が表示されない
1. ブラウザコンソールで `[YouTube]` / `[Twitch]` ログを確認
2. バックエンドの認証状態を確認（/auth/status, /auth/twitch/status）
3. config.ts のプラットフォーム設定を確認

### チャットが表示されない
1. ブラウザコンソールで `[useTwitchChat]` ログを確認
2. WebSocket接続状態を確認（`ws://localhost:4000/chat`）
3. バックエンドのWebSocketサーバーが起動しているか確認

### データ使用量が更新されない
1. ブラウザコンソールで `[DataUsage]` ログを確認
2. Resource Timing APIが有効か確認
3. sessionStorageが利用可能か確認

### 音量制御が効かない
1. ユーザーインタラクション前に音声を再生しようとしていないか確認
2. プラットフォーム別のプレイヤーAPIがロードされているか確認
3. ブラウザの自動再生ポリシーを確認

### ビルドエラー
```bash
# キャッシュクリア
rm -rf node_modules
rm package-lock.json
npm install

# TypeScriptエラー確認
npx tsc --noEmit
```

## 13.9 パフォーマンス最適化

### バンドルサイズ分析
```bash
npm run build
npx vite-bundle-visualizer
```

### 遅延ロード
```typescript
// 大きなコンポーネントは遅延ロード
const EmotePicker = lazy(() => import('./components/EmotePicker/EmotePicker'));

<Suspense fallback={<div>Loading...</div>}>
  <EmotePicker />
</Suspense>
```

### メモ化の活用
```typescript
// 高コストな計算はメモ化
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(input);
}, [input]);

// コールバックの安定化
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

## 13.10 Git ワークフロー

### ブランチ戦略
- `main`: 本番環境
- `develop`: 開発環境
- `feature/*`: 新機能開発
- `fix/*`: バグ修正

### コミットメッセージ
```
<type>: <subject>

<body>

<footer>
```

**Type**:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: スタイル変更
- `refactor`: リファクタリング
- `test`: テスト追加
- `chore`: ビルド・ツール変更

**例**:
```
feat: add dark mode support

- Add dark mode toggle in settings
- Update color scheme with CSS variables
- Persist dark mode preference in localStorage

Closes #123
```

## 13.11 CI/CD（推奨）

### GitHub Actions 例
```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run lint
      - run: npm run build
```

## 13.12 コードレビューのポイント

- TypeScriptの型安全性
- パフォーマンス（不要な再レンダリング）
- アクセシビリティ
- セキュリティ（XSS、CSRF対策）
- コーディング規約の遵守
