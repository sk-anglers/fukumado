# 10. レスポンシブデザイン

## 10.1 概要

ふくまど！は、デスクトップ、タブレット、モバイルの各デバイスに最適化されたレスポンシブデザインを実装しています。

### サポート環境

- **デスクトップ (≥1201px)**: フル機能、3カラムレイアウト
- **タブレット (769px-1200px)**: 簡略化UI、2カラムレイアウト
- **モバイル (≤768px)**: モバイル最適化UI（ベータ環境のみ）

### 環境別対応状況

| 環境 | デスクトップ | タブレット | モバイル |
|------|------------|----------|---------|
| **本番環境** | ✅ 完全対応 | ✅ 完全対応 | ⚠️ 制限画面 |
| **ベータ環境** | ✅ 完全対応 | ✅ 完全対応 | ✅ 完全対応 |

## 10.2 ブレークポイント

### 定義

```typescript
// src/hooks/useMediaQuery.ts
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 768px)');
export const useIsTablet = (): boolean => useMediaQuery('(min-width: 769px) and (max-width: 1200px)');
export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 1201px)');
```

### ブレークポイント一覧

| デバイス | 幅 | 主な変更点 |
|---------|-----|-----------|
| **モバイル** | ≤768px | オーバーレイメニュー、画面向き対応、自動ミュート |
| **タブレット** | 769px-1200px | サイドバー幅縮小、チャット非表示 |
| **デスクトップ (小)** | 1201px-1440px | 3カラムレイアウト（標準幅） |
| **デスクトップ (大)** | >1440px | 3カラムレイアウト（拡張幅） |

## 10.3 画面向き対応（モバイル専用）

### 検知

```typescript
export const useIsLandscape = (): boolean => useMediaQuery('(orientation: landscape)');
export const useIsPortrait = (): boolean => useMediaQuery('(orientation: portrait)');
```

### 自動調整

```typescript
// StreamGrid.tsx
useEffect(() => {
  if (isMobile) {
    if (isLandscape) {
      setActiveSlotsCount(2);   // 横向き: 2画面
      setFullscreen(true);       // 全画面モード
    } else {
      setActiveSlotsCount(3);   // 縦向き: 3画面
      setFullscreen(false);      // 通常モード
    }
  }
}, [isMobile, isLandscape]);
```

### 動作

| 向き | スロット数 | 全画面モード | 用途 |
|------|----------|------------|------|
| **横向き (Landscape)** | 2画面 | 自動ON | 動画視聴最適化 |
| **縦向き (Portrait)** | 3画面 | OFF | スクロール可能 |

## 10.4 レイアウト調整

### デスクトップ (≥1201px)

**3カラムレイアウト**:
```css
.body {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 360px;
}
```

**主要機能**:
- サイドバー: 280px固定幅
- メインコンテンツ: フレキシブル幅
- チャットパネル: 360px固定幅
- 全コントロール表示

### タブレット (769px-1200px)

**2カラムレイアウト**:
```css
@media (max-width: 1200px) {
  .body {
    grid-template-columns: 220px minmax(0, 1fr);
  }
  .chatArea {
    display: none;
  }
}
```

**主要機能**:
- サイドバー: 220px固定幅
- メインコンテンツ: フレキシブル幅
- チャットパネル: 非表示

### モバイル (≤768px)

**1カラム + オーバーレイ**:
```css
@media (max-width: 768px) {
  .body {
    display: flex;
    flex-direction: column;
  }
  .sidebarNormal,
  .chatArea {
    display: none;
  }
}
```

**主要機能**:
- メインコンテンツ: 100%幅
- サイドバー: オーバーレイ表示
- チャット: オーバーレイ表示

## 10.5 モバイル専用UI（ベータ環境）

### 10.5.1 モバイルメニューボタン

**Header.tsx**:
```typescript
{isMobile && (
  <div className={styles.mobileMenuButtons}>
    <button onClick={toggleSidebar}>
      <Bars3Icon />
    </button>
    <button onClick={toggleChat}>
      <ChatBubbleLeftRightIcon />
    </button>
    <button onClick={toggleMuteAll}>
      {mutedAll ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
    </button>
  </div>
)}
```

**スタイル**:
```css
.mobileMenuButton {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}
```

**特徴**:
- タッチターゲット: 44px × 44px（Appleガイドライン準拠）
- アクティブ状態の視覚フィードバック
- 3つの主要機能（サイドバー、チャット、ミュート）

### 10.5.2 オーバーレイメニュー

**AppShell.tsx**:
```typescript
// サイドバーオーバーレイ
<div className={isMobile && sidebarOpen ? styles.sidebarOverlay : styles.sidebarNormal}>
  <Sidebar />
</div>

// チャットオーバーレイ
<aside className={isMobile && chatOpen ? styles.chatOverlay : styles.chatArea}>
  <ChatPanel />
</aside>

// バックドロップ
{isMobile && sidebarOpen && (
  <div className={styles.backdrop} onClick={closeAll} />
)}
```

**スタイル**:
```css
.sidebarOverlay {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  z-index: 200;
  transform: translateX(0);
  transition: transform 0.3s ease;
}

.chatOverlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: 360px;
  z-index: 200;
  transform: translateX(0);
  transition: transform 0.3s ease;
}

.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 199;
  animation: fadeIn 0.3s ease;
}
```

**動作**:
- スライドイン/アウトアニメーション（0.3秒）
- バックドロップクリックで閉じる
- 排他制御（サイドバーとチャットは同時に開かない）

### 10.5.3 自動ミュート（Autoplay対応）

**StreamGrid.tsx**:
```typescript
useEffect(() => {
  if (isMobile && !initialMuteAppliedRef.current) {
    initialMuteAppliedRef.current = true;
    useLayoutStore.getState().resetAutoUnmuted();
    if (!currentMutedAll) {
      toggleMuteAll();  // 初回ロード時は全ミュート
    }
  }
}, [isMobile, toggleMuteAll]);
```

**目的**:
- モバイルブラウザのAutoplay制限に対応
- 初回ロード時は自動的に全スロットをミュート
- ユーザーが手動で音声ON可能

### 10.5.4 モバイル通知システム

#### 準備中ポップアップ

**表示条件**:
- モバイル環境
- 全ミュート中
- スロット未割り当てまたは再生待機中

**メッセージ**:
- 「残りN枠をセットしてください」
- 「配信を読み込んでいます...」

**スタイル**:
```css
.loadingPopup {
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  z-index: 9998;
  display: flex;
  justify-content: center;
  padding: 0 1rem;
  animation: slideDown 0.5s ease;
}

.loadingSpinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(148, 163, 184, 0.3);
  border-top-color: rgba(56, 189, 248, 0.9);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

#### 準備完了通知

**表示条件**:
- 全スロット再生開始時

**デザイン**:
- 緑のグラデーション背景
- スピーカーアイコン（パルスアニメーション）
- スライドダウンアニメーション

**スタイル**:
```css
.readyNotification {
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  z-index: 9998;
  animation: slideDown 0.5s ease;
}

.readyNotificationContent {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(16, 185, 129, 0.95));
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.readyNotificationIcon {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
```

#### リロード通知

**表示条件**:
- 一度再生開始後に停止検知時

**機能**:
- リロードボタンで `window.location.reload()`

**スタイル**:
```css
.reloadNotification {
  position: fixed;
  top: 60px;
  z-index: 9999;
}

.reloadButton {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  background: rgba(56, 189, 248, 0.9);
}
```

### 10.5.5 タッチ操作最適化

**StreamGrid.tsx**:
```typescript
<div
  onMouseMove={handleMouseMove}
  onTouchStart={handleTouchStart}
>
```

**機能**:
- マウスとタッチの両方でオーバーレイ再表示
- 3秒後に自動非表示タイマーをリセット
- ピンチズーム無効化（適宜）

## 10.6 ヘッダーのレスポンシブ対応

### デスクトップ (≥769px)

**表示要素**:
- ブランドロゴ + サブタイトル
- 検索バー
- 音量コントロール
- レイアウトメニュー
- フォローリスト
- 通知メニュー
- アカウントメニュー

### モバイル (≤768px)

**表示要素**:
- ブランドロゴのみ
- モバイルメニューボタン（3つ）

**CSS**:
```css
@media (max-width: 768px) {
  .header {
    padding: 0.75rem 1rem;
  }
  .logo {
    width: 40px;
    height: 40px;
  }
  .meta {
    display: none;
  }
  .actions {
    display: none !important;
  }
}
```

## 10.7 コンポーネント別レスポンシブ対応

### Header

| 画面幅 | 変更点 |
|-------|--------|
| ≤768px | ブランドロゴのみ、モバイルメニューボタン表示 |
| 769px-1024px | 縦並び、検索バー100%幅 |
| ≥1025px | 横並び、全機能表示 |

### Sidebar

| 画面幅 | 変更点 |
|-------|--------|
| ≤768px | オーバーレイ表示、閉じるボタン追加、Twitchログインセクション表示 |
| 769px-1200px | 220px固定幅 |
| ≥1201px | 280px固定幅 |

### ChatPanel

| 画面幅 | 変更点 |
|-------|--------|
| ≤768px | オーバーレイ表示、閉じるボタン追加 |
| 769px-1200px | 非表示 |
| ≥1201px | 360px固定幅 |

### StreamGrid

| 画面幅 | 変更点 |
|-------|--------|
| ≤768px | 画面向き自動調整、モバイル通知、自動ミュート |
| 769px-1200px | 標準グリッド |
| ≥1201px | 標準グリッド |

## 10.8 モバイル制限（本番環境）

### MobileRestriction コンポーネント

**App.tsx**:
```typescript
// モバイル制限（ベータ環境は除外）
if (isMobile && !config.isBeta) {
  return <MobileRestriction />;
}
```

**表示内容**:
```typescript
<div className={styles.container}>
  <div className={styles.content}>
    <div className={styles.icon}>📱</div>
    <h1 className={styles.title}>モバイル版は現在準備中です</h1>
    <p className={styles.description}>
      モバイルブラウザからのご利用は現在対応しておりません。<br />
      より快適にご利用いただくため、<br />
      <strong>タブレットまたはPCからのアクセス</strong>をお願いいたします。
    </p>
    <div className={styles.notice}>
      <p>モバイル版は順次対応予定です。</p>
      <p>ご不便をおかけしますが、今しばらくお待ちください。</p>
    </div>
  </div>
</div>
```

### 環境別動作

| 環境 | `isBeta` | `isMobile` | 表示画面 |
|------|---------|-----------|---------|
| 本番 | false | true | MobileRestriction |
| 本番 | false | false | 通常画面 |
| ベータ | true | true | **モバイル対応画面** |
| ベータ | true | false | 通常画面 |

## 10.9 非対応ブラウザ検出

### UnsupportedBrowser コンポーネント

**App.tsx**:
```typescript
// ブラウザ互換性チェック
if (isUnsupportedBrowser) {
  return <UnsupportedBrowser />;
}
```

**検出対象ブラウザ**:
- Internet Explorer（全バージョン）
- 古いバージョンのEdge（EdgeHTML）
- その他の古いブラウザ

**表示内容**:
```typescript
<div className={styles.container}>
  <div className={styles.content}>
    <div className={styles.icon}>⚠️</div>
    <h1 className={styles.title}>ご利用のブラウザは非対応です</h1>
    <p className={styles.description}>
      より快適にご利用いただくため、以下のブラウザをご利用ください。
    </p>
    <ul className={styles.browserList}>
      <li>Google Chrome（最新版）</li>
      <li>Mozilla Firefox（最新版）</li>
      <li>Microsoft Edge（Chromium版）</li>
      <li>Safari（最新版）</li>
    </ul>
  </div>
</div>
```

**検出ロジック**:
```typescript
const isUnsupportedBrowser = (): boolean => {
  const ua = navigator.userAgent;

  // IE検出
  if (ua.indexOf('MSIE') !== -1 || ua.indexOf('Trident/') !== -1) {
    return true;
  }

  // 古いEdge検出（EdgeHTML）
  if (ua.indexOf('Edge/') !== -1) {
    return true;
  }

  return false;
};
```

## 10.10 パフォーマンス最適化

### リフロー抑制

```typescript
const activeSlots = useMemo(() =>
  slots.slice(0, activeSlotsCount),
  [slots, activeSlotsCount]
);
```

### メディアクエリキャッシング

```typescript
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};
```

### CSS transition最適化

```css
/* GPU加速を有効化 */
.sidebarOverlay,
.chatOverlay,
.backdrop {
  will-change: transform, opacity;
}
```

## 10.11 アクセシビリティ

### タッチターゲットサイズ

- **最小サイズ**: 44px × 44px（Appleガイドライン準拠）
- **適用箇所**: モバイルメニューボタン、リロードボタン

### ARIA属性

```typescript
<button
  aria-label="サイドバーを閉じる"
  onClick={() => setSidebarOpen(false)}
>
  <XMarkIcon />
</button>
```

### フォーカス管理

```css
.mobileMenuButton:focus-visible {
  outline: 2px solid rgba(56, 189, 248, 0.8);
  outline-offset: 2px;
}
```

## 10.12 今後の展開

### 計画中の機能

- モバイル版の本番環境リリース
- PWA（Progressive Web App）化
- プッシュ通知対応
- オフライン再生サポート
- モバイル専用ショートカット機能
- スワイプジェスチャー拡張

### 検討中の改善

- タブレット向けチャットパネル復活（オプション）
- 横向き時の4画面表示オプション
- モバイル専用コンパクトモード
- 縦向き時のスクロール最適化
