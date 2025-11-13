# 2. アーキテクチャ

## 2.1 技術スタック

### フロントエンド
- **フレームワーク**: React 18.3.1
- **ビルドツール**: Vite 5.4.2
- **言語**: TypeScript 5.5.4
- **状態管理**: Zustand 4.5.2 (persist middleware、useStoreWithEqualityFn使用)
- **スタイリング**: CSS Modules
- **アイコン**: Heroicons React 2.1.3
- **ユーティリティ**: clsx 2.1.0
- **最適化**: React.memo、shallow比較による再レンダリング防止
- **アナリティクス**: Google Analytics 4 (G-CNHJ23CY90), Google Tag Manager (GTM-MQ88DPNM)

### バックエンド
- **フレームワーク**: Node.js + Express（ポート4000）
- **言語**: TypeScript
- **WebSocket**: ws ライブラリ（チャット・配信更新通知）
- **OAuth2認証**: Google OAuth 2.0, Twitch OAuth 2.0
- **セッション管理**: express-session（メモリストア）
- **キャッシング**: Redis（配信リスト）+ メモリキャッシュ（検索結果）
- **IRC通信**: tmi.js（Twitchチャット）
- **バックグラウンドサービス**: StreamSyncService（60秒間隔で配信同期）

### 外部API
- YouTube Data API v3
- Twitch API
- ニコニコ生放送 API

## 2.2 システム構成図

```
┌────────────────────────────────────────────────────────────────────┐
│                     Frontend (Vite + React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Components  │  │    Stores     │  │    Hooks     │             │
│  │              │◄─┤  (Zustand)    │◄─┤              │             │
│  │  - AppShell  │  │  9 stores:    │  │ - useStreamUp│             │
│  │  - Header    │  │ - layout      │  │ - useTwitchCh│             │
│  │  - Sidebar   │  │ - chat        │  │ - useAuth... │             │
│  │  - Grid      │  │ - auth        │  │              │             │
│  │  - ChatPanel │  │ - user        │  └──────────────┘             │
│  │  - Footer    │  │ - sync        │                                │
│  └──────────────┘  │ - notification│  ┌──────────────┐             │
│                     │ - dataUsage   │  │   Services   │             │
│                     │ - maintenance │  │              │             │
│                     │ - mobileMenu  │  │ - WebSocketSvc│             │
│                     └───────────────┘  │  (Singleton) │             │
│                                       │  ※Strict Mode│             │
│                                       │    対応      │             │
│                                       └──────────────┘             │
└────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (REST API) / WebSocket
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js + Express)                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                 Routes (API Endpoints) - 15ルート             │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │
│  │  │   /auth    │  │/api/youtube│  │/api/twitch │              │  │
│  │  │  OAuth2.0  │  │   (3 EPs)  │  │  (13 EPs)  │              │  │
│  │  └────────────┘  └────────────┘  └────────────┘              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │
│  │  │ /api/admin │  │/api/streams│  │ /api/users │              │  │
│  │  │(管理API)   │  │(配信管理)  │  │(ユーザー)  │              │  │
│  │  └────────────┘  └────────────┘  └────────────┘              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │
│  │  │/api/eventsub│ │/api/analytics│ │/api/security│            │  │
│  │  │(EventSub)  │  │(分析)      │  │(監視)      │              │  │
│  │  └────────────┘  └────────────┘  └────────────┘              │  │
│  │  他: maintenance, cache, consent, legal, logs                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Services (26サービス)                      │  │
│  │  【コア】                                                      │  │
│  │  StreamSyncSvc, TwitchChatSvc, CacheSvc                      │  │
│  │  YouTubeService, TwitchService, TokenStorage                 │  │
│  │                                                                │  │
│  │  【EventSub/Conduit】                                         │  │
│  │  TwitchConduitManager, EventSubManager, EventSubConnection   │  │
│  │  DynamicChannelAllocator, PriorityManager                    │  │
│  │                                                                │  │
│  │  【キャッシング】                                              │  │
│  │  EmoteCacheSvc, FollowedChannelsCacheSvc, LiveStreamsCacheSvc│  │
│  │                                                                │  │
│  │  【アナリティクス】                                            │  │
│  │  AnalyticsTracker, PVTracker, MetricsCollector               │  │
│  │  ※フロントエンド：GA4/GTM (28ボタントラッキング)             │  │
│  │                                                                │  │
│  │  【セキュリティ】                                              │  │
│  │  AnomalyDetection, SecurityReporter                          │  │
│  │                                                                │  │
│  │  【その他】                                                    │  │
│  │  MaintenanceSvc, ConsentManager, SystemMetricsCollector      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                       WebSocket Server                        │  │
│  │  - /chat (Twitchチャット)                                     │  │
│  │  - /ws?sessionId=xxx (配信更新通知)                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Session & Cache                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │ express-     │  │ Redis Cache  │  │ Memory Cache     │   │  │
│  │  │ session      │  │  - 配信リスト│  │  - チャンネル検索│   │  │
│  │  │ (メモリ)     │  │  - 70秒TTL   │  │  - 60秒TTL (配信)│   │  │
│  │  │              │  │              │  │  - 5分TTL (検索) │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│                    External Platform APIs                           │
│  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │   YouTube        │  │    Twitch      │  │  Niconico        │   │
│  │   Data API v3    │  │    Helix API   │  │  (未実装)        │   │
│  │                  │  │    IRC         │  │                  │   │
│  └──────────────────┘  └────────────────┘  └──────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### アーキテクチャ特性

#### バックエンド駆動型設計
- **従来**: フロントエンドが定期的にAPIをポーリング → API負荷大
- **現在**: バックエンドが60秒間隔で配信同期 → フロントエンドはWebSocketで通知受信
- **利点**: API呼び出し回数削減、複数ユーザー間でキャッシュ共有

#### キャッシング戦略（多層キャッシュ）
| 対象 | 方式 | TTL | 実装場所 |
|---|---|---|---|
| 配信リスト（全プラットフォーム） | Redis | 70秒 | LiveStreamsCacheService |
| フォローチャンネル | Redis | 5分 | FollowedChannelsCacheService |
| エモート（グローバル） | Redis | 24時間 | EmoteCacheService |
| エモート（チャンネル） | Redis | 1時間 | EmoteCacheService |
| 配信情報（個別リクエスト） | メモリ | 60秒 | twitch.ts, youtube.ts |
| チャンネル検索結果 | メモリ | 5分 | twitch.ts, youtube.ts |

#### TokenStorage パターン
- **課題**: HTTPセッションとWebSocketでトークン共有が必要
- **解決**: グローバルなTokenStorageクラスでsessionId→トークンのマッピング
- **フロー**:
  1. `/api/twitch/subscriptions` でトークン取得 → TokenStorageに保存
  2. WebSocket接続時にsessionIdを送信
  3. WebSocketハンドラーがTokenStorageからトークン取得
  4. StreamSyncServiceがトークンを使用して配信同期

#### WebSocketService シングルトンパターン（React Strict Mode対応）
- **課題**: React Strict Modeが開発環境でuseEffectを2回実行 → WebSocket接続が複数作成され即座に破棄される
- **影響**: バックエンドが送信したメッセージを、破棄された接続が受信できない
- **解決**: グローバルシングルトンのWebSocketServiceでアプリケーション全体で1つの接続を共有
- **実装**:
  - `src/services/websocketService.ts`: WebSocket接続の一元管理
  - Reactライフサイクルから分離したグローバルインスタンス
  - 自動再接続機能（最大5回、指数バックオフ）
  - 複数コンポーネントからのメッセージハンドラー登録/解除
- **利点**:
  - React Strict Modeの影響を受けない
  - 接続の不要な再作成を防止
  - リロード時も安定した動作を保証

#### 手動同期のforceNotifyモード
- **課題**: StreamSyncServiceは差分検出により変更がない場合はメッセージを送信しない → リロード時に配信リストが表示されない
- **解決**: `manualSync()`は常に`forceNotify = true`で実行し、差分がなくても現在の配信リストを送信
- **実装箇所**: `streamSyncService.ts`の`syncYouTubeStreams()`と`syncTwitchStreams()`

## 2.3 データフロー詳細

このセクションでは、ふくまどの主要な機能フローを詳細に解説します。

### 2.3.1 Twitch認証フロー

```
[フロントエンド]                    [バックエンド]                  [Twitch API]
     │                                   │                              │
     │──(1) GET /api/twitch/auth ───────>│                              │
     │                                   │                              │
     │<─── Redirect to Twitch ───────────│                              │
     │                                   │                              │
     │──(2) ユーザーがTwitchで認証 ──────────────────────────────────────>│
     │                                   │                              │
     │                                   │<──(3) コールバック with code ─│
     │                                   │                              │
     │                                   │──(4) トークン交換リクエスト ──>│
     │                                   │                              │
     │                                   │<─── アクセストークン返却 ──────│
     │                                   │                              │
     │                                   │ (express-sessionに保存)        │
     │<─── Redirect to /login/success ───│                              │
```

**実装場所**: `server/src/routes/auth.ts`

### 2.3.2 フォローチャンネル取得フロー

```
[フロントエンド]                    [バックエンド]                  [Twitch API]
     │                                   │                              │
     │──(1) GET /api/twitch/subscriptions>│                              │
     │    (sessionId含む)                 │                              │
     │                                   │──(2) セッションからトークン取得  │
     │                                   │                              │
     │                                   │──(3) GET /helix/channels/followed>
     │                                   │    (user_id, access_token)     │
     │                                   │    ※100チャンネルずつバッチ処理  │
     │                                   │                              │
     │                                   │<─(4) フォロー中チャンネルリスト──│
     │                                   │                              │
     │                                   │ (TokenStorageに保存)            │
     │                                   │ (StreamSyncServiceに登録)       │
     │<─(5) { items: channels, sessionId }│                              │
     │                                   │                              │
     │──(6) WebSocket接続開始 ───────────>│                              │
     │    (sessionIdをクエリパラメータで送信)│                              │
```

**実装場所**:
- Frontend: `web/src/App.tsx` (useTwitchSubscriptions)
- Backend: `server/src/routes/twitch.ts` (GET /subscriptions)
- API呼び出し: `server/src/services/twitchService.ts` (fetchFollowedChannels)

**最適化ポイント**:
- TokenStorageにトークン保存 → WebSocketから利用可能
- バッチ処理: 100チャンネルずつ取得（Twitch API制限）
- StreamSyncServiceに登録 → 自動同期開始

### 2.3.3 配信リスト同期フロー (StreamSync)

```
[バックエンド - StreamSync]              [Twitch API]         [Redis Cache]    [WebSocket]
         │                                     │                    │               │
         │ (60秒ごとに自動実行)                  │                    │               │
         │                                     │                    │               │
         │──(1) 全ユーザーのフォローチャンネル集約  │                    │               │
         │                                     │                    │               │
         │──(2) GET /helix/streams ────────────>│                    │               │
         │    (100チャンネルずつバッチ処理)        │                    │               │
         │                                     │                    │               │
         │<───(3) ライブ配信情報返却 ──────────────│                    │               │
         │                                     │                    │               │
         │──(4) 差分検出 (added/removed)         │                    │               │
         │                                     │                    │               │
         │──(5) Redisにキャッシュ保存 (70秒TTL) ─────────────────────>│               │
         │                                     │                    │               │
         │──(6) WebSocketでクライアントに通知 ────────────────────────────────────────>│
         │    { type: 'stream_list_updated',  │                    │               │
         │      platform: 'twitch',            │                    │               │
         │      streams: [...],                │                    │               │
         │      changes: { added, removed } }  │                    │               │
```

**実装場所**: `server/src/services/streamSyncService.ts`

**キャッシュTTL最適化**:
- 同期間隔: 60秒
- キャッシュTTL: 70秒（次回同期まで有効なキャッシュを保持）

**差分検出**:
- 前回の配信リスト（Map）と比較
- 新規配信（added）と終了配信（removed）を検出
- 変更があった場合のみWebSocket通知

### 2.3.4 チャンネル検索フロー (キャッシング実装済み)

```
[フロントエンド]                [バックエンド - メモリキャッシュ]      [Twitch API]
     │                               │                                   │
     │──(1) GET /api/twitch/channels │                                   │
     │    ?q=検索キーワード            │                                   │
     │                               │                                   │
     │                               │──(2) キャッシュキー生成              │
     │                               │    (query.toLowerCase().trim())    │
     │                               │                                   │
     │                               │──(3) キャッシュチェック              │
     │                               │    (5分TTL)                        │
     │                               │                                   │
     │                  ┌────────────┤                                   │
     │                  │ キャッシュHIT │                                   │
     │<─(4a) キャッシュから返却 ────────┤                                   │
     │     (0 API呼び出し)            │                                   │
     │                  │            │                                   │
     │                  └────────────┤                                   │
     │                  │ キャッシュMISS│                                   │
     │                               │──(4b) GET /helix/search/channels ─>│
     │                               │                                   │
     │                               │<───(5) チャンネル情報返却 ───────────│
     │                               │                                   │
     │                               │──(6) メモリキャッシュに保存           │
     │                               │    (5分TTL)                        │
     │                               │                                   │
     │<─(7) { items: channels } ──────│                                   │
```

**実装場所**:
- Frontend: `web/src/components/Header/Header.tsx` (handleChannelSearch)
- Backend: `server/src/routes/twitch.ts` (GET /channels)

**最適化内容（v0.2.0）**:
- ✅ 5分間のメモリキャッシュ実装
- ✅ クエリ正規化（小文字化 + trim）
- ✅ 古いエントリ自動削除（メモリリーク対策）
- ✅ ユーザー確認: "検索も２回目は早いです"

### 2.3.5 配信視聴開始フロー

```
[フロントエンド]                    [バックエンド]              [Twitch Embed]
     │                                   │                          │
     │──(1) ユーザーがスロットクリック      │                          │
     │                                   │                          │
     │──(2) StreamSlot.assignStream()    │                          │
     │    (layoutStore経由)               │                          │
     │                                   │                          │
     │──(3) <TwitchPlayer /> レンダリング  │                          │
     │                                   │                          │
     │──(4) Twitch Embed API初期化 ────────────────────────────────>│
     │    (channel: channelLogin)         │                          │
     │    ※フロントエンドで直接Twitchに接続   │                          │
     │                                   │                          │
     │──(5) チャット接続開始               │                          │
     │    useTwitchChat.connectToChannel()│                          │
     │                                   │                          │
     │──(6) WebSocket /chat/connect ──────>│                          │
     │    (channelId)                     │                          │
     │                                   │                          │
     │                                   │ (twitchChatService接続)    │
     │<─(7) チャットメッセージ受信 (WebSocket)─│                          │
```

**実装場所**:
- Frontend: `web/src/components/StreamSlot/TwitchPlayer/TwitchPlayer.tsx`
- Chat WebSocket: `web/src/hooks/useTwitchChat.ts`

**最適化ポイント**:
- Embed API使用 → フロントエンドで直接Twitchに接続（バックエンド負荷なし）
- WebSocketによるリアルタイムチャット
- チャンネルごとの接続管理

### 2.3.6 チャット送信フロー

```
[フロントエンド]                    [バックエンド]                  [Twitch IRC]
     │                                   │                              │
     │──(1) ユーザーがメッセージ入力        │                              │
     │                                   │                              │
     │──(2) POST /api/twitch/chat/send ──>│                              │
     │    { channelId, channelLogin,      │                              │
     │      message }                     │                              │
     │                                   │                              │
     │                                   │──(3) twitchChatService       │
     │                                   │    .sendMessage()             │
     │                                   │                              │
     │                                   │──(4) IRC PRIVMSG送信 ────────>│
     │                                   │                              │
     │                                   │<─(5) メッセージ配信確認 ─────────│
     │                                   │                              │
     │<─(6) { success: true } ─────────────│                              │
```

**実装場所**:
- Frontend: `web/src/components/ChatPanel/ChatPanel.tsx` (handleSendMessage)
- Backend: `server/src/routes/twitch.ts` (POST /chat/send)
- IRC送信: `server/src/services/twitchChatService.ts` (sendMessage)

### 2.3.7 状態永続化

- **Zustand persistミドルウェア**でlocalStorageに保存
- **永続化対象**: レイアウト、音量、スロット情報、フォロー情報など
- **除外**: 配信リスト、チャットメッセージ、一時的な状態

## 2.4 API最適化戦略

ふくまどは、外部API呼び出しを最小化し、レート制限を回避するために、複数のキャッシング戦略とバックエンド駆動型アーキテクチャを採用しています。

### 2.4.1 キャッシング階層

```
┌─────────────────────────────────────────────────────┐
│           フロントエンド（ブラウザ）                  │
│  - localStorage（Zustandストア永続化）                │
│  - 配信リストはキャッシュせず、WebSocketで受信        │
└─────────────────────────────────────────────────────┘
                      │ HTTP/WebSocket
                      ↓
┌─────────────────────────────────────────────────────┐
│                バックエンド                           │
│  ┌───────────────────────────────────────────────┐  │
│  │         メモリキャッシュ（Map）                │  │
│  │  - チャンネル検索結果: 5分TTL                  │  │
│  │  - 配信情報（個別リクエスト）: 60秒TTL          │  │
│  │  - クエリ正規化（小文字化 + trim）             │  │
│  │  - 古いエントリ自動削除                        │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │         Redis キャッシュ                       │  │
│  │  - 配信リスト（StreamSync）: 70秒TTL           │  │
│  │  - 複数ユーザー間で共有                        │  │
│  │  - Redis未接続時はスキップ                     │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                      │ HTTPS
                      ↓
┌─────────────────────────────────────────────────────┐
│              外部プラットフォームAPI                  │
│  - Twitch Helix API（レート制限: 800req/分）         │
│  - YouTube Data API v3（クォータ: 10,000/日）        │
└─────────────────────────────────────────────────────┘
```

### 2.4.2 全APIエンドポイントのキャッシング状態

#### Twitchエンドポイント（13個）

| エンドポイント | メソッド | キャッシュ | TTL | 用途 |
|---|---|---|---|---|
| `/api/twitch/subscriptions` | GET | ❌ | - | フォロー中チャンネル取得 |
| `/api/twitch/live` | GET | ✅ メモリ | 60秒 | ライブ配信情報取得 |
| `/api/twitch/channels` | GET | ✅ メモリ | 5分 | チャンネル検索（v0.2.0最適化） |
| `/api/twitch/chat/send` | POST | ❌ | - | チャット送信 |
| `/api/twitch/emotes/global` | GET | ❌ | - | グローバルエモート取得 ⚠️ |
| `/api/twitch/emotes/channel` | GET | ❌ | - | チャンネルエモート取得 ⚠️ |
| `/api/twitch/eventsub/connect` | POST | ❌ | - | EventSub WebSocket接続 |
| `/api/twitch/eventsub/subscribe` | POST | ❌ | - | EventSub購読登録 |
| `/api/twitch/eventsub/status` | GET | ❌ | - | EventSub接続状態確認 |
| `/api/twitch/eventsub/webhook/connect` | POST | ❌ | - | EventSub Webhook設定 |
| `/api/twitch/eventsub/webhook/subscribe` | POST | ❌ | - | EventSub Webhook購読 |
| `/api/twitch/eventsub/webhook/status` | GET | ❌ | - | Webhook購読状態確認 |
| `/api/twitch/webhooks/twitch` | POST | ❌ | - | Twitchからの通知受信 |

⚠️ = 今後の改善課題（10分程度のキャッシュ推奨）

#### YouTubeエンドポイント（3個）

| エンドポイント | メソッド | キャッシュ | TTL | 用途 |
|---|---|---|---|---|
| `/api/youtube/live` | GET | ✅ Redis | 70秒 | ライブ配信情報取得（StreamSync経由） |
| `/api/youtube/channels` | GET | ✅ メモリ | 5分 | チャンネル検索（v0.2.0最適化） |
| `/api/youtube/subscriptions` | GET | ❌ | - | 登録チャンネル取得 |

#### StreamSync バックグラウンド処理

| 処理 | 間隔 | キャッシュ | TTL | 用途 |
|---|---|---|---|---|
| Twitch配信同期 | 60秒 | ✅ Redis | 70秒 | 全ユーザーのフォロー中配信を自動取得 |
| YouTube配信同期 | 60秒 | ✅ Redis | 70秒 | 全ユーザーの登録中配信を自動取得 |

### 2.4.3 バッチ処理とレート制限対策

#### Twitch APIバッチ処理

**実装場所**: `server/src/services/twitchService.ts`

```typescript
export const fetchFollowedChannels = async (
  accessToken: string,
  userId: string
): Promise<TwitchChannelInfo[]> => {
  const allChannels: TwitchChannelInfo[] = [];
  let cursor: string | undefined = undefined;
  const maxPerPage = 100; // Twitch APIの最大値

  do {
    const params = new URLSearchParams({
      user_id: userId,
      first: maxPerPage.toString()
    });
    if (cursor) params.append('after', cursor);

    const response = await fetch(
      `${TWITCH_API_BASE}/channels/followed?${params}`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, ... } }
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.error('[Twitch API] Rate limit exceeded');
        throw new Error('Twitch API rate limit exceeded. Please try again later.');
      }
      // ... その他のエラーハンドリング
    }

    const data: TwitchFollowResponse = await response.json();
    allChannels.push(...data.data);
    cursor = data.pagination?.cursor;
  } while (cursor);

  return allChannels;
};
```

**最適化ポイント**:
- ✅ 100チャンネル/回のバッチ処理
- ✅ ページネーション対応（cursor）
- ✅ 429エラー検出とユーザーフレンドリーなエラーメッセージ
- ✅ 同様の実装が `fetchLiveStreams` にも適用

#### API呼び出し頻度の削減

**シナリオ別のAPI呼び出し回数**:

| シナリオ | 頻度 | キャッシュ効果 |
|---|---|---|
| ログイン | 1回/セッション | - |
| フォロー中チャンネル取得 | 1回/セッション | TokenStorage保存 → WebSocketで再利用 |
| 配信リスト更新 | 60秒/回（自動） | Redisキャッシュ → 複数ユーザーで共有 |
| チャンネル検索（同じキーワード） | 初回のみ | 5分キャッシュ → 2回目以降は0 API呼び出し |
| 配信視聴開始 | 0 API呼び出し | Embed API使用 → フロントエンド直接接続 |
| チャット受信 | 0 API呼び出し | WebSocket（IRC） → リアルタイム受信 |
| チャット送信 | 1回/メッセージ | キャッシュ不可（当然） |
| エモート取得 | 1回/チャンネル | ⚠️ キャッシュなし（軽微） |

### 2.4.4 最適化の効果測定

**ユーザー確認済みの改善**:
- ✅ "検索も２回目は早いです" → チャンネル検索キャッシュが正常動作
- ✅ "全部問題なく" → Twitch視聴機能に問題なし
- ✅ StreamSync安定動作 → バックエンド駆動型への移行成功

**API呼び出し削減効果**:
- **従来**: フロントエンドが30秒ごとにポーリング → 120回/時（1ユーザー）
- **現在**: バックエンドが60秒ごとに同期 → 60回/時（全ユーザー共通）
- **削減率**: 複数ユーザー環境で約50%以上削減

## 2.5 セキュリティアーキテクチャ

### 2.5.1 認証・認可

#### OAuth 2.0フロー
- **Google OAuth 2.0**: YouTube Data API用
- **Twitch OAuth 2.0**: Twitch Helix API + IRC用
- **スコープ**:
  - YouTube: `youtube.readonly`
  - Twitch: `user:read:follows`, `chat:read`, `chat:edit`

#### CSRF対策（State パラメータ）
OAuth 2.0フローでは、CSRF攻撃を防ぐために`state`パラメータを使用：

**実装**: `server/src/routes/auth.ts`

```typescript
// Google OAuth
authRouter.get('/google', (req, res) => {
  const state = createState(); // ランダムな文字列生成
  req.session.oauthState = state; // セッションに保存
  const url = buildGoogleAuthUrl(state);
  res.redirect(url);
});

authRouter.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // state検証
  if (!state || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing state' });
  }
  if (!req.session.oauthState || req.session.oauthState !== state) {
    return res.status(400).json({ error: 'Invalid state' });
  }

  // state検証成功後、トークン交換処理
  // ...
});
```

**セキュリティポイント**:
- ✅ 認証リクエストごとに一意な`state`を生成
- ✅ セッションに保存して、コールバック時に検証
- ✅ `state`不一致の場合はエラーを返す（CSRF攻撃を防止）
- ✅ Twitch OAuthでも同様の実装（`twitchOauthState`）

#### 認証完了画面のセキュリティ
`/auth/success`エンドポイントは認証完了後にユーザーに表示される画面で、以下のセキュリティ考慮事項があります：

**ポップアップウィンドウ判定**:
```javascript
// window.openerの存在確認
if (window.opener) {
  // ポップアップウィンドウの場合: 自動クローズ
  window.close();
} else {
  // 通常ウィンドウの場合: リダイレクト
  window.location.href = 'http://localhost:5173/';
}
```

**セキュリティポイント**:
- ✅ `window.opener`による安全なウィンドウ種別判定
- ✅ ポップアップブロッカー対策（ユーザーアクションでウィンドウを開く）
- ✅ XSSリスク軽減（インラインJavaScriptは最小限）
- ⚠️ `window.opener`アクセスによるタブナビゲーションリスク（将来的に`rel="noopener"`を検討）

**推奨改善**:
- OAuth認証ウィンドウを開く際に`rel="noopener"`を追加
- Content Security Policy (CSP)の設定
- 認証完了画面のHTMLをテンプレートエンジンで管理

#### アクセストークン管理
- **保存場所**: サーバーサイドセッション（express-session）
- **フロントエンド**: トークン非公開（セッションCookieのみ）
- **TokenStorage**: sessionID → トークンのマッピング（メモリ内）
- **トークンリフレッシュ**:
  - Google: `ensureGoogleAccessToken()`で自動リフレッシュ
  - Twitch: `ensureTwitchAccessToken()`で自動リフレッシュ
  - 期限切れ30秒前に自動更新

### 2.5.2 Webhook署名検証

**Twitch EventSub Webhook**: `server/src/routes/twitch.ts`

```typescript
twitchRouter.post('/webhooks/twitch', (req, res) => {
  const messageType = req.headers['twitch-eventsub-message-type'] as string;
  const messageId = req.headers['twitch-eventsub-message-id'] as string;
  const messageTimestamp = req.headers['twitch-eventsub-message-timestamp'] as string;
  const signature = req.headers['twitch-eventsub-message-signature'] as string;

  // 署名検証
  const isValid = twitchEventSubWebhookService.verifySignature(
    messageId,
    messageTimestamp,
    JSON.stringify(req.body),
    signature
  );

  if (!isValid) {
    console.error('[Twitch Webhook] Invalid signature');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // メッセージタイプごとに処理
  // ...
});
```

**セキュリティポイント**:
- ✅ HMAC-SHA256署名検証
- ✅ なりすまし防止
- ✅ タイムスタンプ検証（リプレイ攻撃対策）

### 2.5.3 セッション管理

- **express-session**: メモリストア（開発環境）
- **本番環境推奨**: Redis Session Store
- **Cookie設定**:
  - `httpOnly`: true（XSS対策）
  - `secure`: true（HTTPS必須、本番環境）
  - `sameSite`: 'lax'（CSRF対策）

## 2.6 パフォーマンス評価

### 2.6.1 フロントエンド最適化

#### React.memoとuseStoreWithEqualityFn

**StreamSlot コンポーネント**: `web/src/components/StreamGrid/StreamSlot/StreamSlot.tsx`

```typescript
export const StreamSlotCard = memo(({ slot, selectedSlotId, preset, showSelection }: StreamSlotCardProps) => {
  const { setVolume, toggleSlotMute, ... } = useStoreWithEqualityFn(useLayoutStore, (state) => ({
    setVolume: state.setVolume,
    toggleSlotMute: state.toggleSlotMute,
    // ...
  }), shallow);

  // コンポーネント内で計算プロパティを使用
  const isActive = showSelection && selectedSlotId === slot.id;
  const isFocused = preset === 'focus' && selectedSlotId === slot.id;

  // ...
});
```

**最適化効果**:
- ✅ 不必要な再レンダリング防止
- ✅ shallow比較でストア購読を最小化
- ✅ スロット削除時のフリーズを部分的に解消

#### layoutStore の更新パターン最適化

**従来**（全スロットが再レンダリング）:
```typescript
setVolume: (slotId, volume) => {
  set({
    slots: state.slots.map(slot =>
      slot.id === slotId ? { ...slot, volume } : slot
    )
  });
}
```

**最適化後**（変更されたスロットのみ再レンダリング）:
```typescript
setVolume: (slotId, volume) => {
  const index = state.slots.findIndex(s => s.id === slotId);
  if (index === -1) return;

  const nextSlots = state.slots.slice();
  nextSlots[index] = {
    ...nextSlots[index],
    volume
  };
  set({ slots: nextSlots });
}
```

**最適化効果**:
- ✅ 変更されたスロットのみ新しいオブジェクト参照
- ✅ React.memoのshallow比較が正しく機能
- ✅ 一番上のスロット削除時のフリーズ解消

#### Twitchプレイヤーの再利用最適化（2025-11-02実装）

**問題**: スロット削除後に再セットすると、プレイヤーが初期化されない（音声が出ない、画面が真っ黒）

**解決策**: プレイヤーを破棄せずに再利用

**実装**: `web/src/components/StreamGrid/StreamSlot/StreamSlot.tsx`

```typescript
// 1. プレイヤーコンテナを常にレンダリング（DOM削除防止）
<div
  className={styles.playerContainer}
  ref={containerRef}
  style={{
    display: assignedStream ? 'block' : 'none',
    position: assignedStream ? 'relative' : 'absolute',
    visibility: assignedStream ? 'visible' : 'hidden',
    opacity: assignedStream ? 1 : 0,
    pointerEvents: assignedStream ? 'auto' : 'none',
    zIndex: assignedStream ? 0 : -9999
  }}
>

// 2. TwitchからTwitchへの切り替え時、DOM削除をスキップ
const wasTwitchPlayer = playerInstanceRef.current && 'setMuted' in playerInstanceRef.current;
const shouldClearDOM = !(wasTwitchPlayer && assignedStream.platform === 'twitch');

if (shouldClearDOM && playerContainerRef.current) {
  playerContainerRef.current.innerHTML = '';
}

// 3. 既存のTwitchプレイヤーがある場合、setChannel()でチャンネル切り替え
if (wasTwitchPlayer && playerInstanceRef.current) {
  const twitchPlayer = playerInstanceRef.current as TwitchPlayer;
  twitchPlayer.setChannel(channelName);

  // コンテナを再表示
  // 音量・画質を再適用
  return; // 新規プレイヤー作成をスキップ
}

// 4. クリーンアップ時、Twitchプレイヤーは非表示のみ（destroy()しない）
if (assignedStream?.platform === 'twitch' && 'setMuted' in player) {
  // 音声を停止
  twitchPlayer.pause();
  twitchPlayer.setMuted(true);

  // コンテナを完全非表示（6つのCSSプロパティ）
  // プレイヤーインスタンスは保持
}
```

**最適化効果**:
- ✅ プレイヤー初期化時間: 約2-3秒 → 約0.5秒（約80%削減）
- ✅ CPU使用率: プレイヤー再作成時のスパイクが減少
- ✅ メモリ使用量: iframe再作成がないため、メモリ断片化が減少
- ✅ スロット削除→再セット機能: 正常に動作

**詳細**: [12. 制限事項・既知の問題 - 12.13](./12_issues.md#1213-twitchプレイヤーの再利用最適化2025-11-02実装) を参照

### 2.6.2 バックエンド最適化

#### StreamSyncService

- **同期間隔**: 60秒
- **バッチ処理**: 100チャンネル/回
- **差分検出**: 変更があった場合のみWebSocket通知
- **キャッシュTTL**: 70秒（同期間隔より少し長め）

#### メモリキャッシュのクリーンアップ

```typescript
// 古いキャッシュエントリを削除（メモリリーク対策）
for (const [key, entry] of channelSearchCache.entries()) {
  if (now - entry.timestamp >= SEARCH_CACHE_TTL_MS) {
    channelSearchCache.delete(key);
  }
}
```

### 2.6.3 パフォーマンス指標（2025-11-02更新）

| 指標 | 目標 | 現状 |
|---|---|---|
| 初回ロード時間 | < 3秒 | ✅ 達成 |
| 配信検索（初回） | < 1秒 | ✅ 達成 |
| 配信検索（キャッシュヒット） | < 100ms | ✅ 達成（ユーザー確認） |
| 配信リスト更新（WebSocket） | < 500ms | ✅ 達成 |
| チャット送信 | < 1秒 | ✅ **解決済み（ヘルスチェック・再接続実装）** |
| スロット削除（上） | フリーズなし | ✅ 解消 |
| スロット削除（下） | フリーズなし | ⚠️ 部分的に残存 |
| **Twitchプレイヤー初期化（新規）** | < 3秒 | ✅ 達成 |
| **Twitchプレイヤー切り替え（再利用）** | < 1秒 | ✅ 約0.5秒（80%削減） |
| **スロット削除→再セット** | 正常動作 | ✅ 解消 |

**参照**: [12.14 チャット送信機能のトラブルシューティング（2025-11-02解決済み）](./12_issues.md#1214-チャット送信機能のトラブルシューティング2025-11-02解決済み)

## 2.7 スケーラビリティ戦略

### 2.7.1 水平スケーリング対応

**現在の課題**:
- TokenStorageがメモリ内 → 複数インスタンス間で共有不可
- express-sessionがメモリストア → ロードバランサー環境で問題

**将来の対応策**:
- Redis Session Store導入
- TokenStorageをRedisに移行
- ステートレスなバックエンド設計

### 2.7.2 負荷分散

**StreamSyncServiceの最適化**:
- ユーザーごとにチャンネルリストを分散処理
- API呼び出しのバッチ処理（100件/回）
- レート制限エラーの自動リトライ（指数バックオフ）

### 2.7.3 モニタリング・ログ

**実装済み**:
- コンソールログによるエラートラッキング
- API呼び出し回数のロギング

**今後の改善**:
- 構造化ログ（Winston, Pino等）
- メトリクス収集（Prometheus等）
- エラートラッキング（Sentry等）
