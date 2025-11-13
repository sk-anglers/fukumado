# 19. アナリティクス仕様

## 概要

本アプリケーションでは、ユーザー行動の詳細な分析とサービス改善のため、Google Analytics 4（GA4）とGoogle Tag Manager（GTM）を使用した包括的なトラッキングシステムを実装しています。

### 実装目的

- ユーザー行動の定量的な把握
- 機能の利用状況の測定
- コンバージョン分析
- ユーザーエクスペリエンスの改善
- A/Bテストのデータ基盤

---

## アナリティクス構成

### 使用ツール

| ツール | ID | 用途 |
|--------|-----|------|
| Google Analytics 4 | G-CNHJ23CY90 | データ収集・分析 |
| Google Tag Manager | GTM-MQ88DPNM | イベント管理・配信 |

### データフロー

```
ユーザー操作
    ↓
window.dataLayer.push() (コード)
    ↓
GTM カスタムイベントトリガー
    ↓
GTM データレイヤー変数
    ↓
GA4 イベントタグ
    ↓
Google Analytics 4
    ↓
レポート・分析
```

---

## 実装ファイル

### コアファイル

#### web/src/utils/gtm.ts

GTMへのイベント送信を行うユーティリティ関数群。

```typescript
// 基本的なイベント送信
export const trackEvent = (eventName: string, params?: GTMEventParams): void

// ボタンクリック
export const trackButtonClick = (buttonName: string, additionalParams?: GTMEventParams): void

// 配信操作
export const trackStreamAction = (actionType: string, platform: Platform, slotIndex?: number, channelId?: string): void

// 認証（ログアウト）
export const trackAuth = (action: 'logout', platform: Platform, success: boolean): void

// 検索
export const trackSearch = (query: string): void

// チャット操作
export const trackChatAction = (action: 'open' | 'close'): void

// 同期操作
export const trackSyncAction = (actionType: string, platform: Platform): void
```

### HTMLファイル

#### web/index.html

GTMコンテナスニペットを `<head>` と `<body>` に配置。

```html
<!-- Google Tag Manager -->
<script>
  (function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-MQ88DPNM');
</script>

<!-- Google Tag Manager (noscript) -->
<noscript>
  <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MQ88DPNM"></iframe>
</noscript>
```

---

## トラッキングイベント一覧

### 1. button_click

全てのボタンクリックを追跡するイベント。

**イベント名**: `button_click`

**パラメータ**:

| パラメータ名 | 型 | 説明 | 例 |
|------------|-----|------|-----|
| button_name | string | ボタンの識別子 | `chat_send_message` |
| platform | string | プラットフォーム | `twitch`, `youtube` |
| channel_id | string | チャンネルID | `463657800` |
| slot_id | string | スロットID | `slot-1` |
| action | string | アクション種別 | `open`, `close`, `mute`, `unmute` |
| slots_count | number | スロット数 | `4`, `6`, `8` |
| emote_name | string | エモート名 | `wakiWaku` |
| category | string | カテゴリー | `global`, `channel` |
| error_message | string | エラーメッセージ | エラー内容 |
| announcement_id | string | お知らせID | UUID |
| announcement_type | string | お知らせタイプ | `info`, `warning`, `error` |
| article_id | string | ヘルプ記事ID | UUID |
| unread_count | number | 未読数 | `5` |
| notification_count | number | 通知数 | `10` |
| analytics_cookies | boolean | 分析Cookie同意 | `true`, `false` |
| marketing_cookies | boolean | マーケティングCookie同意 | `true`, `false` |

**実装箇所** (28個のボタン):

| コンポーネント | ボタン | button_name | 追加パラメータ |
|--------------|--------|-------------|--------------|
| Header.tsx | 検索 | `header_search` | - |
| Header.tsx | レイアウト変更（4/6/8） | `header_layout_change` | `slots_count` |
| Header.tsx | フォロー削除（YouTube） | `header_unfollow_channel` | `platform`, `channel_id` |
| Header.tsx | フォロー削除（Twitch） | `header_unfollow_channel` | `platform`, `channel_id` |
| Header.tsx | スロットミュート切替 | `header_slot_mute_toggle` | `slot_id`, `action` |
| Header.tsx | 通知メニュー切替 | `header_notification_menu_toggle` | `action` |
| EmotePicker.tsx | ピッカー開閉 | `emote_picker_toggle` | `action` |
| EmotePicker.tsx | グローバルタブ | `emote_category_change` | `category: global` |
| EmotePicker.tsx | チャンネルタブ | `emote_category_change` | `category: channel` |
| EmotePicker.tsx | エモート選択 | `emote_select` | `emote_name`, `category` |
| SlotSelectionModal.tsx | モーダル閉じる | `slot_selection_modal_close` | - |
| SlotSelectionModal.tsx | スロット選択 | `slot_selection_assign` | `slot_id`, `platform`, `channel_id` |
| NotificationMenu.tsx | 全て既読 | `notification_mark_all_read` | `unread_count` |
| NotificationMenu.tsx | クリア | `notification_clear_all` | `notification_count` |
| ErrorScreen.tsx | リロード | `error_screen_reload` | `error_message` |
| ErrorScreen.tsx | ホームに戻る | `error_screen_go_home` | `error_message` |
| AnnouncementBanner.tsx | お知らせ閉じる | `announcement_dismiss` | `announcement_id`, `announcement_type` |
| HelpModal.tsx | モーダル閉じる | `help_modal_close` | - |
| HelpModal.tsx | 戻る | `help_article_back` | `article_id` |
| HelpModal.tsx | カテゴリー変更 | `help_category_change` | `category` |
| Footer.tsx | 利用規約 | `footer_open_terms` | - |
| Footer.tsx | プライバシーポリシー | `footer_open_privacy` | - |
| CookieConsentBanner.tsx | 全許可 | `cookie_consent_accept_all` | - |
| CookieConsentBanner.tsx | カスタマイズ | `cookie_consent_customize` | - |
| CookieConsentBanner.tsx | 必須のみ | `cookie_consent_essential_only` | - |
| CookieConsentBanner.tsx | 選択を保存 | `cookie_consent_save_selection` | `analytics_cookies`, `marketing_cookies` |
| CookieConsentBanner.tsx | 戻る | `cookie_consent_back` | - |
| ChatPanel.tsx | チャット送信 | `chat_send_message` | `channel_id` |

---

### 2. stream_action

配信の割り当て・削除などの操作を追跡。

**イベント名**: `stream_action`

**パラメータ**:

| パラメータ名 | 型 | 説明 | 例 |
|------------|-----|------|-----|
| action_type | string | 操作種別 | `assign`, `remove` |
| platform | string | プラットフォーム | `twitch`, `youtube`, `niconico` |
| slot_index | number | スロットインデックス | `0`, `1`, `2` |
| channel_id | string | チャンネルID | `463657800` |

**実装箇所**:

| コンポーネント | 操作 | action_type |
|--------------|------|-------------|
| StreamSlot.tsx | 配信クリア | `remove` |
| Sidebar.tsx | 配信割り当て | `assign` |
| StreamSelectionModal.tsx | 配信選択 | `assign` |

---

### 3. auth_logout

ログアウト操作を追跡。

**イベント名**: `auth_logout`

**パラメータ**:

| パラメータ名 | 型 | 説明 | 例 |
|------------|-----|------|-----|
| platform | string | プラットフォーム | `youtube`, `twitch` |
| success | boolean | 成功可否 | `true`, `false` |

**実装箇所**:

| コンポーネント | 操作 |
|--------------|------|
| AccountMenu.tsx | YouTubeログアウト |
| AccountMenu.tsx | Twitchログアウト |

---

### 4. search

検索操作を追跡。

**イベント名**: `search`

**パラメータ**:

| パラメータ名 | 型 | 説明 | 例 |
|------------|-----|------|-----|
| search_term | string | 検索クエリ | `wakiwaku` |

**実装箇所**:

| コンポーネント | 操作 |
|--------------|------|
| Header.tsx | チャンネル検索 |

**注意**: GA4の標準イベント `search` を使用し、パラメータ名も GA4 の推奨パラメータ `search_term` を使用。

---

### 5. chat_action

チャットパネルの開閉を追跡。

**イベント名**: `chat_action`

**パラメータ**:

| パラメータ名 | 型 | 説明 | 例 |
|------------|-----|------|-----|
| action | string | アクション種別 | `open`, `close` |

**実装箇所**:

| コンポーネント | 操作 | action |
|--------------|------|--------|
| ChatPanel.tsx | チャットを閉じる | `close` |
| MobileMenuButton.tsx | チャットを開く | `open` |

---

### 6. chat_send

チャット送信を追跡。

**イベント名**: `chat_send`

**パラメータ**:

| パラメータ名 | 型 | 説明 | 例 |
|------------|-----|------|-----|
| platform | string | プラットフォーム | `twitch` |
| channel_id | string | チャンネルID | `463657800` |

**実装箇所**:

| コンポーネント | 操作 |
|--------------|------|
| ChatPanel.tsx | チャット送信ボタン |

---

### 7. sync_action

YouTube/Twitchのフォロー情報同期を追跡。

**イベント名**: `sync_action`

**パラメータ**:

| パラメータ名 | 型 | 説明 | 例 |
|------------|-----|------|-----|
| action_type | string | 操作種別 | `sync_youtube`, `sync_twitch` |
| platform | string | プラットフォーム | `youtube`, `twitch` |

**実装箇所**:

| コンポーネント | 操作 | action_type |
|--------------|------|-------------|
| AccountMenu.tsx | YouTube同期 | `sync_youtube` |
| AccountMenu.tsx | Twitch同期 | `sync_twitch` |

---

## GTM設定詳細

### データレイヤー変数（20個）

GTMで定義されているデータレイヤー変数：

| 変数名 | データレイヤーの変数名 | 用途 |
|--------|---------------------|------|
| DLV - action | action | アクション種別 |
| DLV - button_name | button_name | ボタン名 |
| DLV - channel_id | channel_id | チャンネルID |
| DLV - filter | filter | フィルター（既存） |
| DLV - platform | platform | プラットフォーム |
| DLV - slot_index | slot_index | スロットインデックス |
| DLV - success | success | 成功可否 |
| DLV - volume | volume | 音量（既存） |
| DLV - slot_id | slot_id | スロットID |
| DLV - action_type | action_type | アクション種別 |
| DLV - search_query | search_query | 検索クエリ |
| DLV - slots_count | slots_count | スロット数 |
| DLV - emote_name | emote_name | エモート名 |
| DLV - category | category | カテゴリー |
| DLV - error_message | error_message | エラーメッセージ |
| DLV - announcement_id | announcement_id | お知らせID |
| DLV - announcement_type | announcement_type | お知らせタイプ |
| DLV - article_id | article_id | ヘルプ記事ID |
| DLV - unread_count | unread_count | 未読数 |
| DLV - notification_count | notification_count | 通知数 |
| DLV - analytics_cookies | analytics_cookies | 分析Cookie同意 |
| DLV - marketing_cookies | marketing_cookies | マーケティングCookie同意 |

### トリガー（7個）

| トリガー名 | イベント名 | 説明 |
|-----------|----------|------|
| CE - button_click | button_click | ボタンクリック |
| CE - stream_action | stream_action | 配信操作 |
| CE - auth_logout | auth_logout | ログアウト |
| CE - search | search | 検索 |
| CE - chat_action | chat_action | チャット開閉 |
| CE - chat_send | chat_send | チャット送信 |
| CE - sync_action | sync_action | 同期操作 |

すべてのトリガーは「カスタムイベント」タイプで、「すべてのカスタムイベント」に対して発火します。

### タグ（7個）

| タグ名 | イベント名 | トリガー | 主なパラメータ |
|--------|----------|---------|--------------|
| GA4 Event - button_click | button_click | CE - button_click | button_name, platform, channel_id, slot_id, action, など16個 |
| GA4 Event - stream_action | stream_action | CE - stream_action | action_type, platform, slot_index, channel_id |
| GA4 Event - auth_logout | auth_logout | CE - auth_logout | platform, success |
| GA4 Event - search | search | CE - search | search_term |
| GA4 Event - chat_action | chat_action | CE - chat_action | action |
| GA4 Event - chat_send | chat_send | CE - chat_send | platform, channel_id |
| GA4 Event - sync_action | sync_action | CE - sync_action | action_type, platform |

すべてのタグは「Google アナリティクス: GA4 イベント」タイプで、測定ID `G-CNHJ23CY90` を使用します。

---

## GA4分析方法

### リアルタイムレポート

**アクセス**: GA4管理画面 → レポート → リアルタイム

**確認項目**:
- イベント数（イベント名別）
- 過去30分間のユーザー数
- ユーザーの場所
- 利用デバイス

### イベントレポート

**アクセス**: GA4管理画面 → レポート → エンゲージメント → イベント

**確認項目**:
- イベント数
- ユーザー数
- イベントあたりの収益
- コンバージョン率

### カスタムレポート

**推奨レポート**:

#### 1. ボタンクリック分析

**ディメンション**:
- `button_name`
- `platform`
- `action`

**指標**:
- イベント数
- ユニークユーザー数

**分析内容**:
- 最も使われている機能の特定
- プラットフォーム別の利用傾向
- 操作フローの把握

#### 2. 配信操作分析

**ディメンション**:
- `action_type`
- `platform`
- `slot_index`

**指標**:
- イベント数
- ユーザー数

**分析内容**:
- 配信割り当て/削除の頻度
- プラットフォーム別の人気度
- スロット利用状況

#### 3. チャット利用分析

**ディメンション**:
- イベント名（`chat_send`, `chat_action`）
- `platform`
- `action`

**指標**:
- イベント数
- アクティブユーザー数

**分析内容**:
- チャット送信頻度
- チャット機能の利用率
- プラットフォーム別のチャット活性度

#### 4. 検索分析

**ディメンション**:
- `search_term`

**指標**:
- 検索数
- 検索ユーザー数

**分析内容**:
- 人気のチャンネル
- 検索キーワードのトレンド
- ユーザーの興味分析

#### 5. エモート利用分析

**ディメンション**:
- `emote_name`
- `category`

**指標**:
- エモート選択数
- ユーザー数

**分析内容**:
- 人気エモート
- グローバル vs チャンネルエモート
- エモート機能の利用率

#### 6. Cookie同意分析

**ディメンション**:
- `button_name`（cookie_consent_*）
- `analytics_cookies`
- `marketing_cookies`

**指標**:
- 選択数
- ユーザー数

**分析内容**:
- Cookie同意率
- カスタマイズ利用率
- プライバシー意識の把握

---

## イベントパラメータのカスタムディメンション設定

GA4で詳細分析を行うには、イベントパラメータをカスタムディメンションとして登録する必要があります。

### 登録手順

1. GA4管理画面 → 設定 → カスタム定義 → カスタムディメンションを作成
2. 以下のパラメータを登録：

| ディメンション名 | パラメータ名 | スコープ | 説明 |
|---------------|-------------|---------|------|
| ボタン名 | button_name | イベント | クリックされたボタン |
| プラットフォーム | platform | イベント | twitch/youtube/niconico |
| チャンネルID | channel_id | イベント | 対象チャンネル |
| スロットID | slot_id | イベント | 対象スロット |
| アクション | action | イベント | 操作種別 |
| アクション種別 | action_type | イベント | 詳細な操作種別 |
| スロット数 | slots_count | イベント | レイアウトのスロット数 |
| エモート名 | emote_name | イベント | 選択されたエモート |
| カテゴリー | category | イベント | エモートカテゴリー等 |
| 検索クエリ | search_term | イベント | 検索キーワード |

**注意**: GA4のカスタムディメンションは無料版で50個まで作成可能です。

---

## トラブルシューティング

### イベントが送信されない

**確認項目**:

1. **ブラウザコンソールでエラー確認**
   ```javascript
   // コンソールで確認
   window.dataLayer
   ```

2. **GTMコンテナIDの確認**
   - 正しいID: `GTM-MQ88DPNM`
   - `index.html` に正しく記載されているか

3. **GTMプレビューモードで確認**
   - GTM管理画面 → プレビュー
   - イベントが発火しているか
   - データレイヤー変数に値が入っているか

4. **広告ブロッカーの確認**
   - 広告ブロック拡張機能が無効化されているか
   - プライベートブラウジングモードを試す

### パラメータが送信されない

**確認項目**:

1. **データレイヤー変数名の確認**
   - GTM変数設定のスペルミス
   - コード側のパラメータ名との一致

2. **タグのパラメータ設定確認**
   - GA4タグでパラメータが正しくマッピングされているか
   - 変数が `{{DLV - parameter_name}}` 形式で設定されているか

3. **GA4カスタムディメンション登録確認**
   - パラメータがカスタムディメンションとして登録されているか
   - 登録から24時間経過しているか（反映に時間がかかる）

### GA4でイベントが表示されない

**確認項目**:

1. **リアルタイムレポートで確認**
   - 通常レポートには24-48時間の遅延がある
   - まずリアルタイムレポートで確認

2. **測定IDの確認**
   - 正しいID: `G-CNHJ23CY90`
   - GTMタグ設定で正しく設定されているか

3. **データ保持期間の確認**
   - GA4設定 → データ設定 → データ保持
   - イベントレベルのデータ保持期間を確認

### GTMタグが発火しない

**確認項目**:

1. **トリガー条件の確認**
   - カスタムイベント名が正しいか
   - トリガー条件が「すべてのカスタムイベント」になっているか

2. **タグの一時停止状態確認**
   - タグが有効化されているか
   - GTMコンテナが公開されているか

3. **コンテナのバージョン確認**
   - 最新の変更が公開されているか
   - 公開バージョンに変更が含まれているか

---

## セキュリティとプライバシー

### データ収集の透明性

- Cookie同意バナー（CookieConsentBanner.tsx）で明示的な同意を取得
- 分析Cookie、マーケティングCookieは任意
- 必須Cookieのみでもサービス利用可能

### 個人情報の取り扱い

**収集する情報**:
- イベント名とパラメータ
- デバイス情報
- IPアドレス（匿名化）
- ページURL

**収集しない情報**:
- ユーザー名
- メールアドレス
- パスワード
- チャット内容の詳細

**注意**: `channel_id` は収集されますが、これは公開情報です。

### GDPR/CCPA対応

- Cookie同意の記録
- 同意の撤回機能（プライバシー設定から変更可能）
- データ削除リクエストへの対応（GA4管理画面から可能）

---

## パフォーマンスへの影響

### 実装によるオーバーヘッド

- **GTMスクリプトサイズ**: 約70KB（gzip圧縮後）
- **実行時のオーバーヘッド**: 1イベントあたり < 1ms
- **ネットワーク**: 非同期送信のため、UI操作に影響なし

### 最適化施策

1. **非同期読み込み**
   - GTMスクリプトは非同期で読み込まれる
   - ページレンダリングをブロックしない

2. **イベントバッチング**
   - GA4側で自動的にバッチ送信
   - ネットワークリクエスト数を最小化

3. **キャッシング**
   - GTMスクリプトはブラウザキャッシュされる
   - 2回目以降の読み込みは高速

---

## 今後の拡張計画

### Phase 2: eコマーストラッキング

- サブスクリプション登録のトラッキング
- 収益イベントの計測
- ファネル分析

### Phase 3: ユーザー属性分析

- ユーザーIDの送信（ログイン後）
- コホート分析
- リテンション分析

### Phase 4: A/Bテスト

- Google Optimize連携
- 機能のA/Bテスト
- UI/UXの最適化

### Phase 5: カスタムイベント追加

- 動画視聴時間
- スクロール深度
- エンゲージメント時間
- エラー率

---

## 付録

### イベント命名規則

- **イベント名**: スネークケース（`button_click`, `stream_action`）
- **パラメータ名**: スネークケース（`button_name`, `channel_id`）
- **パラメータ値**: ケバブケース（`chat-send-message`, `slot-1`）またはキャメルケース（`chatSendMessage`）

### デバッグ用コード

**ブラウザコンソールでのデバッグ**:

```javascript
// データレイヤーの確認
window.dataLayer

// 最新のイベントを確認
window.dataLayer[window.dataLayer.length - 1]

// イベント送信のテスト
window.dataLayer.push({
  event: 'button_click',
  button_name: 'test_button'
})
```

### 参考リンク

- [GA4公式ドキュメント](https://support.google.com/analytics/answer/9304153)
- [GTM公式ドキュメント](https://support.google.com/tagmanager/)
- [データレイヤー仕様](https://developers.google.com/tag-manager/devguide)
- [GA4イベントリファレンス](https://support.google.com/analytics/answer/9267735)

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|----------|---------|
| 2025-01-13 | 1.0.0 | 初版作成。GA4/GTMトラッキング実装の詳細仕様を記載 |
