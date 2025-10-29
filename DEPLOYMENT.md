# ふくまど (Fukumado) デプロイガイド

## 📚 目次

1. [デプロイ構成](#-デプロイ構成)
2. [デプロイ手順](#-デプロイ手順)
   - [前提条件](#前提条件)
   - [ステップ1: GitHubリポジトリの準備](#ステップ1-githubリポジトリの準備)
   - [ステップ2: Renderアカウントのセットアップ](#ステップ2-renderアカウントのセットアップ)
   - [ステップ3: Renderでブループリントをデプロイ](#ステップ3-renderでブループリントをデプロイ)
   - [ステップ4: DNS設定](#ステップ4-dns設定)
   - [ステップ5: 環境変数を設定](#ステップ5-環境変数を設定)
   - [ステップ6: デプロイの完了確認](#ステップ6-デプロイの完了確認)
3. [トラブルシューティング](#-トラブルシューティング)
4. [モニタリング](#-モニタリング)
5. [更新手順](#-更新手順)
6. [ベータ環境の使い方](#-ベータ環境の使い方)
7. [チェックリスト](#-チェックリスト)

---

## 📋 デプロイ構成

### 本番環境 (Production)

| サービス | ドメイン | 説明 |
|---------|---------|------|
| **web** | `fukumado.jp` / `www.fukumado.jp` | メインクライアント |
| **server** | `api.fukumado.jp` | メインバックエンドAPI |
| **admin-web** | `admin.fukumado.jp` | 管理ダッシュボード |
| **admin-server** | `admin-api.fukumado.jp` | 管理バックエンドAPI |
| **redis** | 内部接続 | キャッシュ・セッション管理 |

### ベータ環境 (Beta)

| サービス | ドメイン | 説明 |
|---------|---------|------|
| **web-beta** | `beta.fukumado.jp` | ベータクライアント |
| **server-beta** | `beta-api.fukumado.jp` | ベータバックエンドAPI |
| **admin-web-beta** | `beta-admin.fukumado.jp` | ベータ管理ダッシュボード |
| **admin-server-beta** | `beta-admin-api.fukumado.jp` | ベータ管理バックエンドAPI |
| **redis-beta** | 内部接続 | ベータ用キャッシュ・セッション管理 |

---

## 🚀 デプロイ手順

### 前提条件

デプロイを開始する前に、以下が準備できていることを確認してください：

- ✅ GitHubアカウント
- ✅ Renderアカウント（無料で作成可能）
- ✅ fukumado.jp ドメイン取得済み
- ✅ YouTube API キー（Google Cloud Console）
- ✅ Twitch アプリケーション登録済み

---

### ステップ1: GitHubリポジトリの準備

#### 1-1. GitHubで新規リポジトリを作成

1. https://github.com にアクセスしてログイン
2. 右上の **"+"** ボタン → **"New repository"** をクリック
3. リポジトリ情報を入力：
   - **Repository name**: `fukumado` (任意の名前)
   - **Description**: `ふくまど - マルチプラットフォーム配信同期サービス`
   - **Visibility**: `Private` を選択（推奨）
4. **"Create repository"** をクリック

#### 1-2. ローカルリポジトリを初期化してプッシュ

```bash
# プロジェクトディレクトリに移動
cd C:\Users\s_kus\開発

# Gitリポジトリを初期化（まだの場合）
git init

# すべてのファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit: Add Render deployment configuration with fukumado.jp domain"

# GitHubリポジトリをリモートに追加（YOUR_USERNAMEを実際のユーザー名に変更）
git remote add origin https://github.com/YOUR_USERNAME/fukumado.git

# mainブランチにプッシュ
git branch -M main
git push -u origin main
```

**⚠️ 注意**: `.env` ファイルは `.gitignore` に含めて、GitHubにプッシュしないでください。

---

### ステップ2: Renderアカウントのセットアップ

#### 2-1. Renderアカウントを作成

1. https://render.com にアクセス
2. 右上の **"Get Started"** または **"Sign Up"** をクリック
3. **"Sign up with GitHub"** を選択（推奨）
4. GitHubアカウントで認証

#### 2-2. GitHub連携を確認

1. Renderダッシュボードにログイン後、左サイドバーの **"Account Settings"** をクリック
2. **"GitHub"** タブを選択
3. **"Connect GitHub Account"** がまだの場合は連携
4. リポジトリへのアクセス権限を付与

---

### ステップ3: Renderでブループリントをデプロイ

#### 3-1. 新規ブループリントを作成

1. https://dashboard.render.com にアクセス
2. 左上の **"New +"** ボタンをクリック
3. ドロップダウンメニューから **"Blueprint"** を選択

#### 3-2. GitHubリポジトリを接続

1. **"Connect a repository"** セクションで以下を実行：
   - **"GitHub"** タブを選択
   - 検索ボックスに `fukumado` と入力
   - 作成したリポジトリを選択して **"Connect"** をクリック

#### 3-3. ブループリント設定を確認

1. **"Blueprint Name"** を入力: `fukumado` (任意)
2. **"Branch"** を選択: `main` (本番環境用)
3. **"Blueprint file"** が自動検出されていることを確認:
   - `render.yaml` が表示されているはずです
4. **サービス一覧を確認**（10サービスが表示されるはず）:
   - ✅ fukumado-redis (Redis)
   - ✅ fukumado-server (Web Service)
   - ✅ fukumado-admin-server (Web Service)
   - ✅ fukumado-web (Static Site)
   - ✅ fukumado-admin-web (Static Site)
   - ✅ fukumado-redis-beta (Redis)
   - ✅ fukumado-server-beta (Web Service)
   - ✅ fukumado-admin-server-beta (Web Service)
   - ✅ fukumado-web-beta (Static Site)
   - ✅ fukumado-admin-web-beta (Static Site)

#### 3-4. ブループリントを適用

1. 画面下部の **"Apply"** ボタンをクリック
2. デプロイが開始されます（初回は5〜10分かかります）
3. 各サービスのビルドログを確認可能

**⚠️ 注意**: 初回デプロイ時、環境変数が未設定のためエラーが発生する可能性があります。次のステップで環境変数を設定後、再デプロイされます。

---

### ステップ4: DNS設定

#### 4-1. Renderから提供されるDNS情報を確認

各サービスのカスタムドメイン設定から、必要なDNS情報を取得します：

1. Renderダッシュボードで任意のサービス（例: `fukumado-web`）をクリック
2. 左サイドバーの **"Settings"** をクリック
3. **"Custom Domains"** セクションまでスクロール
4. 設定したいドメイン（例: `fukumado.jp`）の右側に表示される **DNS設定情報** を確認
   - **A レコード**: IPアドレスが表示されます
   - **CNAME レコード**: `○○○.onrender.com` が表示されます

#### 4-2. ドメインレジストラでDNSレコードを設定

ドメインレジストラ（お名前.comなど）の管理画面でDNSレコードを設定：

#### 本番環境 - Aレコード設定

| タイプ | ホスト名 | 値 |
|-------|---------|---|
| A | `@` | Renderから提供されるIPアドレス |
| A | `www` | Renderから提供されるIPアドレス |
| A | `admin` | Renderから提供されるIPアドレス |

#### 本番環境 - CNAMEレコード設定（推奨）

| タイプ | ホスト名 | 値 |
|-------|---------|---|
| CNAME | `api` | `fukumado-server.onrender.com` |
| CNAME | `admin-api` | `fukumado-admin-server.onrender.com` |

#### ベータ環境 - Aレコード設定

| タイプ | ホスト名 | 値 |
|-------|---------|---|
| A | `beta` | Renderから提供されるIPアドレス |
| A | `beta-admin` | Renderから提供されるIPアドレス |

#### ベータ環境 - CNAMEレコード設定（推奨）

| タイプ | ホスト名 | 値 |
|-------|---------|---|
| CNAME | `beta-api` | `fukumado-server-beta.onrender.com` |
| CNAME | `beta-admin-api` | `fukumado-admin-server-beta.onrender.com` |

#### 4-3. DNS設定の反映を確認

DNSレコードの設定後、Renderで検証を実行：

1. 各サービスの **"Custom Domains"** セクションに戻る
2. ドメインの横に表示される **"Verify DNS"** ボタンをクリック
3. ステータスが **"Verified"** に変わるまで待機（最大48時間）

**⚠️ 注意**: DNS伝播には通常数分〜数時間かかります。`nslookup fukumado.jp` コマンドで確認可能です。

---

### ステップ5: 環境変数を設定

#### 5-1. YouTube API キーの取得（まだの場合）

1. https://console.cloud.google.com にアクセス
2. プロジェクトを選択または新規作成
3. **"APIとサービス"** → **"認証情報"** をクリック
4. **"認証情報を作成"** → **"APIキー"** を選択
5. 作成されたAPIキーをコピー
6. **"YouTube Data API v3"** を有効化

#### 5-2. Google OAuth クライアントID/シークレットの取得

1. 同じ画面で **"認証情報を作成"** → **"OAuth クライアント ID"** を選択
2. アプリケーションの種類: **"ウェブ アプリケーション"** を選択
3. 名前: `Fukumado Production` (任意)
4. **承認済みのリダイレクトURI**:
   ```
   https://api.fukumado.jp/auth/google/callback
   ```
5. **"作成"** をクリック
6. 表示される **クライアントID** と **クライアントシークレット** をコピー

#### 5-3. Twitch アプリケーションの登録

1. https://dev.twitch.tv/console/apps にアクセス
2. **"Register Your Application"** をクリック
3. アプリケーション情報を入力：
   - **Name**: `Fukumado Production`
   - **OAuth Redirect URLs**: `https://api.fukumado.jp/auth/twitch/callback`
   - **Category**: `Website Integration`
4. **"Create"** をクリック
5. 作成したアプリケーションの **"Manage"** をクリック
6. **Client ID** と **New Secret** ボタンで生成した **Client Secret** をコピー

#### 5-4. Renderで環境変数を設定

##### 本番環境: fukumado-server

1. Renderダッシュボードで **fukumado-server** サービスをクリック
2. 左サイドバーの **"Environment"** をクリック
3. 以下の環境変数を **"Add Environment Variable"** で追加：

| 変数名 | 値 | 説明 |
|-------|---|------|
| `YOUTUBE_API_KEY` | `[5-1でコピーしたキー]` | YouTube Data API v3 キー |
| `YOUTUBE_CLIENT_ID` | `[5-2でコピーしたID]` | Google OAuth クライアントID |
| `YOUTUBE_CLIENT_SECRET` | `[5-2でコピーしたシークレット]` | Google OAuth クライアントシークレット |
| `TWITCH_CLIENT_ID` | `[5-3でコピーしたID]` | Twitch OAuth クライアントID |
| `TWITCH_CLIENT_SECRET` | `[5-3でコピーしたシークレット]` | Twitch OAuth クライアントシークレット |

4. **"Save Changes"** をクリック → 自動的に再デプロイが開始されます

**✅ 自動設定される環境変数**（設定不要）:
- `PORT`, `NODE_ENV`, `SESSION_SECRET`, `REDIS_URL`, `YOUTUBE_REDIRECT_URI`, `TWITCH_REDIRECT_URI`

##### 本番環境: fukumado-admin-server

1. Renderダッシュボードで **fukumado-admin-server** サービスをクリック
2. 左サイドバーの **"Environment"** をクリック
3. 以下の環境変数を追加：

| 変数名 | 値 | 説明 |
|-------|---|------|
| `ADMIN_PASSWORD` | `[強力なパスワード]` | 管理ダッシュボードのパスワード（16文字以上推奨） |

**💡 ヒント**: パスワード生成は https://passwordsgenerator.net/ などを利用

4. **"Save Changes"** をクリック

##### ベータ環境の環境変数設定

ベータ環境（`fukumado-server-beta`, `fukumado-admin-server-beta`）にも同じ手順で環境変数を設定します。

**⚠️ 重要**: ベータ環境用に別のOAuthアプリケーションを作成することを推奨（リダイレクトURIが異なるため）

---

### ステップ6: デプロイの完了確認

#### 6-1. サービスのデプロイ状況を確認

1. Renderダッシュボードに戻る
2. すべてのサービス（10個）のステータスが **"Live"**（緑色）になっていることを確認
3. エラーがある場合は、各サービスの **"Logs"** タブでエラー内容を確認

#### 6-2. ヘルスチェックを実行

ターミナルまたはブラウザで各エンドポイントにアクセスして確認：

**本番環境**:
```bash
curl https://api.fukumado.jp/health
curl https://admin-api.fukumado.jp/health
```

**ベータ環境**:
```bash
curl https://beta-api.fukumado.jp/health
curl https://beta-admin-api.fukumado.jp/health
```

**期待される応答**:
```json
{"status":"ok","timestamp":"2025-10-29T..."}
```

#### 6-3. フロントエンドにアクセス

ブラウザで以下のURLにアクセスして、ページが正しく表示されることを確認：

- ✅ https://fukumado.jp （本番クライアント）
- ✅ https://admin.fukumado.jp （本番管理画面）
- ✅ https://beta.fukumado.jp （ベータクライアント）
- ✅ https://beta-admin.fukumado.jp （ベータ管理画面）

#### 6-4. 管理画面にログイン

1. https://admin.fukumado.jp にアクセス
2. ユーザー名: `admin`
3. パスワード: ステップ5-4で設定した `ADMIN_PASSWORD`
4. ログインが成功し、ダッシュボードが表示されることを確認

---

## 🐛 トラブルシューティング

### サービスがデプロイに失敗する

#### 症状
Renderダッシュボードでサービスのステータスが **"Deploy failed"**（赤色）になる

#### 原因と解決方法

**1. ビルドエラー**
```bash
# Logsタブで以下のようなエラーを確認
Error: Cannot find module 'express'
```
- **解決**: `package.json` に必要な依存関係が含まれているか確認
- `render.yaml` の `buildCommand` が正しいか確認

**2. 環境変数が未設定**
```bash
Error: YOUTUBE_API_KEY is required
```
- **解決**: ステップ5-4を参照して、必要な環境変数を設定

**3. ポート設定エラー**
```bash
Error: listen EADDRINUSE: address already in use :::4000
```
- **解決**: `render.yaml` と実際のコードで `PORT` 環境変数が正しく使用されているか確認

---

### DNS設定が反映されない

#### 症状
カスタムドメインにアクセスすると "DNS_PROBE_FINISHED_NXDOMAIN" エラー

#### 原因と解決方法

**1. DNS伝播待ち**
- **確認方法**: `nslookup fukumado.jp` または https://dnschecker.org で確認
- **解決**: 最大48時間待機（通常は数分〜数時間）

**2. DNSレコードの設定ミス**
- **確認方法**: ドメインレジストラの管理画面でレコードを再確認
- **解決**: ステップ4-2を参照して、正しいレコードを設定

**3. Renderでドメイン未検証**
- **確認方法**: Renderの "Custom Domains" で "Unverified" ステータス
- **解決**: "Verify DNS" ボタンをクリック

---

### CORS エラーが発生する

#### 症状
ブラウザコンソールに以下のエラー:
```
Access to fetch at 'https://api.fukumado.jp/...' from origin 'https://fukumado.jp'
has been blocked by CORS policy
```

#### 原因と解決方法

**1. 本番URLが `allowedOrigins` に含まれていない**
- **確認**: `server/src/index.ts` の `allowedOrigins` 配列を確認
- **解決**: 必要なオリジンを追加（例: `https://fukumado.jp`）

**2. 環境変数 `NODE_ENV` が `production` でない**
- **確認**: Renderの "Environment" タブで `NODE_ENV=production` を確認
- **解決**: `render.yaml` で自動設定されているはずですが、手動で追加可能

---

### OAuth 認証エラー

#### 症状
YouTubeまたはTwitchログインボタンをクリックすると:
```
redirect_uri_mismatch
```

#### 原因と解決方法

**1. リダイレクトURIが登録されていない**
- **Google**: https://console.cloud.google.com/apis/credentials で確認
  - 承認済みのリダイレクトURI: `https://api.fukumado.jp/auth/google/callback`
- **Twitch**: https://dev.twitch.tv/console/apps で確認
  - OAuth Redirect URLs: `https://api.fukumado.jp/auth/twitch/callback`

**2. 環境変数が間違っている**
- **確認**: Renderの "Environment" タブで以下を確認:
  - `YOUTUBE_REDIRECT_URI=https://api.fukumado.jp/auth/google/callback`
  - `TWITCH_REDIRECT_URI=https://api.fukumado.jp/auth/twitch/callback`

---

### WebSocket 接続エラー

#### 症状
管理画面でリアルタイムデータが更新されない

#### 原因と解決方法

**1. WebSocketエンドポイントが間違っている**
- **確認**: `admin-web/.env` または `render.yaml` で `VITE_ADMIN_WS_URL` を確認
- **正しい値**: `wss://admin-api.fukumado.jp` (httpsではなくwss)

**2. ブラウザでWebSocketがブロックされている**
- **確認**: ブラウザのネットワークタブで WebSocket の状態を確認
- **解決**: HTTPS証明書が正しく設定されているか確認（RenderではLet's Encryptを自動使用）

---

### ビルド時のメモリ不足エラー

#### 症状
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

#### 原因と解決方法

**1. Renderの無料プランのメモリ制限**
- **解決**: `render.yaml` の各サービスで `plan: starter` を有料プランに変更
  ```yaml
  plan: standard  # 2GB RAM
  ```

**2. ビルドコマンドの最適化**
- **解決**: `NODE_OPTIONS` を追加
  ```yaml
  envVars:
    - key: NODE_OPTIONS
      value: --max-old-space-size=2048
  ```

---

### Redisに接続できない

#### 症状
```
Error: Redis connection failed
```

#### 原因と解決方法

**1. REDIS_URLが設定されていない**
- **確認**: Renderの "Environment" タブで `REDIS_URL` を確認
- **解決**: `render.yaml` で `fromDatabase` 設定が正しいか確認

**2. Redisサービスが起動していない**
- **確認**: Renderダッシュボードで `fukumado-redis` のステータス確認
- **解決**: Redisサービスが "Live" になるまで待機

---

### ログの確認方法

Renderでは各サービスの詳細なログを確認できます:

1. Renderダッシュボードで対象サービスをクリック
2. 左サイドバーの **"Logs"** をクリック
3. リアルタイムログまたは過去のログを確認
4. 検索ボックスでキーワード検索（例: "error", "failed"）

**よく使うログフィルター**:
- `error` - エラーメッセージのみ表示
- `warn` - 警告メッセージ
- `[Server]` - サーバー起動関連のログ

---

## 📊 モニタリング

### Renderダッシュボードでのモニタリング

#### 1. サービスメトリクスの確認

各サービスの詳細ページで以下を確認できます：

1. **CPU使用率**: サービスの負荷状況を確認
2. **メモリ使用量**: メモリリークや不足を検出
3. **リクエスト数**: トラフィックの推移を確認
4. **応答時間**: パフォーマンスの監視

**確認方法**:
- Renderダッシュボード → サービス選択 → **"Metrics"** タブ

#### 2. リアルタイムログ監視

```bash
# 特定のサービスのログを監視
1. Renderダッシュボード → サービス選択
2. "Logs" タブをクリック
3. 画面下部の検索ボックスでフィルタリング
```

**重要なログパターン**:
- `[Server] Listening on` - サーバー起動成功
- `ERROR` - エラー発生
- `WARN` - 警告メッセージ
- `[Redis] Connected` - Redis接続成功

#### 3. デプロイ履歴の確認

過去のデプロイ状況を確認：

1. サービス詳細ページ → **"Events"** タブ
2. デプロイ日時、コミットハッシュ、ステータスを確認
3. 問題があれば過去のバージョンにロールバック可能

### 管理ダッシュボードでのモニタリング

ふくまど専用の管理ダッシュボードで詳細な情報を確認：

#### アクセス方法

1. https://admin.fukumado.jp にアクセス
2. ログイン情報:
   - **ユーザー名**: `admin`
   - **パスワード**: 環境変数で設定した `ADMIN_PASSWORD`

#### 監視できる項目

- ✅ **システム状態**: CPU、メモリ、稼働時間
- ✅ **API状態**: Twitch/YouTube API使用率
- ✅ **WebSocket接続数**: リアルタイム接続数
- ✅ **配信同期数**: 同期中の配信数
- ✅ **API呼び出し統計**: 総呼び出し、成功、失敗のグラフ
- ✅ **セキュリティ概要**: ブロック中のIP、疑わしいIP

---

## 🔄 更新手順

### コード更新（自動デプロイ）

Renderは `main` ブランチへのプッシュを検知して自動デプロイします。

#### 本番環境へのデプロイ

```bash
# 変更をコミット
git add .
git commit -m "Fix: Update authentication logic"
git push origin main
```

1. GitHubにプッシュ
2. Renderが自動的に変更を検知
3. ビルドとデプロイが開始（5〜10分）
4. デプロイ完了後、自動的に新バージョンに切り替わる

#### ベータ環境での事前テスト（推奨）

```bash
# ベータブランチにプッシュ
git checkout -b feature/new-feature
git add .
git commit -m "Add: New feature"
git push origin feature/new-feature
```

1. Renderダッシュボードでベータサービスのブランチを変更
   - `fukumado-server-beta` → "Settings" → "Branch" → `feature/new-feature`
2. ベータ環境でテスト
3. 問題なければ本番にマージ:
   ```bash
   git checkout main
   git merge feature/new-feature
   git push origin main
   ```

### 環境変数の更新

環境変数を変更すると自動的に再デプロイされます。

1. Renderダッシュボード → 対象サービスを選択
2. 左サイドバーの **"Environment"** をクリック
3. 変更したい変数を編集または新規追加
4. **"Save Changes"** をクリック
5. 自動的に再デプロイが開始

**⚠️ 注意**: 本番環境の環境変数変更は慎重に行ってください。

### 手動デプロイ

自動デプロイを無効にしている場合、または強制的に再デプロイしたい場合：

1. Renderダッシュボード → 対象サービスを選択
2. 右上の **"Manual Deploy"** → **"Deploy latest commit"** をクリック
3. デプロイが開始

### ロールバック（以前のバージョンに戻す）

問題が発生した場合、過去のデプロイに戻すことができます：

1. Renderダッシュボード → 対象サービスを選択
2. 左サイドバーの **"Events"** をクリック
3. 戻したいデプロイの横にある **"Rollback"** ボタンをクリック
4. 確認ダイアログで **"Rollback"** をクリック

**💡 ヒント**: ロールバックは数秒で完了しますが、データベース変更は戻りません。

---

## 📝 チェックリスト

### 本番環境 (Production)

- [ ] GitHubにプッシュ済み
- [ ] Renderでブループリント適用済み
- [ ] DNS設定完了（A/CNAMEレコード）
- [ ] 環境変数設定完了（YOUTUBE_*, TWITCH_*, ADMIN_PASSWORD）
- [ ] OAuth リダイレクトURL登録完了（Google + Twitch）
- [ ] 全サービスのヘルスチェック成功
- [ ] クライアント（fukumado.jp）アクセス確認
- [ ] 管理画面（admin.fukumado.jp）ログイン確認

### ベータ環境 (Beta)

- [ ] GitHubにプッシュ済み
- [ ] Renderでブループリント適用済み
- [ ] DNS設定完了（ベータドメイン用A/CNAMEレコード）
- [ ] 環境変数設定完了（YOUTUBE_*, TWITCH_*, ADMIN_PASSWORD）
- [ ] OAuth リダイレクトURL登録完了（ベータ用コールバックURL）
- [ ] 全サービスのヘルスチェック成功
- [ ] クライアント（beta.fukumado.jp）アクセス確認
- [ ] 管理画面（beta-admin.fukumado.jp）ログイン確認

---

## 🧪 ベータ環境の使い方

### ベータ環境とは？

ベータ環境は本番環境と完全に分離された独立環境です。新機能の開発やテストを本番に影響を与えずに行うことができます。

### ベータ環境の特徴

✅ **完全分離**
- 本番環境と独立したRedisインスタンス
- 本番データに一切影響を与えない
- 独自のOAuthコールバックURL

✅ **本番同等の環境**
- 本番と同じコード構成
- 本番と同じデプロイフロー
- 本番と同じドメイン構造 (beta.fukumado.jp)

### ベータ環境での開発フロー

1. **ブランチ作成**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **コード変更**
   - 新機能の実装
   - バグ修正
   - パフォーマンス改善

3. **ベータ環境にデプロイ**
   ```bash
   git push origin feature/new-feature
   ```
   - Renderダッシュボードでベータサービスのブランチを変更
   - または手動デプロイをトリガー

4. **ベータ環境でテスト**
   - https://beta.fukumado.jp でクライアントをテスト
   - https://beta-admin.fukumado.jp で管理画面をテスト
   - 本番データに影響なし

5. **問題なければ本番へマージ**
   ```bash
   git checkout main
   git merge feature/new-feature
   git push origin main
   ```

### ベータ環境と本番環境の切り替え

Renderダッシュボードで各サービスのブランチを設定：

- **本番環境**: `main` ブランチ
- **ベータ環境**: `develop` または `beta` ブランチ

---

## 🎉 完了！

すべてのチェックが完了したら、デプロイ完了です。

**サポートが必要な場合**: Renderのログを確認するか、開発チームに連絡してください。
