# 4. データモデル（型定義）

## 4.1 基本型（src/types/index.ts）

### Platform
```typescript
export type Platform = 'youtube' | 'twitch' | 'niconico';
```
配信プラットフォームの種類。

**使用例**:
```typescript
const stream: Streamer = {
  platform: 'twitch',
  // ...
};
```

### VideoQuality
```typescript
export type VideoQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';
```
動画画質設定。

**画質と帯域幅の対応**:
| 画質 | 推定帯域幅 | 推奨用途 |
|---|---|---|
| auto | 可変 | 自動調整（推奨） |
| 1080p | ~6 Mbps | 高速回線向け |
| 720p | ~3 Mbps | 標準画質 |
| 480p | ~1.5 Mbps | 低速回線向け |
| 360p | ~0.7 Mbps | モバイル向け |

### QualityBandwidth
```typescript
export interface QualityBandwidth {
  quality: VideoQuality;
  label: string;          // 表示ラベル
  mbps: number;           // 推定帯域幅（Mbps）
}
```

**使用例**:
```typescript
const qualityOptions: QualityBandwidth[] = [
  { quality: 'auto', label: '自動', mbps: 0 },
  { quality: '1080p', label: 'フルHD', mbps: 6 },
  { quality: '720p', label: 'HD', mbps: 3 },
  // ...
];
```

## 4.2 配信関連型

### Streamer
```typescript
export interface Streamer {
  id: string;                 // 配信ID (YouTube: videoId, Twitch: streamId)
  platform: Platform;         // プラットフォーム
  title: string;              // 配信タイトル
  displayName: string;        // 表示名
  channelId?: string;         // チャンネルID
  channelLogin?: string;      // チャンネルログイン名 (Twitch用)
  channelTitle?: string;      // チャンネル名
  thumbnailUrl?: string;      // サムネイルURL
  liveSince?: string;         // 配信開始時刻 (ISO 8601)
  viewerCount?: number;       // 視聴者数
  gameTitle?: string;         // ゲームタイトル
  description?: string;       // 説明文
  embedUrl?: string;          // 埋め込みURL
}
```

**プラットフォーム別の ID 形式**:
- **YouTube**: `videoId` (例: `dQw4w9WgXcQ`)
- **Twitch**: `streamId` (数値文字列、例: `123456789`)
- **ニコニコ**: `lv123456789`

**使用例**:
```typescript
const twitchStream: Streamer = {
  id: '987654321',
  platform: 'twitch',
  title: '【Apex Legends】ランク配信',
  displayName: 'example_user',
  channelId: '12345678',
  channelLogin: 'example_user',
  channelTitle: 'Example User',
  thumbnailUrl: 'https://static-cdn.jtvnw.net/...',
  liveSince: '2025-10-26T10:00:00Z',
  viewerCount: 1234,
  gameTitle: 'Apex Legends',
  embedUrl: 'https://player.twitch.tv/?channel=example_user'
};
```

### StreamSlot
```typescript
export interface StreamSlot {
  id: string;                 // スロットID (slot-1 ~ slot-8)
  assignedStream?: Streamer;  // 割り当てられた配信
  muted: boolean;             // ミュート状態
  volume: number;             // 音量 (0-100)
  quality: VideoQuality;      // 画質設定
}
```

**スロットID の命名規則**:
- `slot-1`, `slot-2`, ..., `slot-8`
- 固定8スロット（レイアウトに応じて表示数が変わる）

**デフォルト値**:
```typescript
const defaultSlot: StreamSlot = {
  id: 'slot-1',
  assignedStream: undefined,
  muted: false,
  volume: 50,
  quality: 'auto'
};
```

## 4.3 チャット関連型

### TwitchEmote
```typescript
export interface TwitchEmote {
  id: string;                                      // エモートID
  positions: Array<{ start: number; end: number }>; // テキスト内の位置
}
```

**使用例**:
```typescript
const emote: TwitchEmote = {
  id: '25',  // Kappa
  positions: [
    { start: 0, end: 4 },    // "Kappa"
    { start: 10, end: 14 }   // 2回目の "Kappa"
  ]
};

// メッセージ: "Kappa test Kappa"
//              ^^^^^      ^^^^^
//              0-4        10-14
```

### TwitchBadge
```typescript
export interface TwitchBadge {
  setId: string;              // バッジセットID
  version: string;            // バージョン
  imageUrl?: string;          // 画像URL
}
```

**バッジの種類**:
- `broadcaster`: 配信者
- `moderator`: モデレーター
- `vip`: VIP
- `subscriber`: サブスクライバー
- `premium`: Turbo/Prime

**使用例**:
```typescript
const badges: TwitchBadge[] = [
  {
    setId: 'broadcaster',
    version: '1',
    imageUrl: 'https://static-cdn.jtvnw.net/badges/v1/...'
  },
  {
    setId: 'subscriber',
    version: '6',
    imageUrl: 'https://static-cdn.jtvnw.net/badges/v1/...'
  }
];
```

### ChatMessage
```typescript
export interface ChatMessage {
  id: string;                 // メッセージID
  platform: Platform | 'system'; // プラットフォーム
  author: string;             // 投稿者名
  message: string;            // メッセージ本文
  timestamp: string;          // タイムスタンプ
  avatarColor: string;        // アバター色
  highlight?: boolean;        // ハイライト表示
  channelName?: string;       // チャンネル名
  // Twitch固有
  emotes?: TwitchEmote[];     // エモート情報
  badges?: TwitchBadge[];     // バッジ情報
  bits?: number;              // Bitsチア額
  isSubscriber?: boolean;     // サブスク登録者か
  isModerator?: boolean;      // モデレーターか
  isVip?: boolean;            // VIPか
}
```

**プラットフォーム別の特性**:

| プラットフォーム | エモート | バッジ | Bits | 特殊機能 |
|---|---|---|---|---|
| Twitch | ✅ | ✅ | ✅ | サブスク、VIP |
| YouTube | ✅ | ✅ | ❌ | スーパーチャット |
| ニコニコ | ❌ | ❌ | ❌ | ニコニ広告 |
| system | ❌ | ❌ | ❌ | システムメッセージ |

**使用例**:
```typescript
const twitchMessage: ChatMessage = {
  id: 'msg_12345',
  platform: 'twitch',
  author: 'example_user',
  message: 'Kappa Great stream! Kappa',
  timestamp: '2025-10-26T10:30:00Z',
  avatarColor: '#FF6347',
  highlight: false,
  channelName: 'streamer_name',
  emotes: [
    { id: '25', positions: [{ start: 0, end: 4 }, { start: 20, end: 24 }] }
  ],
  badges: [
    { setId: 'subscriber', version: '6' }
  ],
  isSubscriber: true,
  isModerator: false,
  isVip: false
};

const systemMessage: ChatMessage = {
  id: 'sys_001',
  platform: 'system',
  author: 'System',
  message: 'チャットに接続しました',
  timestamp: new Date().toISOString(),
  avatarColor: '#888888'
};
```

## 4.4 レイアウト関連型

### LayoutPreset
```typescript
export type LayoutPreset = 'twoByTwo' | 'oneByTwo' | 'focus';
```

**レイアウトの詳細**:

#### twoByTwo (2x2グリッド)
```
┌─────────┬─────────┐
│ Slot 1  │ Slot 2  │
├─────────┼─────────┤
│ Slot 3  │ Slot 4  │
└─────────┴─────────┘
最大4スロット、均等サイズ
```

#### oneByTwo (1x2グリッド)
```
┌───────────┬───┐
│           │ 2 │
│  Slot 1   ├───┤
│   (大)    │ 3 │
└───────────┴───┘
メイン1 + サブ2
```

#### focus (フォーカスモード)
```
┌───────────────┐
│               │
│   Slot 1      │
│   (全画面)    │
│               │
└───────────────┘
1スロット大表示
```

### ChannelSearchResult
```typescript
export interface ChannelSearchResult {
  id: string;                 // チャンネルID
  platform: 'youtube' | 'twitch';
  title: string;              // チャンネル名
  description: string;        // 説明
  thumbnailUrl: string;       // サムネイル
  customUrl?: string;         // カスタムURL
  login?: string;             // ログイン名 (Twitch)
}
```

**プラットフォーム別の特性**:
- **YouTube**: `customUrl` に `@username` 形式
- **Twitch**: `login` にログイン名（小文字）

**使用例**:
```typescript
const youtubeChannel: ChannelSearchResult = {
  id: 'UCxxxxxx',
  platform: 'youtube',
  title: 'Example Channel',
  description: 'チャンネルの説明',
  thumbnailUrl: 'https://yt3.ggpht.com/...',
  customUrl: '@examplechannel'
};

const twitchChannel: ChannelSearchResult = {
  id: '12345678',
  platform: 'twitch',
  title: 'Example User',
  description: 'Twitch streamer',
  thumbnailUrl: 'https://static-cdn.jtvnw.net/...',
  login: 'example_user'
};
```

## 4.5 通知関連型

### NotificationType
```typescript
export type NotificationType = 'stream_started';
```

**将来の拡張候補**:
- `stream_ended`: 配信終了
- `stream_title_changed`: タイトル変更
- `stream_game_changed`: ゲーム変更
- `follower_milestone`: フォロワー達成

### Notification
```typescript
export interface Notification {
  id: string;                 // 通知ID
  type: NotificationType;     // 通知タイプ
  platform: Platform;         // プラットフォーム
  channelId: string;          // チャンネルID
  channelName: string;        // チャンネル名
  streamId: string;           // 配信ID
  streamTitle: string;        // 配信タイトル
  thumbnailUrl?: string;      // サムネイル
  timestamp: number;          // タイムスタンプ（ミリ秒）
  read: boolean;              // 既読フラグ
}
```

**使用例**:
```typescript
const notification: Notification = {
  id: 'notif_001',
  type: 'stream_started',
  platform: 'twitch',
  channelId: '12345678',
  channelName: 'example_user',
  streamId: '987654321',
  streamTitle: '【Apex Legends】ランク配信',
  thumbnailUrl: 'https://static-cdn.jtvnw.net/...',
  timestamp: Date.now(),
  read: false
};
```

### NotificationSettings
```typescript
export interface NotificationSettings {
  enabled: boolean;           // 通知有効/無効
  youtube: boolean;           // YouTube通知
  twitch: boolean;            // Twitch通知
  sound: boolean;             // 通知音
}
```

**デフォルト設定**:
```typescript
const defaultSettings: NotificationSettings = {
  enabled: true,
  youtube: true,
  twitch: true,
  sound: true
};
```

## 4.6 同期関連型

### SyncInterval
```typescript
export type SyncInterval = 30000 | 60000 | 180000 | 300000; // ミリ秒
```

**間隔の選択肢**:
- `30000`: 30秒（頻繁な更新、API負荷高）
- `60000`: 1分（推奨）
- `180000`: 3分（低負荷）
- `300000`: 5分（最低限の同期）

### SyncSettings
```typescript
export interface SyncSettings {
  enabled: boolean;           // 自動同期有効/無効
  interval: SyncInterval;     // 同期間隔
  lastSyncTime?: number;      // 最終同期時刻（ミリ秒）
}
```

**使用例**:
```typescript
const syncSettings: SyncSettings = {
  enabled: true,
  interval: 60000,  // 1分
  lastSyncTime: Date.now()
};
```

## 4.7 データ使用量関連型

### DataUsageState
```typescript
interface DataUsageState {
  totalBytes: number;         // 合計データ使用量（バイト）
  sessionStartTime: number;   // セッション開始時刻
  addUsage: (bytes: number) => void;    // データ使用量を追加
  reset: () => void;                    // リセット
  getTotalMB: () => number;             // MB単位で取得
  getTotalGB: () => number;             // GB単位で取得
  getSessionDuration: () => number;     // セッション経過時間（秒）
}
```

**実装場所**: `src/stores/dataUsageStore.ts`

**特徴**:
- セッションストレージに永続化（ページリロード時も保持）
- Resource Timing APIによる自動計測
- リアルタイム更新

## 4.8 アナリティクス関連型（src/types/analytics.ts）

### EventType
```typescript
export type EventType =
  | 'page_view'
  | 'layout_change'
  | 'button_click'
  | 'feature_use'
  | 'stream_action'
  | 'auth_action'
  | 'session_start'
  | 'session_end';
```

### ButtonType
```typescript
export type ButtonType =
  | 'sync_start'       // 同期開始
  | 'sync_stop'        // 同期停止
  | 'mute_all'         // 全ミュート
  | 'fullscreen'       // 全画面切り替え
  | 'layout_preset'    // レイアウトプリセット
  | 'slot_add'         // スロット追加
  | 'slot_remove'      // スロット削除
  | 'stream_search'    // 配信検索
  | 'auth_youtube'     // YouTube認証
  | 'auth_twitch'      // Twitch認証
  | 'logout';          // ログアウト
```

### FeatureType
```typescript
export type FeatureType =
  | 'chat'            // チャット機能
  | 'emote'           // エモート
  | 'search'          // 検索
  | 'sync'            // 同期
  | 'quality_change'; // 画質変更
```

### StreamActionType
```typescript
export type StreamActionType =
  | 'assign'          // 配信割り当て
  | 'clear'           // 配信クリア
  | 'mute'            // ミュート
  | 'unmute'          // ミュート解除
  | 'volume_change'   // 音量変更
  | 'quality_change'  // 画質変更
  | 'swap';           // スロット入れ替え
```

### AnalyticsEvent（共用型）
```typescript
export type AnalyticsEvent =
  | LayoutChangeEvent
  | ButtonClickEvent
  | FeatureUseEvent
  | StreamActionEvent
  | AuthActionEvent
  | SessionStartEvent
  | SessionEndEvent;
```

各イベント型には、以下の共通フィールド（BaseEventData）が含まれます：
- `sessionId`: セッションID
- `userId`: ユーザーID（認証済みの場合）
- `timestamp`: イベント発生時刻
- `userAgent`: ブラウザ情報
- `screenWidth/screenHeight`: 画面サイズ
- `deviceType`: デバイスタイプ（mobile/tablet/desktop）

**使用例**:
```typescript
const event: ButtonClickEvent = {
  type: 'button_click',
  sessionId: 'abc123',
  timestamp: new Date().toISOString(),
  deviceType: 'desktop',
  data: {
    buttonType: 'fullscreen',
    location: 'header'
  }
};
```

## 4.9 型のバリデーション

### ランタイムバリデーション例

```typescript
// Platform のバリデーション
export function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' &&
    ['youtube', 'twitch', 'niconico'].includes(value);
}

// VideoQuality のバリデーション
export function isVideoQuality(value: unknown): value is VideoQuality {
  return typeof value === 'string' &&
    ['auto', '1080p', '720p', '480p', '360p'].includes(value);
}

// Streamer のバリデーション
export function isStreamer(value: unknown): value is Streamer {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    isPlatform(obj.platform) &&
    typeof obj.title === 'string' &&
    typeof obj.displayName === 'string'
  );
}
```
