# 5. 状態管理（Zustand Stores）

ふくまど！では、Zustandライブラリを使用してグローバルな状態管理を行っています。各ストアは特定のドメインに責務を持ち、永続化ミドルウェアを使用してlocalStorageに保存されます。

## 5.1 layoutStore (src/stores/layoutStore.ts)

レイアウト、配信スロット、配信リスト、検索結果を管理する中心的なストア。

### State
```typescript
interface LayoutState {
  // レイアウト
  preset: LayoutPreset;
  activeSlotsCount: number;             // アクティブスロット数 (1-8)
  fullscreen: boolean;                  // 全画面モード

  // スロット
  slots: StreamSlot[];                  // 8スロット固定
  selectedSlotId: string | null;        // 選択中スロットID
  selectionTimestamp: number;           // 選択タイムスタンプ
  showSelection: boolean;               // 選択表示フラグ
  masterSlotId: string | null;          // マスタースロットID（同期用）

  // 音量
  mutedAll: boolean;                    // 全ミュート
  masterVolume: number;                 // マスター音量 (0-100)
  autoQualityEnabled: boolean;          // 自動画質有効

  // 配信リスト
  availableStreams: Streamer[];         // 視聴可能配信リスト
  streamsLoading: boolean;              // 配信リスト読込中
  streamsError?: string;                // エラーメッセージ

  // 検索
  searchQuery: string;                  // 検索クエリ
  channelSearchResults: ChannelSearchResult[]; // 検索結果
  channelSearchLoading: boolean;        // 検索中
  channelSearchError?: string;          // 検索エラー

  // モーダル
  pendingStream: Streamer | null;       // 割り当て待ち配信
  isModalOpen: boolean;                 // モーダル開閉状態

  // その他
  userInteracted: boolean;              // ユーザーインタラクション検出
  platforms: Platform[];                // 対応プラットフォーム
}
```

### Actions
```typescript
interface LayoutActions {
  // レイアウト
  setPreset: (preset: LayoutPreset) => void;
  setActiveSlotsCount: (count: number) => void;
  setFullscreen: (value: boolean) => void;

  // スロット選択
  selectSlot: (slotId: string) => void;
  clearSelection: () => void;
  setShowSelection: (value: boolean) => void;
  ensureSelection: () => void;

  // 配信割り当て
  assignStream: (slotId: string, stream: Streamer) => void;
  clearSlot: (slotId: string) => void;
  swapSlots: (sourceSlotId: string, targetSlotId: string) => void;
  setPendingStream: (stream: Streamer | null) => void;

  // 音量制御
  toggleMuteAll: () => void;
  toggleSlotMute: (slotId: string) => void;
  setVolume: (slotId: string, volume: number) => void;
  setMasterVolume: (volume: number) => void;

  // 画質制御
  setSlotQuality: (slotId: string, quality: VideoQuality) => void;
  setAutoQualityEnabled: (enabled: boolean) => void;

  // マスタースロット
  setMasterSlot: (slotId: string) => void;
  clearMasterSlot: () => void;

  // 配信リスト
  setAvailableStreamsForPlatform: (platform: Platform, streams: Streamer[]) => void;
  setStreamsLoading: (loading: boolean) => void;
  setStreamsError: (message?: string) => void;

  // 検索
  setSearchQuery: (query: string) => void;
  setChannelSearchResults: (results: ChannelSearchResult[]) => void;
  setChannelSearchLoading: (loading: boolean) => void;
  setChannelSearchError: (error?: string) => void;
  clearChannelSearch: () => void;

  // その他
  setUserInteracted: (value: boolean) => void;
  setModalOpen: (isOpen: boolean) => void;
}
```

### 永続化
- **ストレージ**: localStorage
- **キー**: `fukumado-layout`
- **バージョン**: 3
- **永続化対象**: preset, slots (配信情報除外), selectedSlotId, mutedAll, masterVolume, activeSlotsCount, autoQualityEnabled
- **除外**: availableStreams, pendingStream, isModalOpen, fullscreen, etc.

### 重要な仕様
- **スロット数**: 常に8スロット存在、`activeSlotsCount`で表示数を制御
- **スロット削減時**: 配信があるスロットを前方に詰める
- **選択タイムスタンプ**: 同じスロットを再選択してもタイムスタンプを更新
- **初期値**: デフォルト4スロット、音量70、自動画質ON

### パフォーマンス最適化
- **スロット更新パターン**: `map()`ではなく`slice()`+個別インデックス更新を使用
  - 変更されたスロットのみ新しいオブジェクト参照を持つ
  - React.memoのshallow比較が正しく機能
  - 不必要な再レンダリングを防止

  ```typescript
  // 最適化パターン例
  const nextSlots = state.slots.slice();
  nextSlots[index] = {
    ...nextSlots[index],
    volume: newVolume
  };
  return { slots: nextSlots };
  ```

- **影響を受ける関数**: assignStream, clearSlot, toggleSlotMute, setVolume, setSlotQuality

## 5.2 chatStore (src/stores/chatStore.ts)

チャットメッセージとフィルタを管理。

### State
```typescript
interface ChatState {
  filter: 'all' | Platform;               // フィルタ
  messages: ChatMessage[];                // メッセージリスト（最新100件）
  selectedChannelId: string | null;       // 送信先チャンネルID
  highlightedCount: number;               // ハイライト数（計算プロパティ）
}
```

### Actions
```typescript
interface ChatActions {
  setFilter: (filter: ChatFilter) => void;
  addMessage: (message: ChatMessage) => void;
  setSelectedChannelId: (channelId: string | null) => void;
}
```

### 重要な仕様
- **メッセージ順序**: 新規メッセージを先頭に追加（逆時系列）
- **最大保持数**: 100件、超過分は末尾から削除
- **永続化**: なし（セッション間で保持しない）

## 5.3 authStore (src/stores/authStore.ts)

Google（YouTube）とTwitchの認証状態を管理。

### State
```typescript
interface AuthState {
  // Google (YouTube) 認証
  authenticated: boolean;
  loading: boolean;
  error?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  // Twitch 認証
  twitchAuthenticated: boolean;
  twitchLoading: boolean;
  twitchError?: string;
  twitchUser?: {
    id: string;
    login: string;
    displayName: string;
    profileImageUrl?: string;
  };

  // セッションID（WebSocket用トークン管理）
  sessionId?: string;
}
```

### Actions
```typescript
interface AuthActions {
  // Google
  setStatus: (data: { authenticated: boolean; user?: AuthUser; error?: string }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;

  // Twitch
  setTwitchStatus: (data: { authenticated: boolean; user?: TwitchUser; error?: string }) => void;
  setTwitchLoading: (loading: boolean) => void;
  setTwitchError: (error?: string) => void;

  // セッションID
  setSessionId: (sessionId: string) => void;
}
```

### 重要な仕様
- **永続化**: なし
- **初期化**: useAuthStatus, useTwitchAuthStatusフックで自動取得

## 5.4 userStore (src/stores/userStore.ts)

ユーザーIDごとのフォローチャンネル情報を管理。

### State
```typescript
interface UserState {
  // ユーザーIDごとにフォロー情報を保存
  followedChannelsByUser: {
    [userId: string]: FollowedChannel[];
  };
  currentYoutubeUserId: string | null;
  currentTwitchUserId: string | null;

  // 現在のユーザーのフォローチャンネルを集約（計算プロパティ）
  followedChannels: FollowedChannel[];
}
```

### FollowedChannel
```typescript
interface FollowedChannel {
  platform: Platform;
  channelId: string;
  label?: string;
}
```

### Actions
```typescript
interface UserActions {
  setCurrentYoutubeUser: (userId: string | null) => void;
  setCurrentTwitchUser: (userId: string | null) => void;
  addFollowedChannel: (channel: FollowedChannel) => void;
  addFollowedChannels: (channels: FollowedChannel[]) => void;
  removeFollowedChannel: (channelId: string, platform?: Platform) => void;
  clearFollowedChannels: () => void;
}
```

### 永続化
- **ストレージ**: localStorage
- **キー**: `fukumado-user`
- **バージョン**: 2

### 重要な仕様
- **マルチユーザー対応**: ユーザーID別にフォローリストを保存
- **複合キー**: `youtube:userId` または `twitch:userId`
- **followedChannels**: 現在ログイン中の全ユーザーのフォローを集約

## 5.5 syncStore (src/stores/syncStore.ts)

配信リストの自動同期設定を管理。

### State
```typescript
interface SyncState {
  settings: SyncSettings;
  syncing: boolean;                       // 同期中フラグ
  lastSyncTime?: number;                  // 最終同期時刻
  manualSyncTrigger: number;              // 手動同期トリガー（タイムスタンプ）
}
```

### Actions
```typescript
interface SyncActions {
  updateSettings: (partial: Partial<SyncSettings>) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
  triggerManualSync: () => void;
}
```

### 永続化
- **ストレージ**: localStorage
- **キー**: `fukumado-sync`
- **バージョン**: 1
- **永続化対象**: settings のみ

### デフォルト設定
- **enabled**: true
- **interval**: 60000 (1分)

## 5.6 notificationStore (src/stores/notificationStore.ts)

配信開始通知を管理。

### State
```typescript
interface NotificationState {
  notifications: Notification[];          // 通知リスト（最大50件）
  settings: NotificationSettings;         // 通知設定
  toasts: ToastData[];                    // トースト表示（最大3件）
}
```

### ToastData
```typescript
interface ToastData {
  id: string;
  message: string;
  thumbnailUrl?: string;
}
```

### Actions
```typescript
interface NotificationActions {
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  getUnreadCount: () => number;
  removeToast: (id: string) => void;
}
```

### 永続化
- **ストレージ**: localStorage
- **キー**: `fukumado-notifications`
- **バージョン**: 1
- **永続化対象**: settings のみ（通知リストは保持しない）

### デフォルト設定
- **enabled**: true
- **youtube**: true
- **twitch**: true
- **sound**: false

### 重要な仕様
- **重複防止**: 同じstreamIdの通知は追加しない
- **通知音**: Base64エンコードされたWAV音声を再生
- **トースト**: stream_started通知時に自動表示

## 5.7 maintenanceStore (src/stores/maintenanceStore.ts)

メンテナンスモードの状態を管理。

### State
```typescript
interface MaintenanceState {
  enabled: boolean;                      // メンテナンスモード有効
  message: string;                       // メンテナンスメッセージ
  enabledAt?: string;                    // 有効化日時
  duration?: number;                     // 期間（分単位）、0=無期限
  scheduledEndAt?: string;               // 終了予定日時
}
```

### Actions
```typescript
interface MaintenanceActions {
  setMaintenance: (data: {
    enabled: boolean;
    message?: string;
    enabledAt?: string;
    duration?: number;
    scheduledEndAt?: string;
  }) => void;
  clearMaintenance: () => void;
}
```

### 永続化
- **ストレージ**: なし

### 重要な仕様
- **動的更新**: バックエンドAPIから状態を取得して更新
- **メンテナンスページ**: `enabled: true` の場合、MaintenancePageを表示
- **管理者制御**: 管理ダッシュボードから有効/無効を切り替え可能

## 5.8 mobileMenuStore (src/stores/mobileMenuStore.ts)

モバイル環境でのサイドバー・チャットパネルの開閉状態を管理。

### State
```typescript
interface MobileMenuState {
  sidebarOpen: boolean;                  // サイドバー開閉状態
  chatOpen: boolean;                     // チャットパネル開閉状態
}
```

### Actions
```typescript
interface MobileMenuActions {
  setSidebarOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  toggleSidebar: () => void;             // サイドバートグル（チャットは閉じる）
  toggleChat: () => void;                // チャットトグル（サイドバーは閉じる）
  closeAll: () => void;                  // 両方閉じる
}
```

### 永続化
- **ストレージ**: なし

### 重要な仕様
- **排他制御**: サイドバーとチャットは同時に開かない
- **モバイル専用**: レスポンシブデザインでモバイル環境のみ使用
- **useMediaQuery**: `useIsMobile()` フックと連携

## 5.9 dataUsageStore (src/stores/dataUsageStore.ts)

データ転送量を監視・管理。

### State
```typescript
interface DataUsageState {
  totalBytes: number;                     // 累計バイト数
  sessionStartTime: number;               // セッション開始時刻（ミリ秒）
}
```

### Actions
```typescript
interface DataUsageActions {
  addUsage: (bytes: number) => void;
  reset: () => void;
  getTotalMB: () => number;
  getTotalGB: () => number;
  getSessionDuration: () => number;       // 秒単位
}
```

### 永続化
- **ストレージ**: sessionStorage
- **キー**: `fukumado-data-usage`

### 重要な仕様
- **測定方法**: Resource Timing API (`performance.getEntriesByType('resource')`)
- **制限**: iframeクロスオリジン制限により、配信ストリーミングデータは測定不可
- **測定対象**: JS/CSS/画像、APIリクエストなど
- **更新間隔**: 5秒ごとに新規リソースをチェック

### 重要な仕様
- **sessionId**: WebSocket経由でバックエンドのTokenStorageからトークンを取得するためのキー
- **useStreamUpdates**: sessionIdを使用してWebSocket経由で配信リスト更新を受信

## 5.10 ストア間の依存関係

```
┌──────────────────────────────────────┐
│          layoutStore                 │
│  - レイアウト管理                     │
│  - スロット管理                       │
│  - 配信リスト                         │
│  - 検索機能                           │
└──────────────────────────────────────┘
              ↑
              │ 参照
              │
┌──────────────────────────────────────┐
│          chatStore                   │
│  - メッセージ管理                     │
│  - フィルタ                           │
│  - 送信先選択                         │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│          authStore                   │
│  - Google認証                         │
│  - Twitch認証                         │
└──────────────────────────────────────┘
              ↑
              │ 参照
              │
┌──────────────────────────────────────┐
│          userStore                   │
│  - フォローチャンネル                 │
│  - ユーザーID管理                     │
└──────────────────────────────────────┘
              ↑
              │ 参照
              │
┌──────────────────────────────────────┐
│          syncStore                   │
│  - 自動同期設定                       │
│  - 手動同期トリガー                   │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│       notificationStore              │
│  - 配信開始通知                       │
│  - トースト表示                       │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│       dataUsageStore                 │
│  - データ使用量監視                   │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│       maintenanceStore               │
│  - メンテナンスモード管理             │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│       mobileMenuStore                │
│  - モバイルメニュー開閉状態           │
└──────────────────────────────────────┘
```

## 5.11 ストア使用のベストプラクティス

### useStoreWithEqualityFn の使用

不必要な再レンダリングを防ぐため、shallow比較を使用します。

```typescript
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';

const MyComponent = () => {
  const { slots, preset } = useStoreWithEqualityFn(
    useLayoutStore,
    (state) => ({
      slots: state.slots,
      preset: state.preset,
    }),
    shallow
  );

  // ...
};
```

### アクションの直接取得

アクションは変更されないため、shallow比較で取得します。

```typescript
const { setVolume, toggleMute } = useStoreWithEqualityFn(
  useLayoutStore,
  (state) => ({
    setVolume: state.setVolume,
    toggleMute: state.toggleSlotMute,
  }),
  shallow
);
```

### 計算プロパティの使用

ストア内で計算せず、コンポーネント内で計算します。

```typescript
// ❌ 避けるべきパターン
const isActive = useLayoutStore((state) =>
  state.showSelection && state.selectedSlotId === slot.id
);

// ✅ 推奨パターン
const { showSelection, selectedSlotId } = useStoreWithEqualityFn(
  useLayoutStore,
  (state) => ({
    showSelection: state.showSelection,
    selectedSlotId: state.selectedSlotId,
  }),
  shallow
);
const isActive = showSelection && selectedSlotId === slot.id;
```

### 永続化の制御

永続化が不要な一時的な状態は、`omit`で除外します。

```typescript
persist(
  (set, get) => ({
    // ... state and actions
  }),
  {
    name: 'fukumado-layout',
    version: 3,
    partialize: (state) => ({
      preset: state.preset,
      slots: state.slots.map(slot => ({
        ...slot,
        assignedStream: undefined, // 配信情報を除外
      })),
      // ... other persisted fields
    }),
  }
)
```
