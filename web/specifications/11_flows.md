# 11. 機能詳細フロー

このセクションでは、ふくまど！の主要な機能フローを詳細に説明します。

## 11.1 アプリケーション起動フロー

```
1. ページロード
   ├─ AppShell マウント
   │  ├─ useDataUsageMonitor 開始
   │  └─ ユーザーインタラクション検出
   │
   ├─ Header マウント
   │  ├─ useAuthStatus (Google認証状態取得)
   │  └─ useTwitchAuthStatus (Twitch認証状態取得)
   │
   ├─ Sidebar マウント
   │  ├─ userStore.followedChannels 取得
   │  ├─ useYoutubeStreams(channelIds) 開始
   │  │  ├─ 初回API呼び出し
   │  │  └─ 定期同期開始（syncSettings.interval）
   │  └─ useTwitchStreams(channelIds) 開始
   │     ├─ 初回API呼び出し
   │     └─ 定期同期開始
   │
   ├─ StreamGrid マウント
   │  └─ layoutStore.slots から配信スロット表示
   │
   └─ ChatPanel マウント
      ├─ useTwitchChat(channels) 開始
      │  └─ WebSocket接続・購読
      └─ チャットメッセージリスト表示
```

## 11.2 配信視聴フロー

```
1. ユーザーがSidebarで配信カードの「割り当てる」をクリック
   ├─ layoutStore.setPendingStream(stream)
   └─ SlotSelectionModal 表示

2. ユーザーがスロットを選択
   ├─ layoutStore.assignStream(slotId, stream)
   ├─ StreamSlot コンポーネント再レンダリング
   │  ├─ プラットフォーム判定
   │  │  ├─ YouTube → useYouTubeIframeApi
   │  │  ├─ Twitch → useTwitchEmbed
   │  │  └─ ニコニコ → iframe直接埋め込み
   │  └─ プレイヤー表示
   │
   └─ useTwitchChat のチャンネルリスト更新
      └─ WebSocket購読メッセージ再送信
```

## 11.3 音量制御フロー

### 個別スロット音量変更
```
1. Header > 音量ドロップダウン > スライダー操作
   └─ layoutStore.setVolume(slotId, volume)
      └─ StreamSlot 再レンダリング
         ├─ useYouTubeIframeApi がプレイヤー音量を同期
         └─ useTwitchEmbed がプレイヤー音量を同期
```

### マスター音量変更
```
1. Header > グローバルコントロール > マスター音量スライダー
   └─ layoutStore.setMasterVolume(volume)
      └─ 全スロットの音量を一括変更（未実装の場合あり）
```

### 全ミュート
```
1. Header > グローバルコントロール > 「全ミュート」ボタン
   └─ layoutStore.toggleMuteAll()
      ├─ layoutStore.mutedAll トグル
      └─ 全スロットの muted を更新
         └─ StreamSlot 再レンダリング → プレイヤーミュート同期
```

## 11.4 音声同期フロー

```
1. StreamSlot で「→ 同期」ボタンをクリック
   └─ layoutStore.setMasterSlot(slotId)
      └─ masterSlotId に設定

2. 他のスロットが「プレビュー」状態になる
   ├─ assignedStream は保持
   └─ プレビューオーバーレイ表示

3. マスタースロットの音声に合わせて視聴
   （現状、同期機能の具体的な実装は確認できず）
```

## 11.5 チャット送信フロー

```
1. ChatPanel で送信先選択
   └─ chatStore.setSelectedChannelId(channelId)

2. メッセージ入力・Enter or 送信ボタン
   └─ handleSendMessage()
      ├─ 送信先配信を slots から取得
      ├─ API呼び出し: POST /api/{platform}/chat/send
      │  └─ { channelId, channelLogin?, message }
      ├─ 成功: 入力欄クリア
      └─ 失敗: alert表示
```

## 11.6 配信開始通知フロー

```
1. useYoutubeStreams / useTwitchStreams の定期同期
   ├─ 配信リスト取得
   ├─ 前回のstreamIdセットと比較
   └─ 新規配信を検出
      └─ notificationStore.addNotification({
           type: 'stream_started',
           platform, channelId, channelName, streamId, streamTitle, thumbnailUrl
         })
         ├─ 通知リストに追加
         ├─ 通知音再生（settings.sound === true）
         └─ Toast表示（最大3件）
            └─ 5秒後に自動消去
```

## 11.7 データ使用量監視フロー

```
1. useDataUsageMonitor が5秒ごとに実行
   ├─ performance.getEntriesByType('resource') 取得
   ├─ 未処理リソースをフィルタ
   ├─ transferSize > 0 のリソースを集計
   │  └─ dataUsageStore.addUsage(bytes)
   │     ├─ totalBytes += bytes
   │     └─ sessionStorage 保存
   └─ 処理済みリソースをSet管理（最大500件）

2. AccountMenu で表示
   ├─ dataUsageStore.totalBytes を購読
   ├─ getTotalMB() / getTotalGB() で単位変換
   ├─ セッション時間を計算（Date.now() - sessionStartTime）
   └─ 1秒ごとに再レンダリング
```

## 11.8 レイアウト変更フロー

```
1. Header > レイアウトボタン > プリセット選択
   └─ layoutStore.setPreset(preset)
      └─ StreamGrid 再レンダリング
         ├─ CSSクラス変更（twoByTwo / oneByTwo / focus）
         └─ グリッドレイアウト適用
```

## 11.9 全画面モードフロー

```
1. StreamSlot > 「全画面」ボタンをクリック
   └─ layoutStore.setFullscreen(true)
      ├─ document.documentElement.requestFullscreen()
      └─ AppShell 再レンダリング
         ├─ Header / Sidebar / Footer 非表示
         └─ StreamGrid のみ表示
            ├─ 全画面コントロール表示
            └─ チャットUI表示

2. Escキーまたは「全画面終了」ボタン
   └─ document.exitFullscreen()
      └─ fullscreenchange イベント
         └─ layoutStore.setFullscreen(false)
            └─ 通常レイアウトに戻る
```

## 11.10 フォローチャンネル追加フロー

```
1. Header > 検索フィールド > チャンネル名入力
   └─ API呼び出し: /api/{platform}/channels?q=...
      └─ layoutStore.setChannelSearchResults(results)
         └─ StreamSelectionModal 表示

2. ユーザーがチャンネルを選択
   └─ userStore.addFollowedChannel({ platform, channelId, label })
      ├─ localStorage に保存
      └─ 次回の配信リスト同期時にそのチャンネルの配信を取得
```

## 11.11 エラーハンドリングフロー

### API エラー時
```
1. API呼び出し失敗
   ├─ 401 Unauthorized
   │  └─ 認証状態を確認 → ログイン画面へ
   ├─ 429 Rate Limit Exceeded
   │  └─ エラーメッセージ表示 → 自動リトライ（指数バックオフ）
   └─ その他のエラー
      └─ エラーメッセージ表示 → layoutStore.setStreamsError(message)
```

### WebSocket 切断時
```
1. WebSocket 切断検出
   └─ 自動再接続試行（最大5回）
      ├─ 成功: チャンネル再購読
      └─ 失敗: システムメッセージ表示
```

## 11.12 スロット削除フロー

```
1. StreamSlot > 削除ボタンをクリック
   └─ layoutStore.clearSlot(slotId)
      ├─ プレイヤークリーンアップ
      │  ├─ DOMコンテナをクリア
      │  ├─ 音声を完全停止
      │  ├─ pause() 実行
      │  └─ destroy() 実行
      │
      ├─ assignedStream を undefined に設定
      └─ StreamSlot 再レンダリング
         └─ プレースホルダー表示
```

## 11.13 状態永続化フロー

### アプリケーション起動時
```
1. Zustand ストア初期化
   └─ persistミドルウェアがlocalStorageから読み取り
      ├─ layoutStore: preset, slots, selectedSlotId, ...
      ├─ userStore: followedChannelsByUser
      ├─ syncStore: settings
      └─ notificationStore: settings
```

### 状態変更時
```
1. ストアのアクション実行（例: setPreset）
   └─ Zustand がストア更新
      └─ persistミドルウェアがlocalStorageに保存
         └─ 非同期で書き込み（パフォーマンス影響最小化）
```

## 11.14 バックグラウンド同期フロー

### StreamSyncService（バックエンド）
```
1. サーバー起動時
   └─ StreamSyncService 初期化
      └─ 60秒間隔のタイマー開始

2. 定期実行（60秒ごと）
   ├─ 全ユーザーのフォローチャンネルを集約
   ├─ Twitch API呼び出し（100チャンネルずつバッチ処理）
   ├─ 前回の配信リストと比較（差分検出）
   ├─ Redisにキャッシュ保存（70秒TTL）
   └─ WebSocketで全クライアントに通知
      └─ { type: 'stream_list_updated', platform, streams, changes }

3. フロントエンド受信
   └─ WebSocket メッセージハンドラー
      └─ layoutStore.setAvailableStreamsForPlatform(platform, streams)
         └─ Sidebar 再レンダリング
```

この構造により、フロントエンドは能動的にAPIを呼び出す必要がなく、バックエンドからのプッシュ通知で最新の配信リストを受け取ります。
