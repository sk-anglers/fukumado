/**
 * デバッグログ用ユーティリティ
 * 高精度タイムスタンプ付きログを提供
 */

let sessionStartTime = performance.now();

/**
 * セッション開始からの経過時間（ミリ秒）を取得
 */
export function getElapsedTime(): number {
  return performance.now() - sessionStartTime;
}

/**
 * 高精度タイムスタンプを含むフォーマット済み時刻文字列を取得
 * 例: "12:34:56.789 (+1234.567ms)"
 */
export function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const elapsed = getElapsedTime().toFixed(3);

  return `${hours}:${minutes}:${seconds}.${milliseconds} (+${elapsed}ms)`;
}

/**
 * タイムスタンプ付きログを出力（通常ログ）
 */
export function debugLog(prefix: string, ...args: any[]): void {
  console.log(`[${getTimestamp()}] ${prefix}`, ...args);
}

/**
 * タイムスタンプ付きログを出力（警告）
 */
export function debugWarn(prefix: string, ...args: any[]): void {
  console.warn(`[${getTimestamp()}] ${prefix}`, ...args);
}

/**
 * タイムスタンプ付きログを出力（エラー）
 */
export function debugError(prefix: string, ...args: any[]): void {
  console.error(`[${getTimestamp()}] ${prefix}`, ...args);
}

/**
 * セッション開始時刻をリセット（テスト用）
 */
export function resetSessionStartTime(): void {
  sessionStartTime = performance.now();
}
