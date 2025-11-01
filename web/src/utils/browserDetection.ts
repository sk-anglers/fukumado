/**
 * ブラウザ判定ユーティリティ
 */

/**
 * Safariブラウザかどうかを判定
 * @returns Safari（iOS Safari含む）の場合true
 */
export const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;

  const ua = window.navigator.userAgent.toLowerCase();

  // Safari判定
  // - 'safari'を含む
  // - 'chrome'や'chromium'を含まない（ChromeのUAにもsafariが含まれるため）
  const hasSafari = ua.includes('safari');
  const hasChrome = ua.includes('chrome') || ua.includes('chromium') || ua.includes('crios');

  return hasSafari && !hasChrome;
};

/**
 * iOS（iPhone、iPad）かどうかを判定
 * @returns iOSの場合true
 */
export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;

  const ua = window.navigator.userAgent.toLowerCase();

  return /iphone|ipad|ipod/.test(ua);
};

/**
 * iOS Safariかどうかを判定
 * @returns iOS Safariの場合true
 */
export const isIOSSafari = (): boolean => {
  return isIOS() && isSafari();
};
