# 17. Twitch EventSub Conduits

## 17.1 概要

### Conduitsモードとは

**Twitch EventSub Conduits** は、大規模なチャンネル監視に最適化されたEventSubの動作モードです。従来のWebSocketモードと比較して、100倍以上のスケーラビリティを持ちます。

### WebSocketモードとの比較

| 項目 | WebSocketモード | Conduitsモード |
|------|----------------|----------------|
| **最大サブスクリプション数** | 900 | **100,000** |
| **最大接続数** | 3 | **20,000** |
| **認証方式** | User Access Token | App Access Token |
| **シャード管理** | 手動（接続数管理） | **自動（Twitch側）** |
| **推奨用途** | 小規模（〜300チャンネル） | 大規模（300チャンネル〜） |
| **複雑度** | 低 | 中 |
| **安定性** | 標準 | **高（自動リトライ）** |

### 導入の利点

#### 1. 大規模対応
- 最大100,000サブスクリプション（WebSocketの111倍）
- 実質50,000チャンネルまで監視可能
- 300チャンネル以上を監視する場合に最適

#### 2. 自動管理
- Twitchが自動的にシャードを管理
- 手動でのシャード追加・削除が不要
- 負荷分散が自動化

#### 3. 安定性向上
- 接続失敗時の自動リトライ機能（最大3回）
- WebSocket切断時の自動再接続（最大10回）
- 指数バックオフによるAPI負荷軽減
- 詳細なメトリクスで問題早期発見

#### 4. 運用性向上
- 包括的な運用ドキュメント
- 視覚的な管理画面
- エラー対応ガイド完備

---

## 17.2 アーキテクチャ

### 全体構成

```
┌─────────────────────────────────────────────────┐
│              Twitch EventSub                   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │          Conduit (論理コンテナ)          │   │
│  │   ID: be53daa6-8f5c-4c46-aa5d-...       │   │
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
        │  ├ conduitClient      │
        │  ├ websocketShards    │
        │  └ metricsCollector   │
        └───────────────────────┘
```

### 主要コンポーネント

#### 1. Conduit（論理コンテナ）

**役割**: シャードとサブスクリプションをグループ化する論理的なコンテナ

**属性**:
```typescript
interface Conduit {
  id: string;              // UUID形式のID
  shard_count: number;     // 最大シャード数（1-20,000）
}
```

**特徴**:
- アプリケーションごとに1つのConduitを使用
- shard_countは容量（実際のシャード数ではない）
- Conduit作成後も既存のConduitを再利用可能

#### 2. Shard（実際のWebSocket接続）

**役割**: 実際のWebSocket接続とイベント受信

**属性**:
```typescript
interface Shard {
  id: string;              // シャードID（'0', '1', '2', ...）
  status: 'enabled' | 'webhook_callback_verification_pending'
        | 'webhook_callback_verification_failed'
        | 'notification_failures_exceeded'
        | 'authorization_revoked'
        | 'moderator_removed'
        | 'user_removed'
        | 'version_removed'
        | 'beta_maintenance'
        | 'websocket_disconnected'
        | 'websocket_failed_ping_pong'
        | 'websocket_received_inbound_traffic'
        | 'websocket_connection_unused'
        | 'websocket_internal_error'
        | 'websocket_network_timeout'
        | 'websocket_network_error';
  transport: {
    method: 'websocket';
    session_id: string;    // WebSocketセッションID
  };
}
```

**ライフサイクル**:
1. WebSocket接続確立
2. セッションID取得（Welcome メッセージ）
3. updateShards APIでシャード登録
4. イベント受信開始
5. 10秒ごとのkeepalive受信
6. 切断時は自動再接続

#### 3. Subscription（チャンネルごとのイベント購読）

**役割**: 特定のチャンネルのイベントを購読

**タイプ**:
- `stream.online` - 配信開始イベント
- `stream.offline` - 配信終了イベント

**関連付け**:
```typescript
{
  type: 'stream.online',
  version: '1',
  condition: {
    broadcaster_user_id: '141981764'
  },
  transport: {
    method: 'conduit',
    conduit_id: 'be53daa6-8f5c-4c46-aa5d-c5a369d97466'
  }
}
```

### データフロー

```
1. チャンネル監視開始
   ↓
2. サブスクリプション作成
   - POST /eventsub/subscriptions
   - transport.method = 'conduit'
   ↓
3. Twitchがシャードに割り当て
   - 自動負荷分散
   ↓
4. シャードがイベント受信
   - WebSocket経由
   ↓
5. twitchConduitManager.tsで処理
   - メッセージタイプ判定
   - イベント配信
   ↓
6. 既存のEventSubハンドラで処理
   - stream.online → 配信開始通知
   - stream.offline → 配信終了通知
```

---

## 17.3 技術仕様

### 容量制限

| 項目 | 制限値 |
|------|--------|
| **最大サブスクリプション数** | 100,000 |
| **最大シャード数** | 20,000 |
| **実質最大チャンネル数** | 50,000（1チャンネル = 2サブスクリプション） |
| **初期シャード数** | 10（設定変更可能） |

### 認証方式

#### App Access Token

**取得方法**:
```bash
POST https://id.twitch.tv/oauth2/token
Content-Type: application/x-www-form-urlencoded

client_id={TWITCH_CLIENT_ID}
&client_secret={TWITCH_CLIENT_SECRET}
&grant_type=client_credentials
```

**レスポンス**:
```json
{
  "access_token": "abcdefghijklmnopqrstuvwxyz0123",
  "expires_in": 5184000,
  "token_type": "bearer"
}
```

**管理**:
- `twitchAppAuth.ts` が自動取得・更新
- 有効期限: 60日間
- 90%ルールで自動リフレッシュ（約54日後）

### API エンドポイント

#### 1. Conduit作成

```
POST https://api.twitch.tv/helix/eventsub/conduits
Authorization: Bearer {APP_ACCESS_TOKEN}
Client-Id: {CLIENT_ID}
Content-Type: application/json

{
  "shard_count": 10
}
```

**レスポンス**:
```json
{
  "data": [
    {
      "id": "be53daa6-8f5c-4c46-aa5d-c5a369d97466",
      "shard_count": 10
    }
  ]
}
```

#### 2. Conduit一覧取得

```
GET https://api.twitch.tv/helix/eventsub/conduits
Authorization: Bearer {APP_ACCESS_TOKEN}
Client-Id: {CLIENT_ID}
```

#### 3. シャード登録・更新

```
PATCH https://api.twitch.tv/helix/eventsub/conduits/shards
Authorization: Bearer {APP_ACCESS_TOKEN}
Client-Id: {CLIENT_ID}
Content-Type: application/json

{
  "conduit_id": "be53daa6-8f5c-4c46-aa5d-c5a369d97466",
  "shards": [
    {
      "id": "0",
      "transport": {
        "method": "websocket",
        "session_id": "AQoQexampleSessionId1234567890"
      }
    }
  ]
}
```

#### 4. シャード一覧取得

```
GET https://api.twitch.tv/helix/eventsub/conduits/shards?conduit_id={CONDUIT_ID}
Authorization: Bearer {APP_ACCESS_TOKEN}
Client-Id: {CLIENT_ID}
```

#### 5. サブスクリプション作成

```
POST https://api.twitch.tv/helix/eventsub/subscriptions
Authorization: Bearer {APP_ACCESS_TOKEN}
Client-Id: {CLIENT_ID}
Content-Type: application/json

{
  "type": "stream.online",
  "version": "1",
  "condition": {
    "broadcaster_user_id": "141981764"
  },
  "transport": {
    "method": "conduit",
    "conduit_id": "be53daa6-8f5c-4c46-aa5d-c5a369d97466"
  }
}
```

---

## 17.4 実装詳細

### ファイル構成

```
server/src/services/
├── twitchConduitClient.ts       # Conduits API クライアント
├── twitchConduitManager.ts      # Conduit マネージャー
├── twitchAppAuth.ts             # App Access Token 管理
├── twitchEventSubManager.ts     # EventSub 統合マネージャー
└── metricsCollector.ts          # Conduits メトリクス
```

### twitchConduitClient.ts

**役割**: Conduits APIへのHTTPリクエストを管理

**主要メソッド**:

```typescript
class TwitchConduitClient {
  // Conduit作成
  async createConduit(shardCount: number): Promise<Conduit>

  // Conduit更新
  async updateConduit(conduitId: string, shardCount: number): Promise<Conduit>

  // Conduit一覧取得
  async getConduits(): Promise<Conduit[]>

  // Conduit削除
  async deleteConduit(conduitId: string): Promise<void>

  // シャード登録・更新
  async updateShards(request: UpdateShardsRequest): Promise<Shard[]>

  // シャード一覧取得
  async getShards(conduitId: string, status?: string, after?: string): Promise<GetShardsResponse>
}
```

**エラーハンドリング**:
```typescript
try {
  const conduit = await client.createConduit(10);
} catch (error) {
  if (error.message.includes('401')) {
    // App Access Token 再取得
  } else if (error.message.includes('429')) {
    // レート制限、待機してリトライ
  } else {
    // その他のエラー
  }
}
```

### twitchConduitManager.ts

**役割**: Conduitのライフサイクル管理、シャード管理、自動再接続

**主要機能**:

#### 1. 初期化

```typescript
async initialize(): Promise<void> {
  // 1. 既存Conduit確認
  const conduits = await this.conduitClient.getConduits();

  if (conduits.length > 0) {
    // 既存Conduitを再利用
    this.conduitId = conduits[0].id;
  } else {
    // 新規Conduit作成
    const conduit = await this.conduitClient.createConduit(this.initialShardCount);
    this.conduitId = conduit.id;
  }

  // 2. WebSocketシャード作成
  await this.createWebSocketShard(0);
}
```

#### 2. シャード作成（リトライロジック付き）

```typescript
private async createWebSocketShard(shardIndex: number, retryCount: number = 0): Promise<void> {
  try {
    // WebSocket接続
    const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

    // Welcome メッセージ待機
    const sessionId = await this.waitForSessionId(ws);

    // シャード登録
    await this.conduitClient.updateShards({
      conduit_id: this.conduitId!,
      shards: [{
        id: shardIndex.toString(),
        transport: {
          method: 'websocket',
          session_id: sessionId
        }
      }]
    });

  } catch (error) {
    if (retryCount < this.maxRetries) {
      // 指数バックオフでリトライ
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.createWebSocketShard(shardIndex, retryCount + 1);
    }
    throw error;
  }
}
```

#### 3. 自動再接続

```typescript
private setupAutoReconnect(shardIndex: number): void {
  const shard = this.shards.get(shardIndex);

  shard.ws.on('close', async (code, reason) => {
    console.log(`[Conduit Manager] Shard #${shardIndex} closed: ${code} - ${reason}`);

    // 予期しない切断
    if (code !== 1000) {
      await this.reconnectShard(shardIndex);
    }
  });
}

private async reconnectShard(shardIndex: number, attempt: number = 1): Promise<void> {
  if (attempt > this.maxReconnectAttempts) {
    console.error(`[Conduit Manager] Shard #${shardIndex} exceeded max reconnect attempts`);
    this.metricsCollector.incrementConduitReconnectionFailures();
    return;
  }

  const delay = Math.min(Math.pow(2, attempt - 1) * 1000, 30000);
  console.log(`[Conduit Manager] Shard #${shardIndex} reconnecting in ${delay}ms (attempt ${attempt}/${this.maxReconnectAttempts})...`);

  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    await this.createWebSocketShard(shardIndex);
    console.log(`[Conduit Manager] Shard #${shardIndex} reconnected successfully`);
    this.metricsCollector.incrementConduitReconnections();
  } catch (error) {
    console.error(`[Conduit Manager] Shard #${shardIndex} reconnection failed:`, error);
    await this.reconnectShard(shardIndex, attempt + 1);
  }
}
```

#### 4. session_reconnect メッセージ処理

```typescript
private handleMessage(shardIndex: number, rawData: string): void {
  const message = JSON.parse(rawData);

  switch (message.metadata.message_type) {
    case 'session_reconnect':
      console.log(`[Conduit Manager] Shard #${shardIndex} reconnect requested by Twitch`);
      const newUrl = message.payload.session.reconnect_url;
      this.reconnectToUrl(shardIndex, newUrl);
      break;

    case 'notification':
      this.handleNotification(shardIndex, message.payload);
      break;
  }
}
```

---

## 17.5 メトリクス

### Conduits関連メトリクス

#### Prometheusメトリクス

```typescript
// metricsCollector.ts
export const conduitShardFailures = new promClient.Counter({
  name: 'conduit_shard_failures_total',
  help: 'Total number of Conduit shard creation failures',
  labelNames: ['shard_index']
});

export const conduitWebsocketErrors = new promClient.Counter({
  name: 'conduit_websocket_errors_total',
  help: 'Total number of Conduit WebSocket errors'
});

export const conduitReconnections = new promClient.Counter({
  name: 'conduit_reconnections_total',
  help: 'Total number of successful Conduit reconnections'
});

export const conduitReconnectionFailures = new promClient.Counter({
  name: 'conduit_reconnection_failures_total',
  help: 'Total number of failed Conduit reconnections'
});

export const conduitApiErrors = new promClient.Counter({
  name: 'conduit_api_errors_total',
  help: 'Total number of Conduit API errors',
  labelNames: ['endpoint']
});
```

#### メトリクスAPI

**エンドポイント**: `GET /api/admin/eventsub/metrics`

**レスポンス**:
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

### 監視項目

| メトリクス | 正常値 | 警告値 | アクション |
|-----------|-------|-------|-----------|
| `conduit_shard_failures_total` | 0 | > 3 | ログ確認、ネットワーク確認 |
| `conduit_websocket_errors_total` | 0 | > 5 | WebSocket接続状態確認 |
| `conduit_reconnection_failures_total` | 0 | > 2 | サーバー再起動検討 |
| `conduit_api_errors_total` | 0 | > 10 | App Access Token確認 |

---

## 17.6 管理画面機能

### EventSub管理ページ

**URL**: `https://admin.fukumado.jp/eventsub`

#### 1. モード表示

```typescript
<div className={styles.statCard}>
  <div className={styles.statLabel}>モード</div>
  <div className={styles.statValue}>
    {statsData.stats.mode === 'conduit' ? '🚀 Conduits' : '📡 WebSocket'}
  </div>
  <div className={styles.statSubtext}>
    {statsData.stats.mode === 'conduit'
      ? '最大100,000サブスクリプション'
      : '最大900サブスクリプション'}
  </div>
</div>
```

#### 2. Conduit情報カード

**表示内容**:
- **Conduit ID**: UUID形式のID
- **総シャード数**: 登録済みシャード数
- **有効シャード数**: 正常動作中のシャード数
- **無効シャード数**: エラー状態のシャード数（通常0）
- **サブスクリプション**: 現在のサブスクリプション数
- **使用率**: 詳細な使用率（小数点3桁まで）

**コンポーネント**: `admin-web/src/components/pages/EventSub.tsx`

```typescript
{statsData.stats.mode === 'conduit' && statsData.stats.conduitStats && (
  <div className={styles.conduitInfo}>
    <div className={styles.conduitCard}>
      <div className={styles.conduitHeader}>
        <span className={styles.conduitTitle}>🚀 Conduit Information</span>
      </div>
      <div className={styles.conduitBody}>
        <div className={styles.conduitStat}>
          <span className={styles.conduitLabel}>Conduit ID:</span>
          <span className={styles.conduitValue}>
            {statsData.stats.conduitStats.conduitId || 'N/A'}
          </span>
        </div>
        {/* その他の統計情報 */}
      </div>
    </div>
    <div className={styles.conduitNote}>
      💡 Conduitsモードでは、Twitchが自動的にシャードを管理します。<br />
      最大100,000サブスクリプションまで対応可能です。
    </div>
  </div>
)}
```

#### 3. 統計カード

```typescript
<div className={styles.statCard}>
  <div className={styles.statLabel}>使用率</div>
  <div className={styles.statValue}>
    {statsData.capacity.percentage.toFixed(1)}%
  </div>
  <div className={styles.statSubtext}>
    {statsData.capacity.used} / {statsData.capacity.total}
  </div>
</div>

<div className={styles.statCard}>
  <div className={styles.statLabel}>残り容量</div>
  <div className={styles.statValue}>{statsData.capacity.available}</div>
  <div className={styles.statSubtext}>購読可能</div>
</div>
```

---

## 17.7 運用

### 起動手順

#### 1. 環境変数設定

```bash
# server/.env
EVENTSUB_MODE=conduit  # websocket または conduit
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
```

#### 2. サーバー起動

```bash
cd server
npm run dev  # 開発環境
# または
npm start    # 本番環境
```

#### 3. 起動ログ確認

**正常起動時のログ例**:
```
[Conduit Manager] Initializing...
[Conduit Manager] Initializing Conduit...
[Conduit Manager] Using existing Conduit: be53daa6-8f5c-4c46-aa5d-c5a369d97466
[Conduit Manager] Found 1 existing shard(s)
[Conduit Manager] Creating WebSocket shard #0 (attempt 1/3)...
[Conduit Manager] Shard #0 WebSocket connected
[Conduit Manager] Shard #0 session ID: AQoQ...
[Conduit Manager] Shard #0 registered successfully
```

### 監視方法

#### 1. 管理画面での監視

**URL**: `https://admin.fukumado.jp/eventsub`

**確認項目**:
- ✅ モード: 🚀 Conduits
- ✅ Conduit ID: 表示されている
- ✅ 有効シャード数 = 総シャード数
- ✅ 無効シャード数 = 0

#### 2. メトリクスAPI

```bash
curl https://api.fukumado.jp/api/admin/eventsub/metrics
```

**期待する結果**:
```json
{
  "success": true,
  "data": {
    "conduit": {
      "shardFailures": 0,
      "websocketErrors": 0,
      "reconnections": 0,
      "reconnectionFailures": 0,
      "apiErrors": 0
    }
  }
}
```

#### 3. Prometheusメトリクス

```bash
curl https://api.fukumado.jp/metrics | grep conduit
```

**期待する結果**:
```
conduit_shard_failures_total 0
conduit_websocket_errors_total 0
conduit_reconnections_total 0
conduit_reconnection_failures_total 0
conduit_api_errors_total 0
```

### トラブルシューティング

#### 問題1: Conduit IDが表示されない

**症状**: `conduitId: null`, `totalShards: 0`

**原因**:
- App Access Token が取得できていない
- Twitch APIへの接続エラー

**対処**:
1. ログ確認
   ```bash
   tail -f logs/server.log | grep "Conduit"
   ```

2. App Access Token 確認
   ```bash
   curl -X POST 'https://id.twitch.tv/oauth2/token' \
     -d "client_id=${TWITCH_CLIENT_ID}" \
     -d "client_secret=${TWITCH_CLIENT_SECRET}" \
     -d 'grant_type=client_credentials'
   ```

3. サーバー再起動

#### 問題2: シャードが無効（disabled）

**症状**: `enabledShards: 0`, `disabledShards: 1`

**原因**:
- WebSocket接続失敗
- セッションID登録失敗

**対処**:
1. 自動再接続を待つ（最大10回）
2. 再接続失敗が続く場合、サーバー再起動
3. ログでエラー確認
   ```bash
   tail -f logs/server.log | grep ERROR
   ```

#### 問題3: イベントが受信できない

**症状**: 配信開始/終了してもイベント履歴に記録されない

**対処**:
1. keepalive確認
   ```bash
   tail -f logs/server.log | grep "session_keepalive"
   ```
   → 10秒ごとに表示されるはず

2. サブスクリプション確認
   ```bash
   curl https://api.fukumado.jp/api/admin/eventsub/subscriptions
   ```

3. WebSocket接続状態確認
   ```bash
   curl https://api.fukumado.jp/api/admin/eventsub/stats
   ```

### ロールバック手順

問題が発生した場合、WebSocketモードに戻す：

#### 1. .env 変更

```bash
cd server
nano .env

# 変更
EVENTSUB_MODE=websocket
```

#### 2. サーバー再起動

```bash
# 開発環境
npm run dev

# PM2
pm2 restart server

# systemd
sudo systemctl restart fukumado-server
```

#### 3. 確認

管理画面で **モード: 📡 WebSocket** と表示されることを確認。

---

## 17.8 デプロイ情報

### デプロイ履歴

| 日時 | バージョン | 内容 |
|------|-----------|------|
| 2025-11-01 | 1.0.0 | Conduitsモード導入 |
| 2025-11-01 | 1.0.1 | チャンネル名表示修正（App Access Token対応） |
| 2025-11-01 | 1.0.2 | WebSocket多重接続対応（ポーリング監視修正） |

### 本番環境情報

**デプロイ日時**: 2025-11-01 20:20 JST

**Conduit ID**: `be53daa6-8f5c-4c46-aa5d-c5a369d97466`

**環境URL**:
- メイン: https://fukumado.jp
- API: https://api.fukumado.jp
- 管理画面: https://admin.fukumado.jp
- 管理API: https://admin-api.fukumado.jp

**デプロイ状況**: ✅ 成功

**確認結果**:
- ✅ Conduit ID 表示
- ✅ 総シャード数: 1
- ✅ 有効シャード: 1、無効シャード: 0
- ✅ 使用率: 0.000%
- ✅ 優先度システム正常動作

### Gitコミット履歴

```
eddd160 - feat(server): Conduitsモードに切り替え
51d24a5 - docs(server): Conduitsデプロイ手順書とチェックリスト作成
7f93629 - docs(server): Conduitsモード運用ガイド作成
f4cc106 - feat(server): Conduitsエラーハンドリング強化とメトリクス追加
585b3e6 - feat(admin-web): Conduits統計情報表示を追加
841d9bd - fix(server): Conduitsモード起動時の自動初期化実装
```

### スケーリング計画

| 監視チャンネル数 | サブスクリプション数 | 使用率 | 必要なシャード数 |
|----------------|-------------------|--------|---------------|
| 〜1,000 | 〜2,000 | 2% | 1 |
| 1,000〜5,000 | 2,000〜10,000 | 10% | 1-2 |
| 5,000〜10,000 | 10,000〜20,000 | 20% | 2-5 |
| 10,000〜25,000 | 20,000〜50,000 | 50% | 5-10 |
| 25,000〜50,000 | 50,000〜100,000 | 100% | 10-20 |

**注**: シャード数はTwitchが自動的に管理するため、手動での調整は通常不要。

---

## 17.9 トラブルシューティングと修正履歴

### 17.9.1 チャンネル名表示問題（2025-11-01修正）

#### 問題

管理画面（EventSub購読チャンネル一覧）で、Conduitsモード使用時にチャンネル名が表示されず、チャンネルIDのみが表示される問題が発生していました。

#### 原因

`server/src/routes/eventsub.ts` の `/api/admin/eventsub/subscriptions` エンドポイントで、チャンネル情報取得時に使用するトークンが不適切でした。

- **WebSocketモード**: User Access Tokenで正常動作
- **Conduitsモード**: User Access Tokenでは `null` が返され、チャンネル情報取得失敗

Conduitsモードでは**App Access Token**が必須ですが、コードはWebSocketモードと同じUser Access Tokenを使用していました。

#### 修正内容

**ファイル**: `server/src/routes/eventsub.ts` (88-124行目)

```typescript
// モードに応じたトークンを取得
let accessToken: string | null = null;
const mode = stats.mode;

if (mode === 'conduit') {
  // Conduitsモード: App Access Token を使用
  try {
    accessToken = await getTwitchAppAccessToken();
    console.log('[EventSub] Using App Access Token for Conduits mode');
  } catch (error) {
    console.error('[EventSub] Failed to get App Access Token:', error);
  }
} else {
  // WebSocketモード: User Access Token を使用
  accessToken = twitchEventSubManager.getAccessToken();
  console.log('[EventSub] Using User Access Token for WebSocket mode');
}
```

**変更点**:
1. `stats.mode` からEventSubの動作モードを取得
2. Conduitsモードの場合は `getTwitchAppAccessToken()` を呼び出し
3. WebSocketモードの場合は従来通り `getAccessToken()` を使用
4. トークン取得失敗時のエラーハンドリングを追加

#### 動作確認

- ✅ Conduitsモード: チャンネル名が正常に表示される
- ✅ WebSocketモード: 従来通り正常に動作（後方互換性保持）

#### Git Commit

- Commit ID: `38405f8`
- Message: `fix(eventsub): Conduitsモードでチャンネル名表示を修正`

### 17.9.2 ポーリング監視チャンネル消失問題（2025-11-01修正）

#### 問題

ポーリング監視中の配信情報が約30秒で消えてしまう現象が発生していました。

**症状**:
- 110チャンネル全てが突然消失
- ハードリロード後に再表示
- 何も操作していなくても一定時間で消える

#### 原因

Renderのロードバランサーが同一ユーザー（同じsessionId）に対して複数のWebSocket接続を作成する環境で、以下の問題が発生:

1. **複数接続の存在**: 同じユーザーが異なるIPから複数のWebSocket接続を持つ
2. **古い接続のタイムアウト**: 約88秒後、古い接続が `[WebSocket] Client timeout detected` でクローズ
3. **誤ったユーザー削除**: 接続クローズ時に他の接続が存在するにも関わらず `streamSyncService.unregisterUser()` が実行
4. **全チャンネル削除**: `unregisterUser()` により監視中の110チャンネル全てが削除される

**Renderログの証拠**:
```
[WebSocket] Client timeout detected: 6ISYnG2rn4FfmRhzV_rjy9zS-eBlh78U (88s since last message)
[StreamSyncService] Unregistering user: 6ISYnG2rn4FfmRhzV_rjy9zS-eBlh78U
[PriorityManager] Channel removed: twitch:XXXXX (repeated 110 times)
```

#### 修正内容

**ファイル**: `server/src/index.ts` (610-629行目)

```typescript
ws.on('close', async () => {
  console.log(`[WebSocket] Client disconnected: ${clientIP}`);

  // 接続を解除
  wsConnectionManager.unregisterConnection(clientIP);
  metricsCollector.recordWebSocketConnection(false);

  // クリーンアップ
  if (clientData.cleanup) {
    clientData.cleanup();
  }

  // 購読していたチャンネルから退出
  for (const channel of clientData.channels) {
    let otherClientSubscribed = false;
    for (const [otherWs, otherData] of clients) {
      if (otherWs !== ws && otherData.channels.has(channel)) {
        otherClientSubscribed = true;
        break;
      }
    }

    if (!otherClientSubscribed) {
      await twitchChatService.leaveChannel(channel);
      console.log(`[WebSocket] Left channel ${channel} (no other clients subscribed)`);
    }
  }

  // 現在の接続を削除
  clients.delete(ws);
  console.log(`[WebSocket] Total clients: ${clients.size}`);

  // 同じuserIdを持つ他の接続が存在するかチェック
  let hasOtherConnection = false;
  for (const [, otherData] of clients) {
    if (otherData.userId === clientData.userId) {
      hasOtherConnection = true;
      break;
    }
  }

  // 他の接続がない場合のみStreamSyncServiceからユーザーを削除
  if (!hasOtherConnection) {
    streamSyncService.unregisterUser(clientData.userId);
    console.log(`[WebSocket] Unregistered user ${clientData.userId} from StreamSyncService`);
  } else {
    console.log(`[WebSocket] User ${clientData.userId} has other active connections, keeping registered`);
  }
});
```

**変更点**:
1. `clients.delete(ws)` を**先に実行**（現在の接続を削除してから他の接続をチェック）
2. 同じ`userId`を持つ**他の接続の存在をチェック**
3. 他の接続が存在する場合は `unregisterUser()` を**実行しない**
4. ログ出力を追加してデバッグ可能にする

#### 動作確認

- ✅ 複数接続時: 古い接続がタイムアウトしてもユーザー登録が維持される
- ✅ 最後の接続: 全ての接続がクローズされた時のみ `unregisterUser()` が実行される
- ✅ チャンネル情報: 30秒経過後も110チャンネルが維持される

#### Git Commit

- Commit ID: `92d2dd0`
- Message: `fix(websocket): 同一ユーザーの複数接続を考慮してunregisterUser()を実行`

---

## 17.10 参考資料

### 公式ドキュメント

- [EventSub Conduits](https://dev.twitch.tv/docs/eventsub/handling-conduit-events/)
- [EventSub API Reference](https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription)
- [Twitch Developer Status](https://devstatus.twitch.tv/)

### プロジェクト内ドキュメント

- 運用ガイド: `server/docs/CONDUITS_OPERATION_GUIDE.md` (416行)
- デプロイ手順: `server/docs/CONDUITS_DEPLOYMENT.md` (386行)
- 動作確認チェックリスト: `server/docs/CONDUITS_CHECKLIST.md` (440行)
- デプロイレポート: `server/docs/CONDUITS_DEPLOYMENT_REPORT.md`
- 検証レポート: `server/docs/CONDUITS_VERIFICATION_REPORT.md`

---

**最終更新**: 2025-11-01
**バージョン**: 1.0.2 (チャンネル名表示修正、WebSocket多重接続対応を含む)
