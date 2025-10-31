/**
 * アプリケーション設定
 * 環境変数から読み込まれる設定値を管理
 */

export const config = {
  /**
   * YouTube機能の有効/無効
   * .envでVITE_ENABLE_YOUTUBE=trueに設定すると有効化
   */
  enableYoutube: import.meta.env.VITE_ENABLE_YOUTUBE === 'true',

  /**
   * ニコニコ動画機能の有効/無効
   * .envでVITE_ENABLE_NICONICO=trueに設定すると有効化
   */
  enableNiconico: import.meta.env.VITE_ENABLE_NICONICO === 'true',

  /**
   * ベータ環境かどうか
   * .envでVITE_IS_BETA=trueに設定するとベータ環境として動作
   * ベータ環境ではモバイル制限がかからない
   */
  isBeta: import.meta.env.VITE_IS_BETA === 'true'
} as const;
