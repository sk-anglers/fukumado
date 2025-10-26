# 6. コンポーネント仕様

このセクションでは、ふくまど！の各Reactコンポーネントの詳細な仕様を説明します。

## 6.1 AppShell (src/components/AppShell/AppShell.tsx)

アプリケーション全体のレイアウトシェル。

### Props
なし

### 機能
- 全画面モード時のヘッダー/サイドバー/フッター非表示
- ユーザーインタラクション検出（click, keydown, touchstart）
- データ使用量監視の開始
- fullscreenchange イベントのリスン

### レイアウト構造
```
通常モード:
┌──────────────────────────────────┐
│          Header                  │
├──────┬────────────────┬──────────┤
│      │                │          │
│ Side │  StreamGrid    │  Chat    │
│ bar  │                │  Panel   │
│      │                │          │
├──────┴────────────────┴──────────┤
│          Footer                  │
└──────────────────────────────────┘

全画面モード:
┌──────────────────────────────────┐
│                                  │
│         StreamGrid               │
│       (+ 全画面コントロール)      │
│                                  │
└──────────────────────────────────┘
```

## 6.2 Header (src/components/Header/Header.tsx)

ヘッダーバー。検索、グローバルコントロール、認証、設定を提供。

### Props
```typescript
interface HeaderProps {
  onOpenPresetModal: () => void;
}
```

### 主要機能

#### 6.2.1 検索フィールド
- **目的**: 新規チャンネルの追加
- **API**: `/api/youtube/search?q=...`, `/api/twitch/search?query=...`
- **動作**:
  - 検索クエリ入力
  - バックエンドにリクエスト
  - 検索結果をlayoutStore.channelSearchResultsに格納
  - StreamSelectionModalで結果表示
  - フォローボタンでuserStoreに追加

#### 6.2.2 グローバルコントロール
- **レイアウト変更**: twoByTwo / oneByTwo / focus
- **全ミュート**: 全スロットをミュート/ミュート解除
- **マスター音量**: 全スロットの音量を一括制御
- **スロット数変更**: 1〜8スロット
- **同期設定**: 自動同期ON/OFF、同期間隔選択、手動同期ボタン

#### 6.2.3 音量ドロップダウン（各スロット用）
- **個別音量スライダー**: 0-100
- **ミュートボタン**: 個別ミュート
- **同期ボタン**: マスタースロットに設定
- **音量レベルメーター**:
  - スライダー位置を100%基準とした音量レベル表示
  - 0-60%: 緑色
  - 60-80%: 黄色
  - 80%+: 赤色
  - グラデーションで滑らかに色変化
  - 音量が100%を超えても許容（オーバーフロー表示）

#### 6.2.4 AccountMenu
- **Google認証**: ログイン/ログアウト、ユーザー情報表示
- **Twitch認証**: ログイン/ログアウト、ユーザー情報表示
- **データ使用量表示**:
  - セッション使用量（MB/GB）
  - セッション時間
  - リセットボタン
  - 注意書き: 「ブラウザが読み込んだリソースのサイズを測定しています。配信ストリーミングの一部は含まれません。」

#### 6.2.5 NotificationMenu
- **配信開始通知リスト**: 未読/既読表示
- **通知設定**: YouTube/Twitch個別ON/OFF、通知音ON/OFF
- **アクション**: 全既読、全削除

## 6.3 Sidebar (src/components/Sidebar/Sidebar.tsx)

フォロー中の配信リスト表示。

### Props
```typescript
interface SidebarProps {
  onOpenPresetModal: () => void;
}
```

### 機能
- **配信リスト表示**: layoutStore.availableStreamsから取得
- **プラットフォームフィルタ**: config.tsの設定に応じてYouTube/ニコニコを除外
- **配信カード**:
  - サムネイル
  - プラットフォームバッジ（クリックで元サイトを開く）
  - 配信者名
  - 配信タイトル
  - メタ情報（ゲームタイトル、配信開始時刻、視聴者数）
  - 「割り当てる」ボタン → SlotSelectionModal表示

### モバイル対応
- **閉じるボタン**: セクションヘッダー右上に配置、モバイルのみ表示
- **タッチ対応**: タップ操作に最適化

### ローディング/エラー状態
- **読込中**: 「配信情報を取得しています…」
- **配信0件**: 「現在表示できる配信が見つかりません。」
- **エラー**: 「配信情報の取得に失敗しました：{error}」

## 6.4 StreamGrid (src/components/StreamGrid/StreamGrid.tsx)

配信スロットのグリッド表示。

### Props
なし

### レイアウトCSS
- **twoByTwo**: `display: grid; grid-template-columns: repeat(2, 1fr);`
  - スロット数に応じて1x1, 1x2, 2x2, 3x2, 4x2の表示
- **oneByTwo**: 左1大、右2小の3カラムレイアウト
- **focus**: 選択スロットを大きく表示

### パフォーマンス最適化
- **useStoreWithEqualityFn**: shallow比較でストア購読
  ```typescript
  const { slots, preset, ... } = useStoreWithEqualityFn(useLayoutStore, (state) => ({
    slots: state.slots,
    preset: state.preset,
    // ...
  }), shallow);
  ```
- **activeSlotsのメモ化**: `useMemo`で配列再生成を防止
  ```typescript
  const activeSlots = useMemo(() => slots.slice(0, activeSlotsCount), [slots, activeSlotsCount]);
  ```
- **インライン関数の排除**: StreamSlotCardにonSelect関数を渡さず、propsとしてselectedSlotIdとpresetを渡す

### 機能
- **スロット選択オーバーレイ**:
  - マウス移動で再表示
  - タッチ開始で再表示（モバイル対応）
  - 3秒後に自動非表示
  - モーダル開閉中は非表示動作停止
- **全画面モード**:
  - コメント表示/非表示ボタン
  - チャット送信UI（送信先選択、入力欄、送信ボタン）
  - チャットメッセージリスト表示（最新50件）
  - エモート・バッジ・Bits表示対応
  - 全画面終了ボタン

### チャット機能（全画面時）
- **送信先選択**: 視聴中配信のドロップダウン
- **メッセージ入力**: Enterキーで送信
- **API**: `/api/{platform}/chat/send` (POST)
- **ペイロード**: `{ channelId, channelLogin?, message }`

## 6.5 StreamSlot (src/components/StreamGrid/StreamSlot/StreamSlot.tsx)

個別配信スロット。

### Props
```typescript
interface StreamSlotCardProps {
  slot: StreamSlot;
  selectedSlotId: string | null;          // 選択中のスロットID
  preset: string;                         // レイアウトプリセット
  showSelection: boolean;                 // 選択オーバーレイ表示フラグ
}
```

### パフォーマンス最適化
- **React.memo**: コンポーネント全体をメモ化
  ```typescript
  export const StreamSlotCard = memo(({ slot, selectedSlotId, preset, showSelection }: StreamSlotCardProps) => {
    // ...
  });
  ```
- **useStoreWithEqualityFn**: shallow比較でストア購読
  ```typescript
  const { setVolume, toggleSlotMute, ... } = useStoreWithEqualityFn(useLayoutStore, (state) => ({
    setVolume: state.setVolume,
    toggleSlotMute: state.toggleSlotMute,
    // ...
  }), shallow);
  ```
- **計算プロパティ**: isActiveとisFocusedをコンポーネント内で計算
  ```typescript
  const isActive = showSelection && selectedSlotId === slot.id;
  const isFocused = preset === 'focus' && selectedSlotId === slot.id;
  ```

### 状態
- **空スロット**: placeholder表示、クリックでSlotSelectionModal
- **配信割り当て済**: iframe埋め込み

### プレイヤークリーンアップ
- **Twitchプレイヤー破棄シーケンス**:
  1. DOMコンテナをクリア（`innerHTML = ''`）
  2. 音声を完全停止（`setMuted(true)`, `setVolume(0)`）
  3. pause()を実行
  4. destroy()を即座に実行（setTimeout削除）
  5. グローバル参照を削除
- **YouTubeプレイヤー破棄シーケンス**:
  1. DOMコンテナをクリア
  2. destroy()を実行
- **デバッグログ**: クリーンアップの各ステップをコンソールに出力

### モバイル対応
- **小さな×ボタン**: スロット右上に配置、タップで配信削除
- **オーバーレイ非表示**: モバイルでは上部/下部オーバーレイを非表示
- **タッチ対応**: タップでコントロール表示

### プラットフォーム別埋め込み

#### YouTube
```html
<iframe
  src="https://www.youtube.com/embed/{videoId}?enablejsapi=1"
  allow="autoplay; encrypted-media"
/>
```
- YouTube IFrame APIでプレイヤー制御
- 音量・ミュート・画質変更対応

#### Twitch
```html
<iframe
  src="https://player.twitch.tv/?channel={login}&parent={hostname}&autoplay=false&muted=false"
  allowfullscreen
/>
```
- Twitch Embed APIでプレイヤー制御
- 音量・ミュート制御対応

#### ニコニコ
```html
<iframe src="{embedUrl}" allowfullscreen />
```
- 外部プレイヤー制御不可

### オーバーレイ

#### 上部オーバーレイ
- **プラットフォームバッジ**: YouTube Live / Twitch / ニコニコ生放送
- **マスターバッジ**: 「MASTER」（masterSlotの場合）
- **同期ボタン**: 「→ 同期」（マスタースロット選択時のみ表示）
- **フォーカスボタン**: 「フォーカス」（フォーカスモード切り替え）
- **全画面ボタン**: 「全画面」

#### 下部オーバーレイ
- **配信情報**:
  - 配信タイトル
  - 視聴者数、ゲームタイトルなど
- **コントロールボタン**:
  - 音量スライダー
  - ミュートボタン
  - 画質選択（YouTube, Twitch）
  - スロット削除ボタン

### プレビュー状態
- **表示条件**: マスタースロットでない && 同期ボタンが押された
- **表示内容**:
  - 配信者イニシャル
  - 「PREVIEW」ステータス
  - 背景にアクセントカラーのグラデーション

## 6.6 ChatPanel (src/components/ChatPanel/ChatPanel.tsx)

チャットパネル。

### Props
なし

### 機能
- **フィルタタブ**: ALL / YouTube / Twitch / ニコニコ（有効プラットフォームのみ）
- **メッセージリスト**:
  - 最新100件を表示（chatStore）
  - フィルタに応じて表示制御
  - 逆時系列（新しいメッセージが下）
  - 自動スクロール（最下部追従）
- **メッセージ表示**:
  - アバター（ユーザー名の最初の2文字、カラー付き）
  - バッジ（Twitch: サブスク、モデレーター、VIPなど）
  - ユーザー名
  - チャンネル名
  - Bits表示（Twitch）
  - タイムスタンプ
  - メッセージ本文（エモート画像展開）
- **エモート表示**: Twitchエモートを画像として展開
- **チャット送信**:
  - 送信先選択（視聴中配信）
  - 入力欄（Enter送信）
  - 送信ボタン
  - EmotePickerでエモート挿入

### モバイル対応
- **閉じるボタン**: ヘッダー右上に配置、モバイルのみ表示
- **タッチ対応**: タップ操作に最適化

### API
- **送信**: `/api/{platform}/chat/send` (POST)
- **ペイロード**: `{ channelId, channelLogin?, message }`

## 6.7 Footer (src/components/Footer/Footer.tsx)

フッターバー。

### 機能
- コピーライト表示: 「© 2025 ふくまど！ All rights reserved.」
- 利用規約ボタン → LegalModal表示
- プライバシーポリシーボタン → LegalModal表示

## 6.8 LayoutPresetModal (src/components/LayoutPresetModal/LayoutPresetModal.tsx)

レイアウトプリセット選択モーダル。

### Props
```typescript
interface LayoutPresetModalProps {
  open: boolean;
  onClose: () => void;
}
```

### 機能
- レイアウトプレビュー表示
- 選択してレイアウト変更

## 6.9 SlotSelectionModal (src/components/SlotSelectionModal/SlotSelectionModal.tsx)

配信をスロットに割り当てるモーダル。

### Props
```typescript
interface SlotSelectionModalProps {
  stream: Streamer;
  onClose: () => void;
}
```

### 機能
- 空きスロット一覧表示
- スロット選択で配信を割り当て
- 満杯の場合は既存スロットとの置換

## 6.10 StreamSelectionModal (src/components/StreamSelectionModal/StreamSelectionModal.tsx)

チャンネル検索結果から選択するモーダル。

### 機能
- 検索結果リスト表示
- フォローボタンでuserStoreに追加

## 6.11 EmotePicker (src/components/EmotePicker/EmotePicker.tsx)

Twitchエモート選択UI。

### Props
```typescript
interface EmotePickerProps {
  onSelectEmote: (emoteName: string) => void;
}
```

### 機能
- グローバルエモート、サブスクエモートの一覧表示
- クリックでエモート名を入力欄に挿入
- タブ切り替え: グローバル / チャンネル
- エモート検索機能

### モバイル対応
- **動的サイズ調整**:
  - モバイル: 幅380px（最大）、高さ画面の60%（最大400px）
  - デスクトップ: 幅420px、高さ480px
- **位置調整**:
  - モバイル: 画面中央に配置、画面下部から60pxマージン
  - デスクトップ: ボタン位置基準、画面外にはみ出さないように調整
- **外側クリックで閉じる**: モーダル外をクリックでピッカーを閉じる

## 6.12 Toast (src/components/Toast/Toast.tsx)

通知トースト表示。

### Props
```typescript
interface ToastContainerProps {
  toasts: ToastData[];
  onClose: (id: string) => void;
}
```

### 機能
- 画面右下に3件まで表示
- 5秒後に自動消去
- 閉じるボタン

## 6.13 コンポーネント設計原則

### 単一責任の原則
各コンポーネントは1つの明確な責務を持ちます。

- **AppShell**: レイアウト構造の提供
- **Header**: グローバルコントロールと認証
- **StreamSlot**: 個別配信の表示と制御
- **ChatPanel**: チャット表示と送信

### Props vs ストア
- **Props**: 親から子への明示的なデータ渡し（配信情報、スロットIDなど）
- **ストア**: グローバルな状態共有（レイアウト設定、認証状態など）

### パフォーマンス最適化
- **React.memo**: 不必要な再レンダリング防止
- **useStoreWithEqualityFn + shallow**: ストア購読の最小化
- **useMemo**: 計算コストの高い処理のメモ化
- **useCallback**: コールバック関数の安定化

### モバイルファースト
- レスポンシブデザイン
- タッチ操作対応
- モバイル専用UI（閉じるボタン等）

### アクセシビリティ
- キーボードナビゲーション対応
- ARIA属性の適切な使用
- セマンティックHTML
- 適切なコントラスト比
