# 14. 付録

このセクションでは、参考情報、用語集、リンク集などを提供します。

## 14.1 用語集

### アプリケーション用語
- **スロット (Slot)**: 配信を表示する枠。最大8スロット。
- **マスタースロット (Master Slot)**: 音声同期の基準となるスロット。
- **プレビュー (Preview)**: マスタースロット以外のスロットが同期待機状態で表示される状態。
- **プリセット (Preset)**: レイアウトの種類（twoByTwo, oneByTwo, focus）。
- **アクティブスロット (Active Slots)**: 実際に表示されるスロット数（1〜8）。

### チャット用語
- **ハイライト (Highlight)**: チャットメッセージの強調表示（メンション、サブスクなど）。
- **エモート (Emote)**: Twitchの絵文字スタンプ。
- **Bits**: Twitchのチア（投げ銭）。
- **バッジ (Badge)**: チャットでのユーザーステータス（サブスク、モデレーター等）。
- **VIP**: Twitchの特別視聴者。
- **Mod / モデレーター**: チャットの管理者。

### 技術用語
- **HMR (Hot Module Replacement)**: 開発時の自動リロード機能。
- **SSR (Server-Side Rendering)**: サーバーサイドレンダリング（本アプリは非対応）。
- **CSR (Client-Side Rendering)**: クライアントサイドレンダリング（本アプリで使用）。
- **Persist Middleware**: Zustandの永続化ミドルウェア。
- **Shallow Comparison**: 浅い比較（オブジェクトの第1レベルのみ比較）。
- **Memoization**: 計算結果をキャッシュして再利用する最適化手法。

## 14.2 参考リンク

### 公式ドキュメント
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [Twitch Embed & Chat](https://dev.twitch.tv/docs/embed/)
- [Twitch Helix API](https://dev.twitch.tv/docs/api/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

### ライブラリ
- [Heroicons](https://heroicons.com/)
- [clsx](https://github.com/lukeed/clsx)
- [tmi.js](https://github.com/tmijs/tmi.js) (Twitch IRC)

### 開発ツール
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Redux DevTools](https://github.com/reduxjs/redux-devtools) (Zustandでも使用可)
- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)

## 14.3 FAQ

### Q: YouTube配信が埋め込めない
A: 一部の配信は埋め込みが無効になっています。配信者が埋め込みを許可しているか確認してください。

### Q: チャットが表示されない
A: Twitch認証が必要です。Headerの認証メニューからTwitchにログインしてください。

### Q: データ使用量が少なく表示される
A: iframe内の配信ストリーミングデータは測定できないため、実際の使用量より少なく表示されます。

### Q: 音量制御が効かない
A: ブラウザの自動再生ポリシーにより、ユーザーインタラクション前は音声再生できません。画面をクリックしてください。

### Q: モバイルで表示が崩れる
A: 現在、デスクトップ向けに最適化されています。モバイル対応は今後の課題です。

## 14.4 バージョン履歴

### v0.2.1 (2025-10-26)
- バックエンド駆動型アーキテクチャへの移行
- StreamSyncServiceの実装
- WebSocketによる配信リスト更新通知
- キャッシング最適化（チャンネル検索: 5分TTL）

### v0.2.0
- チャンネル検索のキャッシング実装
- パフォーマンス最適化（React.memo、useStoreWithEqualityFn）
- スロット削除時のフリーズ部分解消

### v0.1.1
- モバイル対応の改善（ChatPanel、Sidebar、EmotePicker）
- タッチ操作対応
- 閉じるボタン追加

### v0.1.0
- 初期リリース
- 基本的なマルチストリーミング機能
- YouTube、Twitch対応
- チャット機能
- 音量制御

## 14.5 ライセンス情報

### 本アプリケーション
- ライセンス: 未定（プロジェクト固有）

### 使用ライブラリ
- React: MIT License
- Zustand: MIT License
- Vite: MIT License
- TypeScript: Apache License 2.0
- Heroicons: MIT License
- clsx: MIT License

## 14.6 コントリビューション

### 貢献方法
1. Issueを作成して問題を報告
2. Pull Requestを送信して機能追加・バグ修正
3. ドキュメントの改善

### コードスタイル
- ESLint + TypeScript設定に従う
- コミットメッセージは Conventional Commits に準拠

## 14.7 サポート・お問い合わせ

### バグ報告
- GitHub Issues（推定）

### 機能リクエスト
- GitHub Discussions（推定）

### セキュリティ脆弱性
- 非公開で報告（メール等）

## 14.8 ロードマップ

### 短期（1-3ヶ月）
- [ ] モバイル完全対応
- [ ] ダークモード実装
- [ ] パフォーマンス改善（スロット削除時のフリーズ完全解消）
- [ ] エモートキャッシング

### 中期（3-6ヶ月）
- [ ] ニコニコ生放送完全対応
- [ ] 音声同期機能の実装
- [ ] ユーザープロファイル機能
- [ ] 配信録画・クリップ機能

### 長期（6ヶ月以上）
- [ ] コミュニティ機能（お気に入り配信共有）
- [ ] マルチデバイス同期
- [ ] プラグインシステム
- [ ] カスタムテーマ

## 14.9 クレジット

### 開発者
- （開発者名）

### デザイン
- ブランドカラー: アングラーズ（https://ships.anglers.jp/）

### 謝辞
- Twitch, YouTube, ニコニコ生放送の各プラットフォーム
- オープンソースコミュニティ

## 14.10 関連プロジェクト

### 類似アプリ
- Multitwitch
- Kadgar
- ViewSync

### 参考資料
- [Building a Multi-Stream Viewer](https://example.com/)
- [Optimizing React Performance](https://react.dev/learn/render-and-commit)
- [WebSocket Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

## 14.11 用語集（技術詳細）

### React関連
- **Hooks**: 関数コンポーネントで状態やライフサイクルを扱う仕組み
- **Context**: コンポーネント間でデータを共有する仕組み
- **Portal**: 親コンポーネントのDOM階層外にレンダリングする仕組み
- **Suspense**: 非同期コンポーネントのローディング状態を管理

### Zustand関連
- **Store**: グローバルな状態管理
- **Middleware**: ストアの振る舞いを拡張する仕組み
- **Persist**: localStorageへの永続化
- **Devtools**: Redux DevToolsとの統合

### API関連
- **REST API**: HTTPベースのAPI
- **WebSocket**: 双方向通信プロトコル
- **OAuth 2.0**: 認証・認可プロトコル
- **CORS**: クロスオリジンリソース共有

## 14.12 デバッグチートシート

### ブラウザコンソールコマンド
```javascript
// Zustandストアの状態を確認
console.log(window.useLayoutStore.getState());

// localStorageをクリア
localStorage.clear();

// sessionStorageをクリア
sessionStorage.clear();

// パフォーマンス計測開始
performance.mark('start');
// ... 処理 ...
performance.mark('end');
performance.measure('myMeasure', 'start', 'end');
console.log(performance.getEntriesByName('myMeasure'));
```

### React DevToolsプロファイラー
1. React DevToolsを開く
2. Profilerタブを選択
3. 記録開始
4. 操作を実行
5. 記録停止
6. フレームごとのレンダリング時間を確認

## 14.13 リソース

### アイコン・画像
- Heroicons: https://heroicons.com/
- Unsplash: https://unsplash.com/

### フォント
- システムフォント使用（-apple-system, BlinkMacSystemFont, Segoe UI, etc.）

### カラーパレット
- Coolors: https://coolors.co/
- Adobe Color: https://color.adobe.com/

---

この付録は随時更新されます。最新情報は仕様書の更新日を確認してください。
