# Twitch EventSub Conduits 実装設計書

## 目次

1. [概要](#概要)
2. [背景と目的](#背景と目的)
3. [現在のアーキテクチャと制限](#現在のアーキテクチャと制限)
4. [Conduitsアーキテクチャ](#conduitsアーキテクチャ)
5. [技術仕様](#技術仕様)
6. [実装計画](#実装計画)
7. [マイグレーション戦略](#マイグレーション戦略)
8. [モニタリングとアラート](#モニタリングとアラート)
9. [リスクと対策](#リスクと対策)
10. [参考資料](#参考資料)

---

## 概要

Twitch EventSub Conduitsは、大規模なイベントサブスクリプションを管理するための新しいトランスポートメソッドです。現在のWebSocket接続方式（最大900サブスクリプション）から、Conduits方式（最大100,000サブスクリプション）へ移行することで、サービスのスケーラビリティを大幅に向上させます。

### 主要な数値

| 項目 | 現在（WebSocket） | 移行後（Conduits） |
|------|------------------|-------------------|
| 最大接続数 | 3本 | 1 Conduit（最大5） |
| 接続あたり上限 | 300サブスクリプション | 20,000シャード |
| 合計上限 | 900サブスクリプション | 100,000サブスクリプション |
| 認証方式 | User Access Token | App Access Token |
| 自動スケーリング | 手動管理 | Twitch側で自動 |

---

## 背景と目的

### 現状の課題

1. **容量不足**: 現在のWebSocket方式では最大900チャンネルまでしか監視できない
2. **スケーラビリティ**: チャンネル数が300を超えると新規サブスクリプションが困難
3. **手動管理**: 接続の負荷分散を手動で管理する必要がある
4. **再接続コスト**: 接続断時に全サブスクリプションを再作成する必要がある

### 移行の目的

1. **大規模スケーリング**: 100,000チャンネルまで対応可能
2. **自動管理**: Twitchが自動的にシャードを管理
3. **高可用性**: シャードレベルでの自動フェイルオーバー
4. **将来性**: サービス成長に対応できるインフラ基盤

### 移行タイミング

**推奨**: 監視チャンネル数が200-300に達した時点で移行を開始

---

## 現在のアーキテクチャと制限

### 現在の実装

```
TwitchEventSubManager (マネージャー)
  ├── TwitchEventSubConnection #0 (最大300サブスクリプション)
  ├── TwitchEventSubConnection #1 (最大300サブスクリプション)
  └── TwitchEventSubConnection #2 (最大300サブスクリプション)

合計: 最大900サブスクリプション（3接続 × 300）
```

### 主要クラス

- **TwitchEventSubManager** (`server/src/services/twitchEventSubManager.ts`)
  - 3本のWebSocket接続を管理
  - 負荷分散（最も負荷の低い接続を選択）
  - イベントハンドラーの統合

- **TwitchEventSubConnection** (`server/src/services/twitchEventSubConnection.ts`)
  - 個別のWebSocket接続
  - サブスクリプション管理（作成/削除）
  - イベント受信とディスパッチ

### 制限事項

1. **接続数制限**: 最大3接続まで
2. **サブスクリプション制限**: 接続あたり300まで
3. **認証**: User Access Tokenが必要
4. **再接続**: 接続断時に全サブスクリプションを再作成

---

## Conduitsアーキテクチャ

### Conduits概要

Conduitsは、複数のWebSocket接続（シャード）を論理的にグループ化し、Twitchが自動的に管理する仕組みです。

```
Conduit (論理的なグループ)
  ├── Shard #0 (WebSocket)
  ├── Shard #1 (WebSocket)
  ├── Shard #2 (WebSocket)
  ├── ...
  └── Shard #N (最大20,000シャード)

各シャード: WebSocketセッション
Conduit全体: 最大100,000サブスクリプション
```

### 主要概念

#### 1. Conduit（コンジット）

- **定義**: シャードの論理的なグループ
- **上限**: アカウントあたり最大5 Conduits
- **管理**: 1つのConduitで1サービスを運用（推奨）

#### 2. Shard（シャード）

- **定義**: 個別のWebSocket接続
- **上限**: Conduitあたり最大20,000シャード
- **管理**: Twitchが自動的にスケーリング
- **状態**: enabled, websocket_disconnected, websocket_failed_ping_pong, など

#### 3. Transport（トランスポート）

- **WebSocket**: リアルタイム受信（推奨）
- **Webhook**: HTTP POSTで受信（オプション）

### Conduitsの利点

1. **自動スケーリング**: Twitchがシャード数を自動調整
2. **自動フェイルオーバー**: シャード障害時に自動的に再接続
3. **高可用性**: シャード単位での障害分離
4. **シンプルな管理**: サブスクリプション作成時にConduit IDを指定するだけ

---

## 技術仕様

### App Access Token管理

#### 実装: `TwitchAppAuthManager`

Conduitsの利用にはApp Access Tokenが必要です。

```typescript
class TwitchAppAuthManager {
  private cachedToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private refreshPromise: Promise<string> | null = null;

  async getToken(): Promise<string> {
    // キャッシュが有効な場合は再利用
    // 有効期限の90%で期限切れとみなす
    // 重複リクエストを防止
  }

  private async fetchNewToken(): Promise<string> {
    // Client Credentials Flowでトークンを取得
  }
}
```

**特徴**:
- トークンキャッシング（メモリ内）
- 有効期限の90%で自動リフレッシュ
- 重複リクエスト防止（`refreshPromise`）

### Conduits API Client

#### 実装: `TwitchConduitClient`

Conduits APIとの通信を担当します。

```typescript
class TwitchConduitClient {
  // Conduit管理
  async createConduit(shardCount: number): Promise<Conduit>
  async updateConduit(conduitId: string, shardCount: number): Promise<Conduit>
  async getConduits(): Promise<Conduit[]>
  async deleteConduit(conduitId: string): Promise<void>

  // シャード管理
  async updateShards(request: UpdateShardsRequest): Promise<UpdateShardsResponse>
  async getShards(conduitId: string, after?: string): Promise<GetShardsResponse>
}
```

**主要メソッド**:

1. **createConduit**: 新しいConduitを作成（初回起動時）
2. **getConduits**: 既存Conduitを取得（起動時に確認）
3. **updateShards**: WebSocketセッションIDをシャードに関連付け
4. **getShards**: 全シャードの状態を取得（監視用）

### 型定義

#### `server/src/types/conduit.ts`

```typescript
export interface Conduit {
  id: string;
  shard_count: number;
}

export interface ConduitShard {
  id: string;
  status: 'enabled' | 'websocket_disconnected' | ...;
  transport: ConduitTransport;
}

export interface ConduitTransport {
  method: 'webhook' | 'websocket';
  session_id?: string;  // WebSocketの場合
  callback?: string;     // Webhookの場合
}

export interface UpdateShardsRequest {
  conduit_id: string;
  shards: Array<{
    id: string;
    transport: ConduitTransport;
  }>;
}

export interface ConduitStats {
  conduitId: string | null;
  totalShards: number;
  enabledShards: number;
  disabledShards: number;
  totalSubscriptions: number;
  usagePercentage: number;
}
```

---

## 実装計画

### 全体スケジュール（8週間）

| フェーズ | 期間 | 主要タスク |
|---------|------|-----------|
| Phase 1: 調査・設計 | 2週間 | 要件定義、設計、プロトタイプ |
| Phase 2: 基盤実装 | 3週間 | Conduit管理、接続管理、移行ツール |
| Phase 3: 段階的移行 | 2週間 | 並行運用、監視、移行完了 |
| Phase 4: 最適化・監視 | 1週間 | パフォーマンス調整、ドキュメント |

### Phase 0: 準備段階（完了）

**期間**: 即座

**タスク**:
- [x] App Access Token管理の実装（`twitchAppAuth.ts`拡張）
- [x] Conduit型定義の作成（`conduit.ts`）
- [x] Conduits APIクライアントの作成（`twitchConduitClient.ts`）
- [x] 設計ドキュメントの作成（本ドキュメント）

### Phase 1: 調査・設計

**期間**: 2週間

#### Week 1: 詳細調査

**タスク**:
1. Conduits APIの動作検証
   - テスト用Conduit作成
   - シャード更新の動作確認
   - エラーハンドリングの確認
2. WebSocketセッション管理の調査
   - 既存接続との互換性
   - セッションID取得タイミング
   - 再接続フロー

**成果物**:
- 動作検証レポート
- 互換性マトリックス

#### Week 2: 詳細設計

**タスク**:
1. アーキテクチャ設計
   - `TwitchConduitManager`クラス設計
   - 既存EventSubManagerとの統合方法
   - データフロー設計
2. マイグレーション計画詳細化
   - 並行運用期間の定義
   - ロールバック手順
   - データ移行計画

**成果物**:
- 詳細設計書
- クラス図
- シーケンス図
- マイグレーション手順書

### Phase 2: 基盤実装

**期間**: 3週間

#### Week 3-4: Conduit管理機能

**タスク**:
1. `TwitchConduitManager`クラスの実装
   ```typescript
   class TwitchConduitManager {
     private conduitId: string | null = null;
     private shards: Map<string, ConduitShard> = new Map();

     async initialize(): Promise<void>
     async ensureConduit(): Promise<string>
     async registerWebSocket(sessionId: string, shardId: string): Promise<void>
     async subscribeToEvents(conduitId: string, subscriptions: any[]): Promise<void>
     async getStats(): Promise<ConduitStats>
   }
   ```

2. Conduit初期化ロジック
   - 既存Conduit確認
   - 新規Conduit作成（必要な場合）
   - 初期シャード数の決定（例: 10シャード）

3. シャード管理
   - WebSocketセッションID取得
   - シャード登録（`updateShards` API）
   - シャード状態監視

**成果物**:
- `TwitchConduitManager`実装
- 単体テスト

#### Week 5: WebSocket接続管理

**タスク**:
1. `TwitchConduitConnection`クラスの実装
   - 既存`TwitchEventSubConnection`をベースに拡張
   - Conduit対応のWebSocket接続
   - セッションID管理

2. 接続プール管理
   - 複数WebSocket接続の管理（シャード化）
   - 自動再接続
   - ヘルスチェック

**成果物**:
- `TwitchConduitConnection`実装
- 接続管理テスト

#### Week 6: EventSub統合

**タスク**:
1. `TwitchEventSubManager`の拡張
   - Conduitsモード追加
   - WebSocketモードとの切り替え
   - 共通インターフェース維持

2. サブスクリプション管理
   - Conduit IDを指定したサブスクリプション作成
   - 既存サブスクリプションの移行
   - サブスクリプション削除

**成果物**:
- EventSubManager拡張
- 統合テスト

### Phase 3: 段階的移行

**期間**: 2週間

#### Week 7: 並行運用開始

**タスク**:
1. 並行運用モードの実装
   - WebSocketモードとConduitsモードの同時稼働
   - イベント重複排除
   - モニタリングダッシュボード

2. 小規模移行テスト
   - 10-20チャンネルで先行テスト
   - イベント受信の確認
   - パフォーマンス測定

**成果物**:
- 並行運用モード実装
- 移行テストレポート

#### Week 8: 全面移行

**タスク**:
1. 段階的チャンネル移行
   - 50チャンネルずつ移行
   - 各段階でモニタリング
   - 問題発生時のロールバック準備

2. WebSocketモードの廃止
   - 全チャンネルConduitsへ移行完了
   - 旧WebSocket接続のクローズ
   - クリーンアップ

**成果物**:
- 移行完了レポート
- パフォーマンス比較データ

### Phase 4: 最適化・監視

**期間**: 1週間

**タスク**:
1. パフォーマンス最適化
   - シャード数の調整
   - 接続プールサイズの最適化
   - メモリ使用量の削減

2. 監視・アラート強化
   - Conduit統計情報の可視化
   - シャード状態アラート
   - 容量アラート（80%使用時など）

3. ドキュメント整備
   - 運用マニュアル
   - トラブルシューティングガイド
   - APIリファレンス

**成果物**:
- 最適化レポート
- 運用ドキュメント一式

---

## マイグレーション戦略

### 並行運用期間の設計

#### 目的

- リスクを最小化
- 問題発生時の即座のロールバック
- データの整合性確保

#### 並行運用アーキテクチャ

```
┌─────────────────────────────────────┐
│   TwitchEventSubManager (統合)      │
│                                     │
│  ┌──────────────┐  ┌─────────────┐ │
│  │ WebSocket    │  │ Conduits    │ │
│  │ Mode (旧)    │  │ Mode (新)   │ │
│  │              │  │             │ │
│  │ 900ch上限    │  │ 100,000ch   │ │
│  └──────────────┘  └─────────────┘ │
│         │                 │         │
│         └────────┬────────┘         │
│                  │                  │
│         ┌────────▼────────┐         │
│         │ Event Deduper   │         │
│         │ (重複排除)       │         │
│         └─────────────────┘         │
└─────────────────────────────────────┘
```

#### フェーズ別移行

| フェーズ | WebSocketチャンネル | Conduitsチャンネル | 説明 |
|---------|-------------------|-------------------|------|
| Phase 0 | 100% | 0% | 現状（移行前） |
| Phase 1 | 90% | 10% | 小規模テスト（10-20ch） |
| Phase 2 | 70% | 30% | 段階的移行（50ch単位） |
| Phase 3 | 30% | 70% | 大規模移行 |
| Phase 4 | 0% | 100% | 移行完了 |

### ロールバック計画

#### ロールバック条件

以下の条件を満たす場合、即座にロールバックを実施：

1. **イベント損失**: 10%以上のイベントが受信されない
2. **レイテンシ増加**: 平均レイテンシが2倍以上
3. **接続安定性**: 1時間に3回以上の切断
4. **API障害**: Conduits APIの継続的な障害

#### ロールバック手順

1. **即時対応**（5分以内）
   - Conduitsモードの無効化
   - WebSocketモードへの切り替え
   - 影響チャンネルの確認

2. **詳細調査**（1時間以内）
   - ログ分析
   - 原因特定
   - 修正計画の策定

3. **再移行準備**（必要に応じて）
   - 問題修正
   - 再テスト
   - 再移行スケジュール策定

---

## モニタリングとアラート

### Conduit統計情報

#### 管理画面への追加項目

```typescript
interface ConduitStats {
  conduitId: string | null;         // Conduit ID
  totalShards: number;              // 総シャード数
  enabledShards: number;            // 有効シャード数
  disabledShards: number;           // 無効シャード数
  totalSubscriptions: number;       // 総サブスクリプション数
  usagePercentage: number;          // 使用率（%）
}
```

#### ダッシュボード表示

- **Conduit情報**
  - Conduit ID
  - シャード数（有効/無効/合計）
  - サブスクリプション数
  - 容量使用率

- **シャード詳細**
  - シャードID
  - ステータス（enabled, disconnected, etc.）
  - WebSocketセッションID
  - 最終更新時刻

### アラート設定

#### 容量アラート

```typescript
// 使用率80%でWarning
if (stats.usagePercentage >= 80) {
  sendAlert('warning', 'Conduit capacity approaching limit (80%)');
}

// 使用率90%でCritical
if (stats.usagePercentage >= 90) {
  sendAlert('critical', 'Conduit capacity critical (90%)');
}
```

#### シャード健全性アラート

```typescript
// 無効シャードが10%以上
const disabledRate = stats.disabledShards / stats.totalShards;
if (disabledRate >= 0.1) {
  sendAlert('warning', `${stats.disabledShards} shards disabled`);
}

// 無効シャードが30%以上
if (disabledRate >= 0.3) {
  sendAlert('critical', `${stats.disabledShards} shards disabled (critical)`);
}
```

#### 接続アラート

- WebSocket切断（5分以上継続）
- API障害（3回連続失敗）
- トークンリフレッシュ失敗

### ログ強化

#### Conduitsモード専用ログ

```typescript
console.log('[Conduit Manager] Initializing Conduit...');
console.log(`[Conduit Manager] Conduit created: ${conduitId} with ${shardCount} shards`);
console.log(`[Conduit Manager] Shard #${shardId} registered with session ${sessionId}`);
console.log(`[Conduit Manager] Subscription created: ${subscriptionId} for channel ${channelId}`);
console.log(`[Conduit Manager] Stats: ${enabledShards}/${totalShards} shards enabled, ${totalSubscriptions} subscriptions`);
```

---

## リスクと対策

### リスク分析

#### 1. Conduits API障害

**リスク**: Conduits APIが利用不可になる

**影響度**: 高（サービス停止）

**対策**:
- WebSocketモードへの自動フォールバック
- リトライロジック（指数バックオフ）
- ヘルスチェックエンドポイント

#### 2. シャード障害

**リスク**: 一部シャードが無効化される

**影響度**: 中（一部チャンネルのイベント損失）

**対策**:
- 自動シャード再登録
- 無効シャード監視とアラート
- 予備シャードの事前確保

#### 3. App Access Token期限切れ

**リスク**: トークン期限切れでAPI呼び出し失敗

**影響度**: 高（全サブスクリプション停止）

**対策**:
- 有効期限の90%で自動リフレッシュ
- リフレッシュ失敗時のリトライ
- トークン状態の監視

#### 4. 大規模移行時のイベント損失

**リスク**: 移行中にイベントが受信されない

**影響度**: 中（一時的なデータ欠損）

**対策**:
- 並行運用期間の確保
- イベント重複排除機能
- 移行前後のイベント数比較

#### 5. パフォーマンス劣化

**リスク**: Conduitsモードでレイテンシが増加

**影響度**: 低〜中（ユーザー体験の低下）

**対策**:
- 移行前のベンチマーク取得
- 段階的移行でのパフォーマンス監視
- シャード数の最適化

### 対策実装優先度

| 優先度 | 対策 | 実装タイミング |
|-------|------|--------------|
| P0 | WebSocketモードへのフォールバック | Phase 2 Week 3 |
| P0 | App Access Token自動リフレッシュ | Phase 0（完了） |
| P1 | 自動シャード再登録 | Phase 2 Week 5 |
| P1 | 容量アラート | Phase 3 Week 7 |
| P2 | イベント重複排除 | Phase 3 Week 7 |
| P2 | パフォーマンス監視 | Phase 4 |

---

## 参考資料

### 公式ドキュメント

1. **Handling conduit events**
   - URL: https://dev.twitch.tv/docs/eventsub/handling-conduit-events/
   - 内容: Conduitsの概要、使用方法、ベストプラクティス

2. **Conduits API Reference**
   - Create Conduit: https://dev.twitch.tv/docs/api/reference/#create-conduits
   - Update Conduit Shards: https://dev.twitch.tv/docs/api/reference/#update-conduit-shards
   - Get Conduits: https://dev.twitch.tv/docs/api/reference/#get-conduits
   - Get Conduit Shards: https://dev.twitch.tv/docs/api/reference/#get-conduit-shards
   - Delete Conduit: https://dev.twitch.tv/docs/api/reference/#delete-conduit

3. **EventSub Subscription Types**
   - URL: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
   - 内容: サブスクリプションタイプと費用計算

4. **App Access Token**
   - URL: https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow
   - 内容: Client Credentials Flowでのトークン取得

### 内部実装ファイル

#### 準備段階（完了）

- `server/src/services/twitchAppAuth.ts` - App Access Token管理
- `server/src/types/conduit.ts` - Conduit型定義
- `server/src/services/twitchConduitClient.ts` - Conduits APIクライアント

#### 既存実装（参考）

- `server/src/services/twitchEventSubManager.ts` - EventSubマネージャー（WebSocketモード）
- `server/src/services/twitchEventSubConnection.ts` - 個別WebSocket接続
- `server/src/types/eventsub.ts` - EventSub型定義

### コミュニティ情報

- Twitch Developer Forums: https://discuss.dev.twitch.tv/
- EventSub関連スレッド: Conduitsの実装事例や問題報告

---

## まとめ

### 実装準備完了項目

- [x] App Access Token管理（自動リフレッシュ、キャッシング）
- [x] Conduits型定義（完全な型安全性）
- [x] Conduits APIクライアント（全CRUD操作）
- [x] 設計ドキュメント（本ドキュメント）

### 次のステップ

1. **監視チャンネル数のモニタリング**
   - 200-300チャンネルに達したらPhase 1開始を検討

2. **Phase 1開始条件**
   - ビジネス要件の確認
   - 開発リソースの確保
   - テスト環境の準備

3. **継続的な情報収集**
   - Twitch公式ドキュメントの更新確認
   - コミュニティでの実装事例収集

### 期待される効果

- **スケーラビリティ**: 900 → 100,000サブスクリプション（111倍）
- **運用負荷**: 手動負荷分散 → Twitchによる自動管理
- **可用性**: 接続単位障害 → シャード単位障害分離
- **将来性**: サービス成長に対応できるインフラ基盤

---

**作成日**: 2025-01-XX
**バージョン**: 1.0
**作成者**: ふくまど！開発チーム
**最終更新**: 準備段階完了
