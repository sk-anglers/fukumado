# Twitch EventSub Conduits 動作確認チェックリスト

Conduitsモードへの切り替え後、以下のチェックリストで動作確認を行ってください。

---

## 📋 デプロイ前チェックリスト

### 環境確認

- [ ] Node.js バージョン確認（推奨: v18以上）
  ```bash
  node --version
  ```

- [ ] npm パッケージが最新
  ```bash
  cd server && npm install
  ```

- [ ] ビルドが成功する
  ```bash
  npm run build
  ```

### 認証情報確認

- [ ] `.env` ファイルが存在する
  ```bash
  ls -la server/.env
  ```

- [ ] Twitch認証情報が設定されている
  ```bash
  grep "TWITCH_CLIENT_ID" server/.env
  grep "TWITCH_CLIENT_SECRET" server/.env
  ```

- [ ] App Access Token が取得できる（テスト）
  ```bash
  curl -X POST 'https://id.twitch.tv/oauth2/token' \
    -d "client_id=${TWITCH_CLIENT_ID}" \
    -d "client_secret=${TWITCH_CLIENT_SECRET}" \
    -d 'grant_type=client_credentials'
  ```
  → `access_token` が返ってくることを確認

### 現在の状態確認

- [ ] 現在のモードを確認（WebSocket）
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.mode'
  ```
  → `"websocket"` と表示されることを確認

- [ ] 現在の購読数を確認
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.totalSubscriptions'
  ```
  → 購読数を記録（デプロイ後と比較）

- [ ] バックアップ作成
  ```bash
  cp server/.env server/.env.backup.$(date +%Y%m%d_%H%M%S)
  ```

---

## 🚀 デプロイチェックリスト

### Step 1: 設定変更

- [ ] `.env` ファイルを編集
  ```bash
  nano server/.env
  ```

- [ ] `EVENTSUB_MODE` を `conduit` に変更
  ```bash
  EVENTSUB_MODE=conduit
  ```

- [ ] 設定変更を確認
  ```bash
  grep "EVENTSUB_MODE" server/.env
  ```
  → `EVENTSUB_MODE=conduit` と表示されることを確認

### Step 2: サーバー再起動

- [ ] サーバーを停止
  ```bash
  # 開発環境: Ctrl+C
  # PM2: pm2 stop server
  # systemd: sudo systemctl stop fukumado-server
  ```

- [ ] サーバーを起動
  ```bash
  # 開発環境: npm run dev
  # PM2: pm2 start server
  # systemd: sudo systemctl start fukumado-server
  ```

- [ ] サーバープロセスが起動していることを確認
  ```bash
  # 開発環境: ps aux | grep "npm run dev"
  # PM2: pm2 list
  # systemd: sudo systemctl status fukumado-server
  ```

---

## ✅ デプロイ後チェックリスト

### 起動ログ確認

- [ ] Conduit Manager の初期化ログがある
  ```
  [Conduit Manager] Initializing...
  [Conduit Manager] Initializing Conduit...
  ```

- [ ] Conduit ID が取得されている
  ```
  [Conduit Manager] Using existing Conduit: [ID]
  または
  [Conduit Manager] Conduit created: [ID]
  ```

- [ ] シャードが登録されている
  ```
  [Conduit Manager] Shard #0 registered successfully
  ```

- [ ] WebSocket接続が確立されている
  ```
  [Conduit Manager] Shard #0 WebSocket connected
  [Conduit Manager] Shard #0 session ID: [ID]
  ```

- [ ] エラーログがない
  ```bash
  tail -n 100 logs/server.log | grep ERROR
  ```
  → エラーが0件であることを確認

### API確認

#### 統計API

- [ ] モードが Conduits になっている
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.mode'
  ```
  → `"conduit"` と表示されることを確認

- [ ] Conduit ID が表示されている
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.conduitStats.conduitId'
  ```
  → 英数字のIDが表示されることを確認（`null` でないこと）

- [ ] 総シャード数が1以上
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.conduitStats.totalShards'
  ```
  → 1以上の数値が表示されることを確認

- [ ] 有効シャード数 = 総シャード数
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.conduitStats | {total: .totalShards, enabled: .enabledShards}'
  ```
  → `total` と `enabled` が同じ値であることを確認

- [ ] 無効シャード数 = 0
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.conduitStats.disabledShards'
  ```
  → `0` と表示されることを確認

- [ ] サブスクリプション数が維持されている
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.totalSubscriptions'
  ```
  → デプロイ前と同じ数値（または近い値）であることを確認

#### サブスクリプションAPI

- [ ] 購読チャンネル一覧が取得できる
  ```bash
  curl http://localhost:4000/api/admin/eventsub/subscriptions | jq '.data.totalChannels'
  ```
  → チャンネル数が表示されることを確認

- [ ] EventSub監視チャンネルが表示される
  ```bash
  curl http://localhost:4000/api/admin/eventsub/subscriptions | jq '.data.allChannels.realtime | length'
  ```
  → 監視中のチャンネル数が表示されることを確認

#### メトリクスAPI

- [ ] Conduits関連メトリクスが取得できる
  ```bash
  curl http://localhost:4000/api/admin/eventsub/metrics | jq '.data'
  ```
  → `twitch` と `system` のメトリクスが表示されることを確認

- [ ] エラーメトリクスが0
  ```bash
  curl http://localhost:4000/metrics | grep "conduit.*total"
  ```
  → すべてのConduits関連エラーが `0` であることを確認

### 管理画面確認

ブラウザで `http://localhost:3000/eventsub` を開く：

#### ヘッダー表示

- [ ] タイトル「EventSub管理」が表示される
- [ ] 「🔄 更新」ボタンがある
- [ ] 「🔌 再接続」ボタンがある

#### 統計カード

- [ ] **モード**カードに「🚀 Conduits」と表示
- [ ] **モード**カードのサブテキストに「最大100,000サブスクリプション」と表示
- [ ] **総購読数**が表示される
- [ ] **使用率**が表示される（パーセント）
- [ ] **残り容量**が表示される

#### 接続状況セクション

- [ ] 「接続状況」セクションが表示される
- [ ] **Conduit Information** カードが表示される
- [ ] **Conduit ID** が表示される（英数字）
- [ ] **総シャード数** が1以上
- [ ] **有効シャード** = 総シャード数
- [ ] **無効シャード** = 0
- [ ] **サブスクリプション** が表示される
- [ ] **使用率** が表示される（小数点3桁）
- [ ] 説明文「Conduitsモードでは、Twitchが自動的に...」が表示される

#### 監視チャンネルセクション

- [ ] 「監視チャンネル」セクションが表示される
- [ ] **優先度統計**が表示される
  - 総ユーザー数
  - 総チャンネル数
  - EventSub監視
  - ポーリング監視

- [ ] **EventSub監視中**のチャンネルリストが表示される
  - チャンネル名またはID
  - ユーザー数バッジ
  - メソッド: `eventsub`
  - 購読解除ボタン

#### イベント履歴セクション

- [ ] 「イベント履歴」セクションが表示される
- [ ] イベントカードが表示される（配信開始/終了）
  - イベントタイプ（🟢 配信開始 / 🔴 配信終了）
  - タイムスタンプ
  - 配信者名

---

## 🧪 機能テスト

### keepalive受信テスト

- [ ] ログで10秒ごとに keepalive が受信されている
  ```bash
  tail -f logs/server.log | grep "keepalive"
  ```
  → 10秒間隔で以下が表示されることを確認：
  ```
  [Conduit Manager] Shard #0 received: session_keepalive
  [Conduit Manager] Shard #0 keepalive
  ```

### イベント受信テスト

- [ ] 既存の監視チャンネルで配信が開始されたときにイベントが記録される
  ```bash
  # 配信開始前のイベント数
  curl http://localhost:4000/api/admin/eventsub/events?limit=1 | jq '.data.totalEvents'

  # (監視中のチャンネルで配信を開始)

  # 配信開始後のイベント数（増加していることを確認）
  curl http://localhost:4000/api/admin/eventsub/events?limit=1 | jq '.data.totalEvents'
  ```

- [ ] イベント履歴APIで最新イベントが取得できる
  ```bash
  curl http://localhost:4000/api/admin/eventsub/events?limit=5 | jq '.data.events[0]'
  ```
  → 最新のイベントが表示されることを確認

### 購読解除テスト

- [ ] テストチャンネルを購読
  ```bash
  curl -X POST http://localhost:4000/api/admin/eventsub/subscribe \
    -H "Content-Type: application/json" \
    -d '{"userId":"141981764"}'  # TwitchDev公式
  ```
  → `"subscribed": true` が返ってくることを確認

- [ ] 購読チャンネル数が増加
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.totalSubscriptions'
  ```
  → +2（online + offline）増加していることを確認

- [ ] テストチャンネルを購読解除
  ```bash
  curl -X DELETE http://localhost:4000/api/admin/eventsub/subscriptions/141981764
  ```
  → `"unsubscribed": true` が返ってくることを確認

- [ ] 購読チャンネル数が減少
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.totalSubscriptions'
  ```
  → -2減少していることを確認

---

## 📊 監視（デプロイ後24時間）

### メトリクス監視

デプロイ後24時間は、以下のメトリクスを定期的に確認してください。

#### 1時間後

- [ ] シャード失敗数が0
  ```bash
  curl http://localhost:4000/metrics | grep "conduit_shard_failures_total"
  ```
  → `0` であることを確認

- [ ] WebSocketエラー数が0
  ```bash
  curl http://localhost:4000/metrics | grep "conduit_websocket_errors_total"
  ```
  → `0` であることを確認

- [ ] 再接続失敗数が0
  ```bash
  curl http://localhost:4000/metrics | grep "conduit_reconnection_failures_total"
  ```
  → `0` であることを確認

- [ ] APIエラー数が0
  ```bash
  curl http://localhost:4000/metrics | grep "conduit_api_errors_total"
  ```
  → `0` であることを確認

#### 6時間後

- [ ] 有効シャード数が維持されている
  ```bash
  curl http://localhost:4000/api/admin/eventsub/stats | jq '.data.stats.conduitStats.enabledShards'
  ```
  → 初期値（通常1）と同じであることを確認

- [ ] イベントが正常に記録されている
  ```bash
  curl http://localhost:4000/api/admin/eventsub/events?limit=10 | jq '.data.events | length'
  ```
  → 新しいイベントが記録されていることを確認

#### 24時間後

- [ ] 全エラーメトリクスが0または低い値
- [ ] サブスクリプション数が安定している
- [ ] イベント受信が正常に動作している
- [ ] サーバーメモリ使用量が正常範囲内
  ```bash
  curl http://localhost:4000/metrics | grep "process_memory_bytes"
  ```

---

## ❌ ロールバック判断基準

以下のいずれかに該当する場合は、WebSocketモードへロールバックを検討：

- [ ] シャードが無効（disabled）状態が1時間以上続く
- [ ] 再接続失敗数が10回以上
- [ ] イベント受信が24時間以上停止している
- [ ] Conduit APIエラーが継続的に発生
- [ ] メモリリークやパフォーマンス問題が発生

**ロールバック手順:** `CONDUITS_DEPLOYMENT.md` の「ロールバック手順」を参照

---

## ✅ デプロイ完了条件

以下のすべてに✅がついたら、デプロイ完了とします：

- [ ] 管理画面で「🚀 Conduits」と表示
- [ ] Conduit ID が表示されている
- [ ] 有効シャード数 = 総シャード数
- [ ] 無効シャード数 = 0
- [ ] サブスクリプション数がデプロイ前と同じ
- [ ] keepalive が10秒ごとに受信されている
- [ ] イベント受信が正常に動作
- [ ] 全エラーメトリクスが0
- [ ] 管理画面が正常に表示される
- [ ] 購読/購読解除が正常に動作

---

## 📝 チェックリスト記録

**実施者:** __________________
**実施日時:** __________________
**環境:** [ ] 開発 [ ] ステージング [ ] 本番
**結果:** [ ] 成功 [ ] 失敗（ロールバック実施）

**備考:**

___________________________________________
___________________________________________
___________________________________________

---

**最終更新**: 2025-11-01
**バージョン**: 1.0.0
