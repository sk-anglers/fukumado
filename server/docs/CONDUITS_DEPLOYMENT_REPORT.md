# Twitch EventSub Conduits デプロイレポート

**デプロイ日時**: 2025-11-01
**デプロイ環境**: 本番環境 (fukumado.jp)
**デプロイ者**: Claude Code
**デプロイ方式**: Git Push 自動デプロイ

---

## 📋 デプロイサマリー

### デプロイ内容

WebSocketモードからConduitsモードへの切り替え

- **変更前**: WebSocketモード（最大900サブスクリプション）
- **変更後**: Conduitsモード（最大100,000サブスクリプション）

### Gitコミット履歴

```
eddd160 - feat(server): Conduitsモードに切り替え
51d24a5 - docs(server): Conduitsデプロイ手順書とチェックリスト作成
7f93629 - docs(server): Conduitsモード運用ガイド作成
f4cc106 - feat(server): Conduitsエラーハンドリング強化とメトリクス追加
585b3e6 - feat(admin-web): Conduits統計情報表示を追加
```

---

## ✅ 実施した作業

### 1. コード実装（Phase 1 & 2）

#### Phase 1: Conduits動作検証
- ✅ `twitchConduitClient.ts` - Conduits API クライアント実装
- ✅ `twitchConduitManager.ts` - Conduit マネージャー実装
- ✅ `testConduit.ts` - 検証スクリプト作成・実行（100%成功）
- ✅ `testConduitWithWebSocket.ts` - WebSocket統合検証（100%成功）
- ✅ `CONDUITS_VERIFICATION_REPORT.md` - 検証レポート作成

#### Phase 2: 本番環境統合
- ✅ `twitchEventSubManager.ts` - モード切り替え機能実装
- ✅ `metricsCollector.ts` - Conduits関連メトリクス追加
  - `conduit_shard_failures_total`
  - `conduit_websocket_errors_total`
  - `conduit_reconnections_total`
  - `conduit_reconnection_failures_total`
  - `conduit_api_errors_total`

- ✅ エラーハンドリング強化
  - シャード作成リトライロジック（最大3回、指数バックオフ）
  - 自動再接続機能（最大10回）
  - `session_reconnect` メッセージ処理

- ✅ 管理画面実装
  - `EventSub.tsx` - Conduits統計情報表示
  - `EventSub.module.css` - Conduits専用スタイル
  - `index.ts` - 型定義追加（ConduitStats）

### 2. ドキュメント作成

- ✅ `CONDUITS_OPERATION_GUIDE.md` (416行)
  - 概要とアーキテクチャ
  - 環境設定手順
  - 監視とメトリクス
  - エラー対応ガイド
  - FAQ

- ✅ `CONDUITS_DEPLOYMENT.md` (300行以上)
  - デプロイ前の確認項目
  - 詳細なデプロイ手順（Step 1-9）
  - ロールバック手順
  - トラブルシューティング

- ✅ `CONDUITS_CHECKLIST.md` (500行以上)
  - デプロイ前チェックリスト
  - デプロイ後チェックリスト
  - 機能テスト項目
  - 24時間監視項目

### 3. 設定変更

- ✅ `server/.env` - `EVENTSUB_MODE=conduit` 追加
- ✅ `server/.env.example` - 設定例追加

### 4. デプロイ実施

- ✅ Gitコミット: `eddd160`
- ✅ Git Push完了
- ✅ 本番環境への自動デプロイ

---

## 🌐 本番環境情報

### URL一覧

**本番環境:**
- メイン: https://fukumado.jp
- API: https://api.fukumado.jp
- 管理画面: https://admin.fukumado.jp
- 管理API: https://admin-api.fukumado.jp

**ベータ環境:**
- ベータ: https://beta.fukumado.jp
- ベータAPI: https://beta-api.fukumado.jp
- ベータ管理画面: https://beta-admin.fukumado.jp

### デプロイ確認

#### ヘルスチェック（実施済み）

```bash
# API
curl https://api.fukumado.jp/health
# => {"status":"ok","timestamp":"2025-11-01T10:54:39.673Z"}

# 管理API
curl https://admin-api.fukumado.jp/health
# => {"status":"ok","timestamp":"2025-11-01T10:54:38.522Z"}
```

✅ **両方のサーバーが正常に稼働中**

---

## 📊 動作確認手順（ユーザー実施）

### 1. 管理画面での確認

ブラウザで以下にアクセス：

```
https://admin.fukumado.jp/eventsub
```

**確認項目:**

#### ✅ モード表示
- [ ] 「🚀 Conduits」と表示されている
- [ ] サブテキストに「最大100,000サブスクリプション」と表示

#### ✅ Conduit情報カード
- [ ] **Conduit ID**: 英数字のIDが表示されている（nullでない）
- [ ] **総シャード数**: 1 以上
- [ ] **有効シャード数**: 総シャード数と同じ
- [ ] **無効シャード数**: 0
- [ ] **サブスクリプション**: 現在の購読数が表示
- [ ] **使用率**: パーセンテージが表示（小数点3桁）

#### ✅ 説明文
- [ ] 「💡 Conduitsモードでは、Twitchが自動的にシャードを管理します。」
- [ ] 「最大100,000サブスクリプションまで対応可能です。」

### 2. EventSub統計API確認（認証後）

管理画面で認証後、ブラウザの開発者ツール（Network）で以下を確認：

```
GET https://api.fukumado.jp/api/admin/eventsub/stats
```

**期待するレスポンス:**

```json
{
  "success": true,
  "data": {
    "stats": {
      "mode": "conduit",
      "totalSubscriptions": XXX,
      "subscribedChannelCount": XXX,
      "conduitStats": {
        "conduitId": "12345678-abcd-...",
        "totalShards": 1,
        "enabledShards": 1,
        "disabledShards": 0,
        "totalSubscriptions": XXX,
        "usagePercentage": X.XXX
      }
    },
    "capacity": {
      "used": XXX,
      "total": 100000,
      "available": XXXXX,
      "percentage": X.XX
    }
  }
}
```

### 3. イベント受信テスト

既存の監視チャンネルで配信が開始・終了された際に、イベント履歴に記録されることを確認：

```
https://admin.fukumado.jp/eventsub
```

- [ ] イベント履歴セクションに新しいイベントが追加される
- [ ] イベントタイプ: 🟢 配信開始 / 🔴 配信終了
- [ ] 配信者名、タイムスタンプが表示される

### 4. メトリクス確認（24時間監視）

管理画面で定期的に確認：

- [ ] シャード失敗数: 0
- [ ] WebSocketエラー数: 0
- [ ] 再接続失敗数: 0
- [ ] APIエラー数: 0

---

## 🔍 トラブルシューティング

### 問題1: Conduit IDが表示されない

**症状:**
```
conduitId: null
totalShards: 0
```

**対処:**
1. サーバーログを確認
2. App Access Tokenが正しく取得されているか確認
3. 必要に応じてサーバー再起動

### 問題2: シャードが無効（disabled）

**症状:**
```
enabledShards: 0
disabledShards: 1
```

**対処:**
1. サーバーログでエラー確認
2. 自動再接続を待つ（最大10回）
3. 再接続失敗が続く場合、サーバー再起動

### 問題3: イベントが受信できない

**対処:**
1. keepaliveが10秒ごとに受信されているかログ確認
2. サブスクリプション数を確認（0でないこと）
3. WebSocket接続状態を確認

### ロールバック手順

問題が発生した場合、WebSocketモードに戻す：

1. `server/.env` を編集
   ```bash
   EVENTSUB_MODE=websocket
   ```

2. Git コミット・プッシュ
   ```bash
   git add server/.env
   git commit -m "rollback: WebSocketモードに戻す"
   git push
   ```

3. 自動デプロイ後、管理画面で「📡 WebSocket」と表示されることを確認

---

## 📈 期待される効果

### 1. 容量拡大
- **変更前**: 最大900サブスクリプション（〜450チャンネル）
- **変更後**: 最大100,000サブスクリプション（〜50,000チャンネル）

### 2. 安定性向上
- 自動リトライ（シャード作成、再接続）
- 指数バックオフでAPI負荷軽減
- 詳細なメトリクスで問題早期発見

### 3. 運用性向上
- 包括的なドキュメント
- 視覚的な管理画面
- エラー対応ガイド

---

## 📝 次のアクション

### 即時（デプロイ後すぐ）

- [ ] **管理画面確認**: https://admin.fukumado.jp/eventsub
  - モードが「🚀 Conduits」と表示されるか
  - Conduit ID が表示されるか
  - 有効シャード数 = 総シャード数 かつ 無効シャード数 = 0

- [ ] **イベント受信確認**: 配信開始/終了イベントが記録されるか

### 1時間後

- [ ] メトリクス確認（全エラー = 0）
- [ ] シャード状態確認（enabledShards維持）

### 6時間後

- [ ] イベント履歴に新しいイベントが記録されているか
- [ ] サブスクリプション数が安定しているか

### 24時間後

- [ ] 全エラーメトリクスが0または低い値
- [ ] サーバーメモリ使用量が正常範囲内
- [ ] イベント受信が継続的に動作

### 問題発生時

- [ ] ドキュメント参照:
  - 運用ガイド: `server/docs/CONDUITS_OPERATION_GUIDE.md`
  - デプロイ手順: `server/docs/CONDUITS_DEPLOYMENT.md`
  - チェックリスト: `server/docs/CONDUITS_CHECKLIST.md`

- [ ] 必要に応じてロールバック（WebSocketモードに戻す）

---

## 🎯 成功基準

以下のすべてを満たせば、デプロイ成功とします：

- [x] Gitコミット・プッシュ完了
- [x] サーバーヘルスチェック正常
- [ ] 管理画面で「🚀 Conduits」と表示
- [ ] Conduit ID が表示されている
- [ ] 有効シャード数 ≥ 1、無効シャード数 = 0
- [ ] イベント受信が正常に動作
- [ ] 全エラーメトリクスが0（24時間後）

---

## 📚 参考資料

### ドキュメント
- 運用ガイド: `server/docs/CONDUITS_OPERATION_GUIDE.md`
- デプロイ手順: `server/docs/CONDUITS_DEPLOYMENT.md`
- 動作確認チェックリスト: `server/docs/CONDUITS_CHECKLIST.md`
- 検証レポート: `server/docs/CONDUITS_VERIFICATION_REPORT.md`

### Twitch公式ドキュメント
- EventSub Conduits: https://dev.twitch.tv/docs/eventsub/handling-conduit-events/
- EventSub API: https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription

---

## ✅ デプロイ完了

**ステータス**: 🚀 **デプロイ完了（動作確認待ち）**

**次のステップ**: 管理画面で動作確認を実施してください

```
https://admin.fukumado.jp/eventsub
```

確認後、結果を報告いただければ、必要に応じて追加サポートを提供します。

---

**デプロイ実施日**: 2025-11-01
**最終更新**: 2025-11-01 19:55 JST
**バージョン**: 1.0.0
