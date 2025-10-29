# ふくまど (Fukumado) デプロイガイド

## 📋 デプロイ構成

| サービス | ドメイン | 説明 |
|---------|---------|------|
| **web** | `fukumado.jp` / `www.fukumado.jp` | メインクライアント |
| **server** | `api.fukumado.jp` | メインバックエンドAPI |
| **admin-web** | `admin.fukumado.jp` | 管理ダッシュボード |
| **admin-server** | `admin-api.fukumado.jp` | 管理バックエンドAPI |
| **redis** | 内部接続 | キャッシュ・セッション管理 |

---

## 🚀 デプロイ手順

### ステップ1: GitHubにプッシュ

```bash
cd C:\Users\s_kus\開発
git add .
git commit -m "Add Render deployment configuration with fukumado.jp domain"
git push origin main
```

### ステップ2: Renderでブループリントをデプロイ

1. https://dashboard.render.com にアクセス
2. **"New"** → **"Blueprint"** をクリック
3. GitHubリポジトリを接続
4. `render.yaml` が自動検出される
5. **"Apply"** をクリック

### ステップ3: DNS設定

ドメインレジストラ（お名前.comなど）でDNSレコードを設定：

#### Aレコード設定

| タイプ | ホスト名 | 値 |
|-------|---------|---|
| A | `@` | Renderから提供されるIPアドレス |
| A | `www` | Renderから提供されるIPアドレス |
| A | `admin` | Renderから提供されるIPアドレス |

#### CNAMEレコード設定（推奨）

| タイプ | ホスト名 | 値 |
|-------|---------|---|
| CNAME | `api` | `fukumado-server.onrender.com` |
| CNAME | `admin-api` | `fukumado-admin-server.onrender.com` |

**Renderダッシュボードで確認**：
- 各サービスの "Settings" → "Custom Domains" で提供されるDNS情報を使用

### ステップ4: 環境変数を設定

Renderダッシュボードで各サービスの環境変数を設定：

#### **fukumado-server**

| 変数名 | 値 | 説明 |
|-------|---|------|
| `YOUTUBE_API_KEY` | `[YOUR_KEY]` | YouTube Data API v3 キー |
| `YOUTUBE_CLIENT_ID` | `[YOUR_CLIENT_ID]` | Google OAuth クライアントID |
| `YOUTUBE_CLIENT_SECRET` | `[YOUR_SECRET]` | Google OAuth クライアントシークレット |
| `TWITCH_CLIENT_ID` | `[YOUR_CLIENT_ID]` | Twitch OAuth クライアントID |
| `TWITCH_CLIENT_SECRET` | `[YOUR_SECRET]` | Twitch OAuth クライアントシークレット |

**その他の環境変数は自動設定されます**

#### **fukumado-admin-server**

| 変数名 | 値 | 説明 |
|-------|---|------|
| `ADMIN_PASSWORD` | `[STRONG_PASSWORD]` | 管理ダッシュボードのパスワード（16文字以上） |

**その他の環境変数は自動設定されます**

### ステップ5: OAuth リダイレクトURLを登録

#### Google Cloud Console

1. https://console.cloud.google.com/apis/credentials にアクセス
2. OAuth 2.0 クライアントIDを選択
3. **承認済みのリダイレクトURI** に追加：
   ```
   https://api.fukumado.jp/auth/google/callback
   ```

#### Twitch Developer Console

1. https://dev.twitch.tv/console/apps にアクセス
2. アプリケーションを選択
3. **OAuth Redirect URLs** に追加：
   ```
   https://api.fukumado.jp/auth/twitch/callback
   ```

---

## 🔍 デプロイ後の確認

### ヘルスチェック

各サービスが正常に動作しているか確認：

```bash
# Server
curl https://api.fukumado.jp/health

# Admin Server
curl https://admin-api.fukumado.jp/health
```

期待される応答：
```json
{"status":"ok","timestamp":"2025-10-29T..."}
```

### サービスアクセス確認

| サービス | URL | 確認内容 |
|---------|-----|---------|
| クライアント | https://fukumado.jp | ページが表示される |
| 管理画面 | https://admin.fukumado.jp | ログイン画面が表示される |
| API | https://api.fukumado.jp/health | ヘルスチェックが成功 |
| 管理API | https://admin-api.fukumado.jp/health | ヘルスチェックが成功 |

---

## 🐛 トラブルシューティング

### DNS設定が反映されない

- DNS伝播には最大48時間かかる場合があります
- `nslookup fukumado.jp` で確認
- Renderダッシュボードで "Verify DNS" をクリック

### CORS エラーが発生する

- ブラウザのコンソールでエラー内容を確認
- サーバーログで許可されたオリジンを確認
- 必要に応じて `server/src/index.ts` の `allowedOrigins` を更新

### OAuth 認証エラー

- Google/Twitch Developer Console でリダイレクトURIが正しく設定されているか確認
- 環境変数 `YOUTUBE_REDIRECT_URI` / `TWITCH_REDIRECT_URI` が正しいか確認

### WebSocket 接続エラー

- `wss://admin-api.fukumado.jp` への接続が可能か確認
- ブラウザのネットワークタブで WebSocket の状態を確認
- Renderのファイアウォール設定を確認

---

## 📊 モニタリング

### Renderダッシュボード

- 各サービスのログを確認
- メトリクス（CPU、メモリ使用量）を確認
- デプロイ履歴を確認

### 管理ダッシュボード

- https://admin.fukumado.jp にアクセス
- ユーザー名: `admin`
- パスワード: 環境変数で設定した `ADMIN_PASSWORD`

---

## 🔄 更新手順

### コード更新

```bash
git add .
git commit -m "Update description"
git push origin main
```

Renderが自動的に再デプロイします。

### 環境変数更新

1. Renderダッシュボード → サービス選択
2. "Environment" タブ
3. 変数を更新
4. "Save Changes" → 自動的に再デプロイ

---

## 📝 チェックリスト

- [ ] GitHubにプッシュ済み
- [ ] Renderでブループリント適用済み
- [ ] DNS設定完了（A/CNAMEレコード）
- [ ] 環境変数設定完了（YOUTUBE_*, TWITCH_*, ADMIN_PASSWORD）
- [ ] OAuth リダイレクトURL登録完了（Google + Twitch）
- [ ] 全サービスのヘルスチェック成功
- [ ] クライアント（fukumado.jp）アクセス確認
- [ ] 管理画面（admin.fukumado.jp）ログイン確認

---

## 🎉 完了！

すべてのチェックが完了したら、デプロイ完了です。

**サポートが必要な場合**: Renderのログを確認するか、開発チームに連絡してください。
