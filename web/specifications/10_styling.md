# 10. スタイリング・デザインシステム

このセクションでは、ふくまど！のスタイリング手法とデザインシステムについて説明します。

## 10.1 スタイル手法
- **CSS Modules**: コンポーネントごとに `.module.css` ファイル
- **命名規則**: BEM風（`.componentName`, `.componentName__element`, `.componentName--modifier`）
- **スコープ**: コンポーネント単位でスタイルをカプセル化

### CSS Modules の使用例
```typescript
// Header.tsx
import styles from './Header.module.css';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.header__logo}>ふくまど！</div>
      <button className={styles.header__button}>設定</button>
    </header>
  );
};
```

```css
/* Header.module.css */
.header {
  background-color: var(--bg-white);
  padding: 1rem;
}

.header__logo {
  font-size: 1.5rem;
  color: var(--primary-blue);
}

.header__button {
  background-color: var(--primary-blue);
  color: white;
}
```

## 10.2 ブランドカラー

アングラーズのブランドカラーに準拠：

```css
/* プライマリ */
--primary-blue: #3498DB;        /* メインブランドカラー */
--accent-blue: #0078C4;         /* 強調表示、ホバー */

/* 背景 */
--bg-light-gray: #EEEEEE;       /* 全体背景 */
--bg-white: #FFFFFF;            /* カードコンテンツ背景 */

/* テキスト */
--text-main: #323130;           /* メインテキスト */
--text-sub: #605e5c;            /* サブテキスト */

/* ボーダー・区切り */
--border-light: #edebe9;        /* 軽いグレー */

/* ホバー */
--hover-bg: #e1dfdd;            /* リソースリンクホバー */
```

### カラーパレット使用例

| 要素 | カラー | 用途 |
|---|---|---|
| ボタン（プライマリ） | `--primary-blue` | メインアクション |
| ボタン（ホバー） | `--accent-blue` | マウスオーバー時 |
| 背景 | `--bg-light-gray` | アプリ全体の背景 |
| カード | `--bg-white` | コンテンツカード |
| テキスト | `--text-main` | メインテキスト |
| 補足テキスト | `--text-sub` | 説明文、メタ情報 |

## 10.3 カスタムプロパティ（CSS Variables）

### 動的なアクセントカラー
```css
.slot {
  --accent-color: rgba(56, 189, 248, 0.35); /* 動的に設定 */
  border: 2px solid var(--accent-color);
}

.slot--selected {
  --accent-color: rgba(56, 189, 248, 0.8);
}
```

### レスポンシブな余白
```css
:root {
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
}

.container {
  padding: var(--spacing-md);
}

@media (min-width: 768px) {
  .container {
    padding: var(--spacing-lg);
  }
}
```

## 10.4 レスポンシブ対応

### ブレークポイント
```css
/* モバイル: 〜767px */
@media (max-width: 767px) {
  .header {
    flex-direction: column;
  }
}

/* タブレット: 768px〜1023px */
@media (min-width: 768px) and (max-width: 1023px) {
  .sidebar {
    width: 200px;
  }
}

/* デスクトップ: 1024px〜 */
@media (min-width: 1024px) {
  .sidebar {
    width: 300px;
  }
}
```

### 現状の対応状況
- ✅ 一部モバイル対応済み（ChatPanel、Sidebar、EmotePicker）
- ⚠️ 全体的なレスポンシブデザインは未対応
- 📝 今後の課題: 完全なレスポンシブ対応の実装

## 10.5 アニメーション・トランジション

### ホバーエフェクト
```css
.button {
  background-color: var(--primary-blue);
  transition: background-color 0.2s ease;
}

.button:hover {
  background-color: var(--accent-blue);
}
```

### フェードイン
```css
.toast {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### スライドイン
```css
.modal {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
```

## 10.6 タイポグラフィ

### フォントファミリー
```css
:root {
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-family-mono: "Courier New", Courier, monospace;
}

body {
  font-family: var(--font-family);
}
```

### フォントサイズ
```css
:root {
  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-md: 1rem;      /* 16px */
  --font-size-lg: 1.25rem;   /* 20px */
  --font-size-xl: 1.5rem;    /* 24px */
}

h1 {
  font-size: var(--font-size-xl);
  font-weight: 700;
}

p {
  font-size: var(--font-size-md);
  line-height: 1.6;
}
```

## 10.7 アイコン

### Heroicons の使用
```typescript
import { ChatBubbleLeftIcon, MicrophoneIcon } from '@heroicons/react/24/outline';

const Header = () => {
  return (
    <div>
      <ChatBubbleLeftIcon className="w-6 h-6" />
      <MicrophoneIcon className="w-6 h-6 text-primary-blue" />
    </div>
  );
};
```

### サイズクラス
- `w-4 h-4`: 16px
- `w-5 h-5`: 20px
- `w-6 h-6`: 24px
- `w-8 h-8`: 32px

## 10.8 Utility Classes

### clsx の使用
```typescript
import clsx from 'clsx';

const Button = ({ primary, disabled }) => {
  return (
    <button
      className={clsx(
        'button',
        primary && 'button--primary',
        disabled && 'button--disabled'
      )}
    >
      Click me
    </button>
  );
};
```

## 10.9 グリッドレイアウト

### StreamGrid のグリッド
```css
.streamGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.streamGrid--oneByTwo {
  grid-template-columns: 2fr 1fr;
}

.streamGrid--focus {
  grid-template-columns: 1fr;
}
```

## 10.10 Z-Index 管理

```css
:root {
  --z-index-dropdown: 1000;
  --z-index-modal: 2000;
  --z-index-toast: 3000;
  --z-index-tooltip: 4000;
}

.dropdown {
  z-index: var(--z-index-dropdown);
}

.modal {
  z-index: var(--z-index-modal);
}
```

## 10.11 アクセシビリティ

### フォーカススタイル
```css
.button:focus-visible {
  outline: 2px solid var(--primary-blue);
  outline-offset: 2px;
}
```

### スクリーンリーダー専用テキスト
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## 10.12 ダークモード（将来の実装）

### CSS Variables の切り替え
```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #323130;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --text-primary: #e5e5e5;
  }
}
```

### JavaScript での切り替え
```typescript
const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark');
};
```

## 10.13 デザインシステムのベストプラクティス

### 一貫性の維持
- ブランドカラーを厳守
- 統一されたタイポグラフィ
- 再利用可能なコンポーネント

### パフォーマンス
- CSS Modulesによるツリーシェイキング
- 未使用スタイルの自動削除

### メンテナンス性
- CSS Variablesで一元管理
- コンポーネント単位のスタイリング
- BEM風の明確な命名規則
