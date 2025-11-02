# 3. ディレクトリ構造

## 3.1 フロントエンド構造

```
C:\Users\s_kus\開発\web\
├── src/
│   ├── components/           # Reactコンポーネント
│   │   ├── AppShell/         # アプリケーションシェル
│   │   ├── Header/           # ヘッダー（検索、認証、設定）
│   │   │   ├── Header.tsx
│   │   │   ├── AccountMenu.tsx
│   │   │   └── NotificationMenu.tsx
│   │   ├── Sidebar/          # サイドバー（配信リスト）
│   │   ├── StreamGrid/       # 配信グリッド
│   │   │   ├── StreamGrid.tsx
│   │   │   └── StreamSlot/   # 個別配信スロット
│   │   ├── ChatPanel/        # チャットパネル
│   │   ├── Footer/           # フッター
│   │   ├── LayoutPresetModal/ # レイアウト選択モーダル
│   │   ├── SlotSelectionModal/ # スロット選択モーダル
│   │   ├── EmotePicker/      # Twitchエモートピッカー
│   │   ├── Toast/            # 通知トースト
│   │   └── Legal/            # 利用規約・プライバシーポリシー
   │   │   ├── ConsentManager.tsx # Cookie同意管理
│   │   │   ├── MaintenancePage/  # メンテナンスページ
│   │   │   └── MobileRestriction/ # モバイル制限画面
   │   │   ├── GlobalControls/   # グローバル操作コントロール
│   │   ├── StreamSelectionModal/ # 配信選択モーダル
│   ├── stores/               # Zustand状態管理
│   │   ├── layoutStore.ts    # レイアウト・配信スロット管理
│   │   ├── chatStore.ts      # チャットメッセージ管理
│   │   ├── authStore.ts      # 認証状態管理
│   │   ├── userStore.ts      # ユーザー情報・フォロー管理
│   │   ├── syncStore.ts      # 同期設定管理
│   │   ├── notificationStore.ts # 通知管理
│   │   └── dataUsageStore.ts # データ使用量管理
   │   │   ├── maintenanceStore.ts # メンテナンス状態管理
│   │   │   └── mobileMenuStore.ts # モバイルメニュー管理
│   ├── hooks/                # カスタムReactフック
│   │   ├── useAuthStatus.ts
│   │   ├── useTwitchAuthStatus.ts
│   │   ├── useTwitchStreams.ts
│   │   ├── useYoutubeStreams.ts
   │   │   ├── useStreamUpdates.ts  # 配信更新統合フック
│   │   ├── useTwitchChat.ts
│   │   ├── useTwitchEmbed.ts
│   │   ├── useYouTubeIframeApi.ts
   │   │   ├── useMediaQuery.ts     # メディアクエリ判定
│   │   ├── useAudioLevelMonitor.ts
│   │   └── useDataUsageMonitor.ts
│   ├── types/                # TypeScript型定義
│   │   ├── index.ts
│   │   └── youtube.d.ts
│   ├── utils/                # ユーティリティ関数
   │   ├── services/             # フロントエンドサービス
│   │   │   └── websocketService.ts  # WebSocketシングルトン
│   │   └── api.ts
│   ├── config.ts             # アプリケーション設定
│   ├── App.tsx               # ルートコンポーネント
│   ├── main.tsx              # エントリーポイント
│   └── vite-env.d.ts
├── public/                   # 静的ファイル
├── index.html                # HTMLテンプレート
├── package.json              # 依存関係
├── tsconfig.json             # TypeScript設定
├── vite.config.ts            # Vite設定
└── eslint.config.js          # ESLint設定
```

## 3.2 バックエンド構造

```
C:\Users\s_kus\開発\server\
├── src/
│   ├── routes/               # APIルート
│   │   ├── auth.ts           # OAuth認証エンドポイント
│   │   ├── twitch.ts         # Twitch API エンドポイント（13個）
│   │   └── youtube.ts        # YouTube API エンドポイント（3個）
│   ├── services/             # ビジネスロジック
│   │   ├── streamSyncService.ts      # 配信同期サービス（60秒間隔）
│   │   ├── twitchChatService.ts      # Twitchチャットサービス（IRC）
│   │   ├── twitchService.ts          # Twitch API ラッパー
│   │   ├── youtubeService.ts         # YouTube API ラッパー
│   │   ├── cacheService.ts           # Redisキャッシュサービス
│   │   ├── tokenStorage.ts           # トークンストレージ
│   │   └── twitchEventSubWebhookService.ts # EventSub Webhook
│   ├── types/                # TypeScript型定義
│   │   └── index.ts
│   ├── config/               # 設定ファイル
│   │   └── index.ts
│   ├── middleware/           # Expressミドルウェア
│   │   └── auth.ts
│   ├── utils/                # ユーティリティ関数
   │   ├── services/             # フロントエンドサービス
│   │   │   └── websocketService.ts  # WebSocketシングルトン
│   │   └── logger.ts
│   ├── websocket/            # WebSocketサーバー
│   │   ├── chatServer.ts     # チャット用WebSocket
│   │   └── streamServer.ts   # 配信更新通知用WebSocket
│   └── server.ts             # エントリーポイント
├── .env                      # 環境変数
├── package.json              # 依存関係
├── tsconfig.json             # TypeScript設定
└── nodemon.json              # Nodemon設定
```

## 3.3 ファイル命名規則

### コンポーネント
- **PascalCase**: `Header.tsx`, `StreamSlot.tsx`
- **コロケーション**: 各コンポーネントディレクトリに関連ファイルを配置
  - `Header/Header.tsx`
  - `Header/Header.module.css`
  - `Header/Header.test.tsx`

### ストア
- **camelCase**: `layoutStore.ts`, `chatStore.ts`
- **接尾辞**: `Store`を付与

### フック
- **camelCase**: `useTwitchChat.ts`, `useAuthStatus.ts`
- **接頭辞**: `use`を付与

### 型定義
- **PascalCase**: `Streamer`, `ChatMessage`, `StreamSlot`
- **Enum/Type**: `Platform`, `LayoutPreset`, `VideoQuality`

## 3.4 依存関係の方向性

```
┌──────────────────────────────────────┐
│         Components (UI層)            │
│  - 表示ロジックのみ                   │
│  - ストアから状態を読み取り            │
│  - フックでビジネスロジックを分離      │
└──────────────────────────────────────┘
              │ 依存
              ↓
┌──────────────────────────────────────┐
│      Stores (状態管理層)              │
│  - グローバルな状態管理                │
│  - ビジネスロジックを含まない          │
│  - 永続化設定                          │
└──────────────────────────────────────┘
              │ 依存
              ↓
┌──────────────────────────────────────┐
│      Hooks (ロジック層)               │
│  - データ取得・変換                    │
│  - WebSocket接続管理                  │
│  - 副作用の管理                        │
└──────────────────────────────────────┘
              │ 依存
              ↓
┌──────────────────────────────────────┐
│      Types (型定義層)                 │
│  - 全体で共有される型                  │
│  - プラットフォーム固有の型            │
│  - API レスポンス型                    │
└──────────────────────────────────────┘
```

**依存ルール**:
- 上位層は下位層に依存可能
- 下位層は上位層に依存しない
- 同一層内での循環依存を避ける

## 3.5 モジュール分割戦略

### コンポーネントの分割基準

1. **Atomic Design 原則**:
   - Atoms: `Button`, `Input`, `Icon`
   - Molecules: `SearchBar`, `VolumeControl`
   - Organisms: `Header`, `Sidebar`, `ChatPanel`
   - Templates: `AppShell`
   - Pages: `App.tsx`

2. **責務の分離**:
   - プレゼンテーション vs コンテナ
   - 状態管理をフックに委譲

3. **再利用性**:
   - 汎用コンポーネントは独立したディレクトリに配置
   - プロジェクト固有のコンポーネントは機能ごとにグループ化

### サービスの分割基準

1. **ドメイン別**:
   - `twitchService.ts`: Twitch関連ロジック
   - `youtubeService.ts`: YouTube関連ロジック

2. **責務別**:
   - `cacheService.ts`: キャッシング専用
   - `streamSyncService.ts`: 配信同期専用
   - `twitchChatService.ts`: チャット専用

3. **レイヤー別**:
   - `routes/`: HTTP エンドポイント
   - `services/`: ビジネスロジック
   - `websocket/`: WebSocket 接続管理

## 3.6 ファイルサイズ管理

### 推奨ファイルサイズ

| ファイルタイプ | 推奨最大サイズ | 超過時の対応 |
|---|---|---|
| コンポーネント | 300行 | サブコンポーネントに分割 |
| ストア | 200行 | 複数ストアに分割 |
| サービス | 400行 | 機能ごとにファイル分割 |
| フック | 150行 | 複数フックに分割 |

### 大きなファイルの分割例

**従来** (`layoutStore.ts` 500行):
```
layoutStore.ts (500行)
- レイアウト管理
- スロット管理
- 配信リスト管理
- 検索機能
```

**分割後**:
```
layoutStore.ts (150行) - レイアウト・スロット
streamListStore.ts (100行) - 配信リスト
searchStore.ts (100行) - 検索機能
```

## 3.7 特別なディレクトリ

### `/specifications`
- アプリケーション仕様書
- 各セクションに分割された詳細ドキュメント
- 開発者オンボーディング資料

### `/docs`
- ユーザー向けドキュメント
- API ドキュメント
- 開発ガイド

### `/scripts`
- ビルドスクリプト
- デプロイスクリプト
- ユーティリティスクリプト

### `/tests`
- E2Eテスト（Playwright/Cypress）
- 統合テスト
- パフォーマンステスト

## 3.10 最近の更新（v0.1.0）

### フロントエンド追加項目

**コンポーネント**:
- `ConsentManager.tsx`: Cookie同意管理（GDPR対応）
- `MaintenancePage/`: メンテナンス中の案内画面
- `MobileRestriction/`: モバイル制限画面（本番環境のみ）
- `GlobalControls/`: グローバル操作パネル
- `StreamSelectionModal/`: 配信選択モーダル

**ストア**:
- `maintenanceStore.ts`: メンテナンスモード状態管理
- `mobileMenuStore.ts`: モバイルメニュー状態管理

**フック**:
- `useMediaQuery.ts`: メディアクエリ判定（モバイル検出）
- `useStreamUpdates.ts`: 配信更新の統合管理

**サービス**:
- `services/websocketService.ts`: WebSocketシングルトン（React Strict Mode対応）

### バックエンド追加項目

**ルート（14ファイル、11個追加）**:
- `admin.ts`: 管理API（システム監視）
- `adminStreams.ts`: 管理用配信情報
- `cache.ts`: キャッシュ管理API
- `consent.ts`: Cookie同意管理API
- `eventsub.ts`: Twitch EventSub Webhook
- `legal.ts`: 利用規約・プライバシーポリシーAPI
- `logs.ts`: ログ管理API
- `maintenance.ts`: メンテナンスモードAPI
- `security.ts`: セキュリティ管理API
- `streams.ts`: 配信情報API
- `users.ts`: ユーザー管理API

**サービス（22ファイル、17個追加）**:
- `pvTracker.ts`: PV計測（Redis利用、日次・月次）
- `consentManager.ts`: Cookie同意管理
- `maintenanceService.ts`: メンテナンスモード制御
- `systemMetricsCollector.ts`: システムメトリクス収集
- `badgeService.ts`: Twitchバッジサービス
- `emoteCacheService.ts`: エモートキャッシング
- `followedChannelsCacheService.ts`: フォローチャンネルキャッシュ
- `anomalyDetection.ts`: 異常検知
- `metricsCollector.ts`: メトリクス収集
- `priorityManager.ts`: 優先度管理
- `securityReporter.ts`: セキュリティレポート
- `dynamicChannelAllocator.ts`: 動的チャンネル割り当て
- `twitchEventSubConnection.ts`: EventSub WebSocket接続
- `twitchEventSubManager.ts`: EventSub購読管理
- `twitchEventSubService.ts`: EventSubサービス統合
- `twitchEventSubWebhookService.ts`: EventSub Webhook処理
- `twitchAppAuth.ts`: Twitchアプリ認証

**ミドルウェア**:
- `adminAuth.ts`: 管理API認証
- `logging.ts`: リクエスト・アクセスログ
- `maintenanceMode.ts`: メンテナンスモードチェック
- `pvCounter.ts`: PVカウンター
- `security.ts`: セキュリティヘッダー、レート制限
- `sessionSecurity.ts`: CSRF保護、セッション劫取検出
- `websocketSecurity.ts`: WebSocket接続セキュリティ

**エントリーポイントの変更**:
- `server.ts` → `index.ts`（WebSocketサーバーを統合）

**セッション管理の変更**:
- メモリストア → `connect-redis` + `ioredis`（本番対応）
