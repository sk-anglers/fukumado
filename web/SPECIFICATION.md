# ふくまど！(Fukumado) - 完全仕様書

**バージョン**: 0.2.1
**最終更新日**: 2025-10-26
**アプリケーション名**: ふくまど！(Fukumado) - Multi-Streaming Viewer

---

## はじめに

この仕様書は、**ふくまど！**の完全な技術仕様を記載したドキュメントです。

仕様書が大きくなりすぎたため、セクションごとに分割して`specifications/`フォルダに格納しています。

---

## 目次

各セクションの詳細は、以下のリンクから参照してください：

### 1. [プロジェクト概要](./specifications/01_overview.md)
- アプリケーションの目的
- 主要機能
- 対象ユーザー
- 技術的特徴
- ユースケース例
- プロジェクトの進化

### 2. [アーキテクチャ](./specifications/02_architecture.md)
- 技術スタック
- システム構成図
- データフロー詳細
- API最適化戦略
- セキュリティアーキテクチャ
- パフォーマンス評価
- スケーラビリティ戦略

### 3. [ディレクトリ構造](./specifications/03_directory.md)
- フロントエンド構造
- バックエンド構造
- ファイル命名規則
- 依存関係の方向性
- モジュール分割戦略
- ファイルサイズ管理
- 特別なディレクトリ

### 4. [データモデル（型定義）](./specifications/04_data_models.md)
- 基本型（Platform, VideoQuality等）
- 配信関連型（Streamer, StreamSlot）
- チャット関連型（ChatMessage, TwitchEmote, TwitchBadge）
- レイアウト関連型（LayoutPreset, ChannelSearchResult）
- 通知関連型（Notification, NotificationSettings）
- 同期関連型（SyncSettings）
- データ使用量関連型
- 型のバリデーション

### 5. [状態管理（Zustand Stores）](./specifications/05_state_management.md)
- layoutStore
- chatStore
- authStore
- userStore
- syncStore
- notificationStore
- dataUsageStore
- ストア間の依存関係
- ストア使用のベストプラクティス

### 6. [コンポーネント仕様](./specifications/06_components.md)
- AppShell
- Header
- Sidebar
- StreamGrid
- StreamSlot
- ChatPanel
- Footer
- LayoutPresetModal
- SlotSelectionModal
- StreamSelectionModal
- EmotePicker
- Toast
- コンポーネント設計原則

### 7. [カスタムフック仕様](./specifications/07_hooks.md)
- useAuthStatus
- useTwitchAuthStatus
- useYoutubeStreams
- useTwitchStreams
- useTwitchChat
- useYouTubeIframeApi
- useTwitchEmbed
- useAudioLevelMonitor
- useDataUsageMonitor
- フック設計のベストプラクティス

### 8. [API仕様](./specifications/08_api.md)
- 認証API
- YouTube API
- Twitch API
- ニコニコAPI
- WebSocket API
- エラーコード
- レート制限
- API呼び出しのベストプラクティス

### 9. [設定・環境変数](./specifications/09_configuration.md)
- config.ts
- 環境変数
- Vite設定
- TypeScript設定
- package.json
- ESLint設定
- .envファイル例
- バックエンド設定
- 設定のベストプラクティス

### 10. [スタイリング・デザインシステム](./specifications/10_styling.md)
- スタイル手法
- ブランドカラー
- カスタムプロパティ（CSS Variables）
- レスポンシブ対応
- アニメーション・トランジション
- タイポグラフィ
- アイコン
- Utility Classes
- グリッドレイアウト
- Z-Index管理
- アクセシビリティ
- ダークモード（将来の実装）
- デザインシステムのベストプラクティス

### 11. [機能詳細フロー](./specifications/11_flows.md)
- アプリケーション起動フロー
- 配信視聴フロー
- 音量制御フロー
- 音声同期フロー
- チャット送信フロー
- 配信開始通知フロー
- データ使用量監視フロー
- レイアウト変更フロー
- 全画面モードフロー
- フォローチャンネル追加フロー
- エラーハンドリングフロー
- スロット削除フロー
- 状態永続化フロー
- バックグラウンド同期フロー

### 12. [制限事項・既知の問題](./specifications/12_issues.md)
- iframeクロスオリジン制限
- プラットフォーム別制限
- 音声同期機能
- パフォーマンス
- モバイル対応
- パフォーマンス・フリーズ問題
- 認証・セキュリティ
- エラーハンドリング
- ブラウザ互換性
- アクセシビリティ
- 既知のバグ
- 制限事項の回避策

### 13. [開発ガイド](./specifications/13_development_guide.md)
- 開発環境セットアップ
- 開発コマンド
- ディレクトリ追加ガイドライン
- コーディング規約
- デバッグ
- テスト
- デプロイ
- トラブルシューティング
- パフォーマンス最適化
- Gitワークフロー
- CI/CD
- コードレビューのポイント

### 14. [付録](./specifications/14_appendix.md)
- 用語集
- 参考リンク
- FAQ
- バージョン履歴
- ライセンス情報
- コントリビューション
- サポート・お問い合わせ
- ロードマップ
- クレジット
- 関連プロジェクト
- 用語集（技術詳細）
- デバッグチートシート
- リソース

---

## 更新履歴

### 2025-10-26 (v0.2.1)
- 仕様書をセクションごとに分割
- 各セクションの内容を充実
- ディレクトリ構造、デザインシステム、開発ガイドなどの追加情報を記載

### 2025-10-26 (v0.2.0)
- バックエンド駆動型アーキテクチャへの移行
- StreamSyncServiceの詳細仕様
- キャッシング戦略の最適化

### 2025-10-20 (v0.1.0)
- 初版作成

---

## ドキュメント使用ガイド

### 開発者向け
- まず[プロジェクト概要](./specifications/01_overview.md)を読んで全体像を把握
- [開発ガイド](./specifications/13_development_guide.md)で環境構築
- 実装時は各セクションを参照

### コントリビューター向け
- [コーディング規約](./specifications/13_development_guide.md#134-コーディング規約)を確認
- [Gitワークフロー](./specifications/13_development_guide.md#1310-git-ワークフロー)に従う
- [コンポーネント仕様](./specifications/06_components.md)や[型定義](./specifications/04_data_models.md)を参照して一貫性を保つ

### 新規参加者向け
1. [プロジェクト概要](./specifications/01_overview.md)
2. [アーキテクチャ](./specifications/02_architecture.md)
3. [ディレクトリ構造](./specifications/03_directory.md)
4. [開発ガイド](./specifications/13_development_guide.md)

の順に読むことを推奨します。

---

## お問い合わせ

仕様書に関する質問や改善提案は、GitHubのIssueまたはDiscussionsでお願いします。

---

**© 2025 ふくまど！ All rights reserved.**
