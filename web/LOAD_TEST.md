# 負荷テスト実施手順

## 事前準備

### 1. k6のインストール

#### Windows
```powershell
choco install k6
```

または、[公式サイト](https://k6.io/docs/get-started/installation/)からインストーラーをダウンロード

#### macOS
```bash
brew install k6
```

#### Linux
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### 2. インストール確認
```bash
k6 version
```

## 負荷テストの実行

### フル負荷テスト（約19分）
デフォルト設定でフルテストを実行：
```bash
k6 run load-test.js
```

#### テストシナリオ
- **0-2分**: ウォームアップ（10ユーザー）
- **2-7分**: 負荷増加（50ユーザー）
- **7-12分**: 持続負荷（50ユーザー維持）
- **12-14分**: ピーク負荷（100ユーザー）
- **14-17分**: ピーク維持（100ユーザー維持）
- **17-19分**: クールダウン（0ユーザー）

### 軽負荷テスト（短時間）
最小限の負荷で動作確認：
```bash
k6 run --vus 10 --duration 3m load-test.js
```

### カスタム負荷テスト
同時ユーザー数と期間を指定：
```bash
# 50ユーザーで5分間
k6 run --vus 50 --duration 5m load-test.js

# 100ユーザーで10分間
k6 run --vus 100 --duration 10m load-test.js
```

### 段階的負荷テスト
```bash
# ステージ1: 軽負荷（10ユーザー、5分）
k6 run --vus 10 --duration 5m load-test.js

# ステージ2: 中負荷（50ユーザー、10分）
k6 run --vus 50 --duration 10m load-test.js

# ステージ3: 高負荷（100ユーザー、5分）
k6 run --vus 100 --duration 5m load-test.js
```

## テスト結果の確認

### リアルタイム出力
テスト実行中、コンソールに以下が表示されます：
- 現在のVU（仮想ユーザー数）
- 完了したリクエスト数
- リクエスト/秒
- 平均レスポンス時間
- エラー率

### サマリーファイル
テスト完了後、`load-test-summary.json`に詳細な結果が保存されます。

### 主要メトリクス

#### 成功基準
- ✅ **http_req_duration (p95)**: < 3000ms（95%のリクエストが3秒以内）
- ✅ **http_req_failed**: < 5%（エラー率5%未満）
- ✅ **errors**: < 5%（カスタムエラー率5%未満）

#### 確認項目
1. **ページ読み込み時間**: フロントエンドの応答速度
2. **API応答時間**: バックエンドAPIの性能
3. **エラー率**: システムの安定性
4. **スループット**: 処理できるリクエスト数/秒

## 監視するべき項目

### Renderダッシュボード
1. **CPU使用率**: 80%以下が理想
2. **メモリ使用率**: 限界に達していないか
3. **レスポンスタイム**: 平均応答時間の推移
4. **エラー率**: 5xx/4xxエラーの発生状況

### 外部API
1. **Twitch API**: レート制限（800リクエスト/分）
2. **YouTube API**: クォータ制限（10,000ユニット/日）

## トラブルシューティング

### エラー率が高い場合
```bash
# より詳細なログを表示
k6 run --http-debug load-test.js
```

### レスポンスタイムが遅い場合
- Renderのインスタンスタイプを確認
- データベース（あれば）のパフォーマンスを確認
- 外部API（Twitch/YouTube）の応答時間を確認

### メモリ不足エラー
- Renderのメモリ使用量を確認
- インスタンスのアップグレードを検討

## 推奨テストスケジュール

### デプロイ前
```bash
# 1. 軽負荷テスト（動作確認）
k6 run --vus 10 --duration 3m load-test.js

# 2. 結果を確認後、中負荷テスト
k6 run --vus 50 --duration 5m load-test.js

# 3. 問題がなければフルテスト
k6 run load-test.js
```

### 定期テスト（週1回推奨）
```bash
# 毎週同じ条件でテストして性能劣化を検知
k6 run --vus 50 --duration 10m load-test.js
```

## 結果の記録

以下のテンプレートで結果を記録することを推奨：

```
日時: 2025-11-02 14:00
テスト条件: 50ユーザー × 10分
結果:
  - 総リクエスト数:
  - リクエスト/秒:
  - 平均レスポンスタイム:
  - P95レスポンスタイム:
  - エラー率:
  - CPU使用率（ピーク）:
  - メモリ使用率（ピーク）:
備考:
```

## Cloud K6（オプション）

より高度な負荷テストが必要な場合、K6 Cloudを使用できます：

```bash
# K6 Cloudにログイン
k6 login cloud

# クラウドで実行
k6 cloud load-test.js
```

メリット：
- 複数リージョンから負荷をかけられる
- より多くの仮想ユーザーを使用可能
- 詳細なグラフとレポート
- チームでの結果共有

## 参考資料

- [K6公式ドキュメント](https://k6.io/docs/)
- [K6負荷テストのベストプラクティス](https://k6.io/docs/testing-guides/running-large-tests/)
- [Renderのパフォーマンス最適化](https://render.com/docs/performance)
