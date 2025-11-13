/**
 * Google Tag Manager (GTM) ヘルパーユーティリティ
 * イベントトラッキングを簡単に実装するための関数群
 */

// イベントパラメータの型定義
export interface GTMEventParams {
  [key: string]: string | number | boolean | undefined;
}

/**
 * GTMイベントを送信
 * @param eventName イベント名
 * @param params イベントパラメータ
 */
export const sendGTMEvent = (eventName: string, params?: GTMEventParams): void => {
  if (typeof window === 'undefined' || !window.dataLayer) {
    console.warn('[GTM] dataLayer is not available');
    return;
  }

  try {
    window.dataLayer.push({
      event: eventName,
      ...params,
    });
    console.log('[GTM] Event sent:', eventName, params);
  } catch (error) {
    console.error('[GTM] Error sending event:', error);
  }
};

/**
 * GA4イベントを送信（gtag経由）
 * @param eventName イベント名
 * @param params イベントパラメータ
 */
export const sendGA4Event = (eventName: string, params?: GTMEventParams): void => {
  if (typeof window === 'undefined' || !window.gtag) {
    console.warn('[GA4] gtag is not available');
    return;
  }

  try {
    window.gtag('event', eventName, params);
    console.log('[GA4] Event sent:', eventName, params);
  } catch (error) {
    console.error('[GA4] Error sending event:', error);
  }
};

/**
 * 統合イベント送信（GTMとGA4の両方に送信）
 * @param eventName イベント名
 * @param params イベントパラメータ
 */
export const trackEvent = (eventName: string, params?: GTMEventParams): void => {
  sendGTMEvent(eventName, params);
  sendGA4Event(eventName, params);
};

// ===================================
// 特定イベント用のヘルパー関数
// ===================================

/**
 * 認証イベントを追跡
 */
export const trackAuth = (action: 'login' | 'logout', platform: 'youtube' | 'twitch', success: boolean = true): void => {
  trackEvent(`auth_${action}`, {
    platform,
    success,
    method: 'oauth',
  });
};

/**
 * レイアウト変更イベントを追跡
 */
export const trackLayoutChange = (preset: string, slotsCount: number): void => {
  trackEvent('layout_change', {
    preset,
    slots_count: slotsCount,
  });
};

/**
 * 配信操作イベントを追跡
 */
export const trackStreamAction = (
  action: 'assign' | 'clear' | 'mute' | 'unmute' | 'quality_change' | 'swap',
  platform?: 'youtube' | 'twitch',
  slotIndex?: number
): void => {
  trackEvent('stream_action', {
    action,
    platform,
    slot_index: slotIndex,
  });
};

/**
 * 同期操作イベントを追跡
 */
export const trackSyncAction = (action: 'start' | 'stop'): void => {
  trackEvent(`sync_${action}`, {
    action,
  });
};

/**
 * ボタンクリックイベントを追跡
 */
export const trackButtonClick = (buttonName: string, additionalParams?: GTMEventParams): void => {
  trackEvent('button_click', {
    button_name: buttonName,
    ...additionalParams,
  });
};

/**
 * チャット操作イベントを追跡
 */
export const trackChatAction = (action: 'open' | 'close', channel?: string): void => {
  trackEvent(`chat_${action}`, {
    action,
    channel,
  });
};

/**
 * 検索イベントを追跡
 */
export const trackSearch = (query: string, resultsCount?: number): void => {
  trackEvent('search', {
    search_term: query,
    results_count: resultsCount,
  });
};

/**
 * フォローイベントを追跡
 */
export const trackFollow = (platform: 'youtube' | 'twitch', channelId: string): void => {
  trackEvent('channel_follow', {
    platform,
    channel_id: channelId,
  });
};

/**
 * エラーイベントを追跡
 */
export const trackError = (errorType: string, errorMessage: string, additionalParams?: GTMEventParams): void => {
  trackEvent('error_occurred', {
    error_type: errorType,
    error_message: errorMessage,
    ...additionalParams,
  });
};

/**
 * ページビューを手動で送信（SPA用）
 */
export const trackPageView = (path: string, title?: string): void => {
  if (typeof window === 'undefined' || !window.gtag) {
    return;
  }

  window.gtag('config', 'G-CNHJ23CY90', {
    page_path: path,
    page_title: title || document.title,
  });
};
