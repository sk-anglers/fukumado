# Twitch EventSub Conduits 運用ガイド

本ドキュメントは、Twitch EventSub Conduitsモードの運用方法について説明します。

## 目次

1. [概要](#概要)
2. [Conduitsモードとは](#conduitsモードとは)
3. [環境設定](#環境設定)
4. [起動と確認](#起動と確認)
5. [監視とメトリクス](#監視とメトリクス)
6. [エラー対応](#エラー対応)
7. [スケーリング](#スケーリング)
8. [FAQ](#faq)

---

## 概要

### WebSocketモード vs Conduitsモード

| 項目 | WebSocketモード | Conduitsモード |
|------|----------------|----------------|
| 最大サブスクリプション数 | 900 | 100,000 |
| 最大接続数 | 3 | 20,000 |
| 認証方式 | User Access Token | App Access Token |
| シャード管理 | 手動（接続数管理） | 自動（Twitch側） |
| 推奨用途 | 小規模（〜300チャンネル） | 大規模（300チャンネル〜） |

### Conduitsモードの利点

- **大規模対応**: 100チャンネル以上を監視する場合に最適
- **自動管理**: Twitchが自動的にシャードを管理
- **安定性向上**: 接続失敗時の自動リトライ・再接続機能

---

## Conduitsモードとは

### アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│              Twitch EventSub                   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │          Conduit (論理コンテナ)          │   │
│  │                                          │   │
│  │  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Shard 0  │  │ Shard 1  │  ...        │   │
│  │  │ (WS接続) │  │ (WS接続) │            │   │
│  │  └──────────┘  └──────────┘            │   │
│  │                                          │   │
│  │  最大20,000シャード                      │   │
│  │  最大100,000サブスクリプション            │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │  本サービス (Server)   │
        │                       │
        │  TwitchConduitManager │
        └───────────────────────┘
```

### 主要コンポーネント

1. **Conduit**: 論理的なコンテナ（1つ）
2. **Shard**: 実際のWebSocket接続（複数可）
3. **Subscription**: チャンネルごとのイベント購読（最大100,000）

---

## 環境設定

### 1. 環境変数の設定

`server/.env` ファイルを編集：

```bash
# EventSubモード設定
EVENTSUB_MODE=conduit  # websocket または conduit

# Twitch認証情報
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
```

### 2. App Access Tokenの準備

Conduitsモードでは **App Access Token** が必要です。

```bash
# 自動取得（サーバー起動時）
# twitchAppAuth.ts が自動的にApp Access Tokenを取得・更新します

# 手動確認（開発時）
curl -X POST 'https://id.twitch.tv/oauth2/token' \
  -d "client_id=${TWITCH_CLIENT_ID}" \
  -d "client_secret=${TWITCH_CLIENT_SECRET}" \
  -d 'grant_type=client_credentials'
```

### 3. 必要な権限

Conduitsモードでは以下のTwitch APIアクセスが必要です：

- `POST /eventsub/conduits` - Conduit作成
- `GET /eventsub/conduits` - Conduit一覧取得
- `PATCH /eventsub/conduits/shards` - シャード登録・更新
- `GET /eventsub/conduits/shards` - シャード一覧取得
- `POST /eventsub/subscriptions` - サブスクリプション作成

---

## 起動と確認

### 1. サーバー起動

```bash
cd server
npm run dev  # 開発環境
# または
npm start    # 本番環境
```

### 2. 起動ログ確認

正常起動時のログ例：

```
[Conduit Manager] Initializing...
[Conduit Manager] Initializing Conduit...
[Conduit Manager] Using existing Conduit: 12345678-abcd-...
[Conduit Manager] Found 1 existing shard(s)
[Conduit Manager] Creating WebSocket shard #0 (attempt 1/3)...
[Conduit Manager] Shard #0 WebSocket connected
[Conduit Manager] Shard #0 session ID: AQoQ...
[Conduit Manager] Shard #0 registered successfully
```

### 3. 管理画面で確認

管理画面（`http://localhost:3000/eventsub`）にアクセスし、以下を確認：

- **モード**: 🚀 Conduits と表示されている
- **Conduit ID**: 英数字のID
- **総シャード数**: 1以上
- **有効シャード**: 総シャード数と同じ
- **無効シャード**: 0

---

## 監視とメトリクス

### 1. 管理画面での監視

#### 統計カード

- **モード**: Conduitsモード表示
- **総購読数**: サブスクリプション総数
- **使用率**: サブスクリプション使用率（100,000分の何%）
- **残り容量**: あと何チャンネル購読可能か

#### Conduit情報カード

- **Conduit ID**: 現在使用中のConduit ID
- **総シャード数**: 登録済みシャード数
- **有効シャード数**: 正常動作中のシャード数
- **無効シャード数**: エラー状態のシャード数（通常0）
- **サブスクリプション**: 現在のサブスクリプション数
- **使用率**: 詳細な使用率（小数点3桁まで）

### 2. メトリクス API

#### メトリクス取得

```bash
curl http://localhost:4000/api/admin/eventsub/metrics
```

**レスポンス例:**

```json
{
  "success": true,
  "data": {
    "twitch": {
      "apiCalls": 150,
      "apiErrors": 2,
      "websocketErrors": 0,
      "subscriptionAttempts": 100,
      "subscriptionFailures": 0
    },
    "conduit": {
      "shardFailures": 0,
      "websocketErrors": 0,
      "reconnections": 1,
      "reconnectionFailures": 0,
      "apiErrors": 0
    }
  }
}
```

#### Prometheusメトリクス

```bash
curl http://localhost:4000/metrics
```

**Conduits関連メトリクス:**

- `conduit_shard_failures_total` - シャード作成失敗数
- `conduit_websocket_errors_total` - WebSocketエラー数
- `conduit_reconnections_total` - 再接続成功数
- `conduit_reconnection_failures_total` - 再接続失敗数
- `conduit_api_errors_total` - Conduit API エラー数

### 3. ログ監視

#### 正常動作時のログパターン

```
[Conduit Manager] Shard #0 received: session_keepalive
[Conduit Manager] Shard #0 keepalive
[Conduit Manager] Shard #0 received: notification
[Conduit Manager] Shard #0 event: stream.online
```

#### 注意が必要なログパターン

```
[Conduit Manager] Shard #0 reconnect requested by Twitch
[Conduit Manager] Shard #0 reconnecting in 1000ms (attempt 1/10)...
[Conduit Manager] Shard #0 reconnected successfully
```

→ 自動再接続が動作しているため通常は問題ありませんが、頻発する場合は調査が必要

---

## エラー対応

### エラーパターンと対処法

#### 1. シャード作成失敗

**エラーログ:**
```
[Conduit Manager] Shard #0 creation failed (attempt 1/3): Error: ...
[Conduit Manager] Retrying shard #0 in 1000ms...
```

**原因:**
- ネットワーク一時的な問題
- Twitch APIの一時的な障害

**対処:**
- 自動リトライ（最大3回）が動作
- リトライ後も失敗する場合は、ネットワーク確認
- メトリクス `conduit_shard_failures_total` を確認

#### 2. WebSocket切断

**エラーログ:**
```
[Conduit Manager] Shard #0 closed: 1006 -
[Conduit Manager] Shard #0 unexpected close, initiating reconnect...
```

**原因:**
- ネットワーク切断
- Twitch側のメンテナンス

**対処:**
- 自動再接続が動作（最大10回）
- 再接続失敗が続く場合、サーバー再起動を検討

#### 3. 再接続失敗

**エラーログ:**
```
[Conduit Manager] Shard #0 exceeded max reconnect attempts (10)
[Conduit Manager] Shard #0 reconnection failed: Error: ...
```

**原因:**
- 長期的なネットワーク障害
- Twitch側の障害

**対処:**
1. ネットワーク接続確認
2. Twitch API ステータス確認: https://devstatus.twitch.tv/
3. サーバー再起動
4. 必要に応じて WebSocketモードに一時切り替え

#### 4. Conduit API エラー

**エラーログ:**
```
[Conduit Manager] Failed to initialize Conduit: Error: Failed to create subscription: 401 - ...
```

**原因:**
- App Access Token の期限切れ
- 認証情報の誤り

**対処:**
1. App Access Token を確認
2. `.env` ファイルの `TWITCH_CLIENT_ID` と `TWITCH_CLIENT_SECRET` を確認
3. サーバー再起動してトークン再取得

### 緊急時の WebSocketモードへの切り替え

Conduitsモードに問題が発生した場合、一時的にWebSocketモードに切り替え可能：

```bash
# .env ファイルを編集
EVENTSUB_MODE=websocket

# サーバー再起動
npm restart
```

---

## スケーリング

### シャード数の増加

Conduitsモードでは、Twitchが自動的にシャードを管理するため、基本的に手動でのシャード追加は不要です。

#### 初期シャード数の変更

`server/src/services/twitchConduitManager.ts`:

```typescript
private initialShardCount: number = 10; // デフォルト: 10
```

必要に応じて初期シャード容量を増やすことができます。

### サブスクリプション数の上限

- **Conduitsモード**: 最大 100,000 サブスクリプション
- **1チャンネルあたり**: 2サブスクリプション（stream.online + stream.offline）
- **実質最大チャンネル数**: 50,000チャンネル

### 監視チャンネル数の目安

| チャンネル数 | サブスクリプション数 | 使用率 | 推奨モード |
|------------|-------------------|--------|----------|
| 〜300 | 〜600 | 0.6% | WebSocket |
| 300〜1,000 | 600〜2,000 | 0.6%〜2% | **Conduits** |
| 1,000〜10,000 | 2,000〜20,000 | 2%〜20% | **Conduits** |
| 10,000〜50,000 | 20,000〜100,000 | 20%〜100% | **Conduits** |

---

## FAQ

### Q1. ConduitsモードとWebSocketモードを同時に使えますか？

**A**: いいえ、環境変数 `EVENTSUB_MODE` で1つのモードを選択します。切り替えにはサーバー再起動が必要です。

### Q2. Conduit IDは変更されますか？

**A**: 基本的に変更されません。サーバー起動時に既存Conduitを再利用します。削除しない限り同じIDが使われます。

### Q3. シャードが無効（disabled）になるのはなぜですか？

**A**: 以下の理由が考えられます：
- WebSocket接続が切断され、再接続に失敗した
- Twitch側でシャードを無効化した
- セッションIDの有効期限切れ

無効シャードは自動的に再接続を試みます。

### Q4. 最大10回の再接続試行後はどうなりますか？

**A**: シャードはエラー状態になり、再接続を停止します。サーバー再起動が必要です。

### Q5. サブスクリプションの同期はどうなっていますか？

**A**: サーバー起動時に既存サブスクリプションを確認し、必要に応じて新規作成します。手動で同期する必要はありません。

### Q6. Conduitsモードでのコストは？

**A**: Twitch EventSub自体は無料です。ただし、WebSocket通信によるネットワーク帯域は消費します。

### Q7. 管理画面で「使用率: 0.000%」と表示されます

**A**: まだチャンネルを監視していない状態です。ユーザーが配信を視聴すると自動的にチャンネルが追加され、使用率が上がります。

### Q8. App Access Tokenの更新頻度は？

**A**: 自動的に管理されます。有効期限が近づくと自動更新されます（通常60日間有効）。

---

## まとめ

Conduitsモードは大規模なチャンネル監視に最適化されたモードです：

✅ **100チャンネル以上を監視する場合は Conduitsモード推奨**
✅ **自動リトライ・再接続機能で安定性向上**
✅ **メトリクス監視で問題を早期発見**
✅ **緊急時は WebSocketモードへ切り替え可能**

運用に関する質問や問題が発生した場合は、本ドキュメントを参照してください。

---

**最終更新**: 2025-11-01
**バージョン**: 1.0.0
