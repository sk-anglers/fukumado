import type {
  AnalyticsEvent,
  LayoutChangeEvent,
  ButtonClickEvent,
  FeatureUseEvent,
  StreamActionEvent,
  AuthActionEvent,
  SessionStartEvent,
  SessionEndEvent,
  LayoutPreset,
  DeviceType,
  ButtonType,
  FeatureType,
  StreamActionType,
  Platform
} from '../types/analytics';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * デバイスタイプを判定
 */
function getDeviceType(): DeviceType {
  const width = window.innerWidth;

  if (width < 768) {
    return 'mobile';
  } else if (width < 1024) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * 共通のイベントデータを生成
 */
function createBaseEventData(): {
  timestamp: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  deviceType: DeviceType;
} {
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    deviceType: getDeviceType()
  };
}

/**
 * イベントをサーバーに送信
 */
async function sendEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event),
      credentials: 'include' // セッションCookieを含める
    });

    if (!response.ok) {
      console.error('[Analytics] Failed to send event:', response.statusText);
    }
  } catch (error) {
    // ネットワークエラーなどでも分析を妨げないように、エラーは静かに処理
    console.debug('[Analytics] Error sending event:', error);
  }
}

/**
 * レイアウト変更イベントを送信
 */
export function trackLayoutChange(data: {
  slotsCount: number;
  preset: LayoutPreset;
  previousSlotsCount?: number;
  previousPreset?: LayoutPreset;
}): void {
  const event: LayoutChangeEvent = {
    type: 'layout_change',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * ボタンクリックイベントを送信
 */
export function trackButtonClick(data: {
  buttonType: ButtonType;
  location?: string;
}): void {
  const event: ButtonClickEvent = {
    type: 'button_click',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * 機能使用イベントを送信
 */
export function trackFeatureUse(data: {
  featureType: FeatureType;
  platform?: Platform;
  duration?: number;
}): void {
  const event: FeatureUseEvent = {
    type: 'feature_use',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * 配信操作イベントを送信
 */
export function trackStreamAction(data: {
  actionType: StreamActionType;
  platform: Platform;
  slotId?: string;
  value?: number;
}): void {
  const event: StreamActionEvent = {
    type: 'stream_action',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * 認証操作イベントを送信
 */
export function trackAuthAction(data: {
  platform: Platform;
  action: 'login' | 'logout';
  success: boolean;
}): void {
  const event: AuthActionEvent = {
    type: 'auth_action',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * セッション開始イベントを送信
 */
export function trackSessionStart(data?: {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}): void {
  const event: SessionStartEvent = {
    type: 'session_start',
    ...createBaseEventData(),
    data: data || {}
  };

  sendEvent(event);
}

/**
 * セッション終了イベントを送信
 */
export function trackSessionEnd(data: {
  duration: number;
  pageViews: number;
}): void {
  const event: SessionEndEvent = {
    type: 'session_end',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * セッション管理クラス
 */
class SessionManager {
  private sessionStartTime: number;
  private pageViews: number;
  private isTracking: boolean;

  constructor() {
    this.sessionStartTime = Date.now();
    this.pageViews = 0;
    this.isTracking = false;
  }

  start(): void {
    if (this.isTracking) return;

    this.isTracking = true;
    this.sessionStartTime = Date.now();
    this.pageViews = 1;

    // URLパラメータからUTM情報を取得
    const urlParams = new URLSearchParams(window.location.search);
    const utmData = {
      referrer: document.referrer || undefined,
      utmSource: urlParams.get('utm_source') || undefined,
      utmMedium: urlParams.get('utm_medium') || undefined,
      utmCampaign: urlParams.get('utm_campaign') || undefined
    };

    trackSessionStart(utmData);

    // ページ離脱時にセッション終了を記録
    window.addEventListener('beforeunload', () => this.end());
  }

  incrementPageView(): void {
    this.pageViews++;
  }

  end(): void {
    if (!this.isTracking) return;

    const duration = Date.now() - this.sessionStartTime;
    trackSessionEnd({
      duration,
      pageViews: this.pageViews
    });

    this.isTracking = false;
  }
}

// セッション管理のシングルトンインスタンス
export const sessionManager = new SessionManager();
