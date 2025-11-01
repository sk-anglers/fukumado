# Twitch EventSub Conduits デプロイ手順書

本ドキュメントは、WebSocketモードからConduitsモードへの切り替え手順を説明します。

## 目次

1. [デプロイ前の確認](#デプロイ前の確認)
2. [デプロイ手順](#デプロイ手順)
3. [ロールバック手順](#ロールバック手順)
4. [トラブルシューティング](#トラブルシューティング)

---

## デプロイ前の確認

### 1. 現在の監視チャンネル数を確認

管理画面（`http://localhost:3000/eventsub`）で確認：

- **総購読数**: 現在の購読チャンネル数
- **モード**: 現在のモード（WebSocket）

または API で確認：

```bash
curl http://localhost:4000/api/admin/eventsub/stats
```

### 2. 切り替え判断基準

| 監視チャンネル数 | 推奨モード | 理由 |
|----------------|----------|------|
| 〜100チャンネル | WebSocket | シンプル、十分な容量 |
| 100〜300チャンネル | WebSocket または Conduits | どちらでも可 |
| **300チャンネル〜** | **Conduits** | **WebSocketの容量上限（900サブスクリプション）に近づく** |

**判断:** 現在の購読数が **600以上（300チャンネル相当）** の場合は Conduitsモードへの切り替えを推奨

### 3. 必要な認証情報を確認

Conduitsモードでは **App Access Token** が必要です。

`.env` ファイルに以下が設定されているか確認：

```bash
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

### 4. バックアップ

念のため、現在の設定をバックアップ：

```bash
cd server
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
```

---

## デプロイ手順

### Step 1: サーバーの現在の状態を確認

```bash
# サーバープロセス確認
ps aux | grep node

# ログ確認（最新50行）
tail -n 50 logs/server.log

# 管理画面で現在の統計確認
curl http://localhost:4000/api/admin/eventsub/stats | jq .
```

### Step 2: .env ファイルを編集

```bash
cd server
nano .env  # またはお好みのエディタ
```

以下の行を変更：

```bash
# 変更前
EVENTSUB_MODE=websocket

# 変更後
EVENTSUB_MODE=conduit
```

保存して終了。

### Step 3: 設定変更を確認

```bash
cat .env | grep EVENTSUB_MODE
# 出力: EVENTSUB_MODE=conduit
```

### Step 4: サーバー再起動

#### 開発環境（npm run dev）の場合

```bash
# Ctrl+C で停止
# 再起動
npm run dev
```

#### 本番環境（PM2使用）の場合

```bash
pm2 restart server
# または
pm2 reload server  # ダウンタイムなし
```

#### 本番環境（systemd使用）の場合

```bash
sudo systemctl restart fukumado-server
```

### Step 5: 起動ログを確認

**正常起動時のログ例:**

```
[Conduit Manager] Initializing...
[Conduit Manager] Initializing Conduit...
[Conduit Manager] Using existing Conduit: 12345678-abcd-1234-5678-123456789abc
[Conduit Manager] Found 1 existing shard(s)
[Conduit Manager] Creating WebSocket shard #0 (attempt 1/3)...
[Conduit Manager] Shard #0 WebSocket connected
[Conduit Manager] Shard #0 session ID: AQoQexampleSessionId...
[Conduit Manager] Shard #0 registered successfully
```

**エラーがある場合:**

- シャード作成リトライが発生 → 自動リトライを待つ（最大3回）
- 認証エラー → `.env` の `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` を確認

### Step 6: 管理画面で確認

ブラウザで管理画面を開く：

```
http://localhost:3000/eventsub
```

**確認項目:**

- ✅ **モード**: 🚀 Conduits と表示
- ✅ **Conduit ID**: 英数字のIDが表示
- ✅ **総シャード数**: 1 以上
- ✅ **有効シャード数**: 総シャード数と同じ
- ✅ **無効シャード数**: 0
- ✅ **サブスクリプション**: 既存のサブスクリプション数と同じ

### Step 7: API で詳細確認

```bash
# 統計確認
curl http://localhost:4000/api/admin/eventsub/stats | jq .

# 購読チャンネル確認
curl http://localhost:4000/api/admin/eventsub/subscriptions | jq .

# メトリクス確認
curl http://localhost:4000/api/admin/eventsub/metrics | jq .
```

**期待する結果:**

```json
{
  "success": true,
  "data": {
    "stats": {
      "mode": "conduit",
      "totalSubscriptions": 220,
      "subscribedChannelCount": 110,
      "conduitStats": {
        "conduitId": "12345678-abcd-1234-5678-123456789abc",
        "totalShards": 1,
        "enabledShards": 1,
        "disabledShards": 0,
        "totalSubscriptions": 220,
        "usagePercentage": 0.22
      }
    }
  }
}
```

### Step 8: イベント受信テスト

既存の監視チャンネルで配信開始/終了イベントが正常に受信できることを確認：

```bash
# イベント履歴確認
curl http://localhost:4000/api/admin/eventsub/events?limit=10 | jq .
```

配信が開始/終了された際に、新しいイベントが記録されていることを確認。

### Step 9: メトリクス監視（24時間）

デプロイ後、24時間は以下のメトリクスを監視：

```bash
# Conduits関連エラー確認
curl http://localhost:4000/metrics | grep conduit

# 期待値:
# conduit_shard_failures_total 0
# conduit_websocket_errors_total 0
# conduit_reconnection_failures_total 0
# conduit_api_errors_total 0
```

---

## ロールバック手順

問題が発生した場合、WebSocketモードに戻す手順：

### Step 1: .env を変更

```bash
cd server
nano .env
```

```bash
# 変更
EVENTSUB_MODE=websocket
```

### Step 2: サーバー再起動

```bash
# 開発環境
npm run dev

# PM2
pm2 restart server

# systemd
sudo systemctl restart fukumado-server
```

### Step 3: 確認

管理画面で **モード: 📡 WebSocket** と表示されることを確認。

---

## トラブルシューティング

### 問題1: Conduit IDが表示されない

**症状:**
```
conduitId: null
totalShards: 0
```

**原因:**
- App Access Token が取得できていない
- Twitch APIへの接続エラー

**対処:**
```bash
# ログ確認
tail -f logs/server.log | grep "Conduit"

# 手動でApp Access Tokenテスト
curl -X POST 'https://id.twitch.tv/oauth2/token' \
  -d "client_id=${TWITCH_CLIENT_ID}" \
  -d "client_secret=${TWITCH_CLIENT_SECRET}" \
  -d 'grant_type=client_credentials'
```

### 問題2: シャードが無効（disabled）

**症状:**
```
enabledShards: 0
disabledShards: 1
```

**原因:**
- WebSocket接続失敗
- セッションID登録失敗

**対処:**
```bash
# サーバー再起動
pm2 restart server

# ログでエラー確認
tail -f logs/server.log | grep ERROR
```

### 問題3: サブスクリプションが0

**症状:**
```
totalSubscriptions: 0
```

**原因:**
- まだチャンネルが監視されていない
- サブスクリプション作成に失敗

**対処:**
```bash
# ユーザー統計確認（監視対象があるか）
curl http://localhost:4000/api/users/stats | jq .

# 手動でチャンネル追加テスト（テストチャンネルIDで）
curl -X POST http://localhost:4000/api/admin/eventsub/subscribe \
  -H "Content-Type: application/json" \
  -d '{"userId":"141981764"}'  # TwitchDev公式チャンネル
```

### 問題4: イベントが受信できない

**症状:**
- 配信開始/終了してもイベント履歴に記録されない

**対処:**
```bash
# WebSocketメッセージ確認
tail -f logs/server.log | grep "Shard #0 received"

# keepaliveが届いているか確認
# 正常であれば10秒ごとに "session_keepalive" が表示される

# サブスクリプション確認
curl http://localhost:4000/api/admin/eventsub/subscriptions | jq '.data.allChannels.realtime'
```

---

## デプロイ完了確認チェックリスト

- [ ] `.env` で `EVENTSUB_MODE=conduit` に設定済み
- [ ] サーバーが正常に起動（ログにエラーなし）
- [ ] 管理画面で「🚀 Conduits」と表示
- [ ] Conduit ID が表示されている
- [ ] 有効シャード数 = 総シャード数
- [ ] 無効シャード数 = 0
- [ ] サブスクリプション数が既存と同じ
- [ ] イベント履歴に新しいイベントが記録される
- [ ] メトリクスにエラーがない（0件）
- [ ] 24時間監視予定を設定

---

## まとめ

Conduitsモードへのデプロイは以下のステップで完了します：

1. ✅ デプロイ前の確認（チャンネル数、認証情報）
2. ✅ `.env` で `EVENTSUB_MODE=conduit` に変更
3. ✅ サーバー再起動
4. ✅ 管理画面とAPIで確認
5. ✅ イベント受信テスト
6. ✅ 24時間メトリクス監視

問題が発生した場合は、WebSocketモードへロールバック可能です。

**デプロイ後のサポート:**
- 運用ガイド: `CONDUITS_OPERATION_GUIDE.md`
- 動作確認: `CONDUITS_CHECKLIST.md`

---

**最終更新**: 2025-11-01
**バージョン**: 1.0.0
