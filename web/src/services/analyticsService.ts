import type {
  AnalyticsEvent,
  LayoutChangeEvent,
  ButtonClickEvent,
  FeatureUseEvent,
  StreamActionEvent,
  AuthActionEvent,
  SessionStartEvent,
  SessionEndEvent,
  PageViewEvent,
  LoginButtonClickedEvent,
  StreamSelectedEvent,
  StreamPlaybackStartedEvent,
  FirstStreamPlaybackEvent,
  MultiStreamActiveEvent,
  AuthCompletedEvent,
  LayoutPreset,
  DeviceType,
  ButtonType,
  FeatureType,
  StreamActionType,
  Platform,
  UserType,
  ReferrerType
} from '../types/analytics';
import { backendOrigin } from '../utils/api';

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
 * リファラータイプを判定
 */
function getReferrerType(referrer: string, utmSource?: string, utmMedium?: string): ReferrerType {
  // UTMパラメータがある場合はそれを優先
  if (utmMedium) {
    if (utmMedium === 'cpc' || utmMedium === 'ppc' || utmMedium === 'paid') {
      return 'paid';
    }
    if (utmMedium === 'email') {
      return 'email';
    }
    if (utmMedium === 'social') {
      return 'social';
    }
    if (utmMedium === 'organic') {
      return 'organic';
    }
  }

  // リファラーがない場合はダイレクト
  if (!referrer || referrer === '') {
    return 'direct';
  }

  try {
    const url = new URL(referrer);
    const hostname = url.hostname.toLowerCase();

    // ソーシャルメディア
    const socialDomains = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'reddit.com'];
    if (socialDomains.some(domain => hostname.includes(domain))) {
      return 'social';
    }

    // 検索エンジン
    const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu'];
    if (searchEngines.some(engine => hostname.includes(engine))) {
      return 'organic';
    }

    // メール
    if (hostname.includes('mail') || hostname.includes('email')) {
      return 'email';
    }

    // 自サイトからの遷移はダイレクト扱い
    if (hostname.includes('fukumado.jp')) {
      return 'direct';
    }

    // その他は参照
    return 'referral';
  } catch (e) {
    return 'unknown';
  }
}

/**
 * ユーザータイプを判定
 * localStorageを使用して新規/既存を判定
 */
function getUserType(): UserType {
  const STORAGE_KEY = 'fukumado_user_visits';

  try {
    const visits = localStorage.getItem(STORAGE_KEY);

    if (!visits) {
      // 初回訪問
      localStorage.setItem(STORAGE_KEY, '1');
      return 'new';
    } else {
      // リピーター
      const count = parseInt(visits, 10) || 0;
      localStorage.setItem(STORAGE_KEY, String(count + 1));
      return 'returning';
    }
  } catch (e) {
    // localStorage使えない場合はゲスト扱い
    return 'guest';
  }
}

/**
 * エンゲージメントスコアを計算（0-100）
 * セッション時間、操作回数などから算出
 */
function calculateEngagementScore(sessionDuration: number, eventCount: number): number {
  // セッション時間スコア（0-50点）: 5分で満点
  const timeScore = Math.min(50, (sessionDuration / 300) * 50);

  // イベント数スコア（0-50点）: 10イベントで満点
  const eventScore = Math.min(50, (eventCount / 10) * 50);

  return Math.round(timeScore + eventScore);
}

/**
 * 共通のイベントデータを生成（カスタムディメンション含む）
 */
function createBaseEventData(): {
  timestamp: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  deviceType: DeviceType;
  userType: UserType;
  referrerType: ReferrerType;
  deviceCategory: DeviceType;
  engagementScore?: number;
} {
  const deviceType = getDeviceType();
  const userType = getUserType();

  // URLパラメータからUTM情報を取得
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source') || undefined;
  const utmMedium = urlParams.get('utm_medium') || undefined;

  const referrerType = getReferrerType(document.referrer, utmSource, utmMedium);

  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    deviceType,
    userType,
    referrerType,
    deviceCategory: deviceType,
    // engagementScoreはSessionManagerで計算
  };
}

/**
 * イベントをサーバーに送信
 */
async function sendEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const response = await fetch(`${backendOrigin}/api/analytics/track`, {
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
 * ページビューイベントを送信（ファネル分析用）
 */
export function trackPageView(data: {
  pageLocation: string;
  pageTitle: string;
  screenName: string;
  referrer?: string;
  engagementTimeMsec?: number;
  previousScreen?: string;
}): void {
  const event: PageViewEvent = {
    type: 'page_view',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * ログインボタンクリックイベントを送信（ファネル分析用）
 */
export function trackLoginButtonClick(data: {
  platform: Platform;
  location: string;
}): void {
  const event: LoginButtonClickedEvent = {
    type: 'login_button_clicked',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * 配信選択イベントを送信（ファネル分析用）
 */
export function trackStreamSelected(data: {
  platform: Platform;
  streamId: string;
  streamTitle: string;
  channelName: string;
  channelId: string;
  slotId: string;
  viewerCount?: number;
}): void {
  const event: StreamSelectedEvent = {
    type: 'stream_selected',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * 視聴開始イベントを送信（ファネル分析用）
 */
export function trackStreamPlaybackStarted(data: {
  platform: Platform;
  streamId: string;
  streamTitle: string;
  channelName: string;
  channelId: string;
  slotId: string;
  quality: string;
  activeStreamsCount: number;
}): void {
  const event: StreamPlaybackStartedEvent = {
    type: 'stream_playback_started',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * 初回視聴イベントを送信（コンバージョン）
 */
export function trackFirstStreamPlayback(data: {
  platform: Platform;
  streamId: string;
  channelName: string;
  timeSincePageLoad: number;
}): void {
  const event: FirstStreamPlaybackEvent = {
    type: 'first_stream_playback',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * 複数配信同時視聴イベントを送信（コンバージョン）
 */
export function trackMultiStreamActive(data: {
  streamsCount: number;
  platforms: Platform[];
  timeSinceFirstPlay: number;
}): void {
  const event: MultiStreamActiveEvent = {
    type: 'multi_stream_active',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * 認証完了イベントを送信（コンバージョン）
 */
export function trackAuthCompleted(data: {
  platform: Platform;
  timeSincePageLoad: number;
  hadPreviousAuth: boolean;
}): void {
  const event: AuthCompletedEvent = {
    type: 'auth_completed',
    ...createBaseEventData(),
    data
  };

  sendEvent(event);
}

/**
 * セッション管理クラス（画面遷移追跡付き）
 */
class SessionManager {
  private sessionStartTime: number;
  private pageViews: number;
  private isTracking: boolean;
  private eventCount: number;
  private currentScreen: string | null;
  private currentScreenStartTime: number;
  private firstStreamPlaybackTime: number | null;

  constructor() {
    this.sessionStartTime = Date.now();
    this.pageViews = 0;
    this.isTracking = false;
    this.eventCount = 0;
    this.currentScreen = null;
    this.currentScreenStartTime = Date.now();
    this.firstStreamPlaybackTime = null;
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
    this.eventCount++;
  }

  incrementEventCount(): void {
    this.eventCount++;
  }

  /**
   * 画面遷移を記録
   * 前の画面の滞在時間を返す
   */
  trackScreenChange(screenName: string): { previousScreen: string | null; engagementTimeMsec: number } {
    const previousScreen = this.currentScreen;
    const engagementTimeMsec = previousScreen ? Date.now() - this.currentScreenStartTime : 0;

    this.currentScreen = screenName;
    this.currentScreenStartTime = Date.now();
    this.eventCount++;

    return { previousScreen, engagementTimeMsec };
  }

  /**
   * 初回視聴時刻を記録
   */
  recordFirstStreamPlayback(): void {
    if (!this.firstStreamPlaybackTime) {
      this.firstStreamPlaybackTime = Date.now();
    }
  }

  /**
   * ページ読み込みからの経過時間（秒）
   */
  getTimeSincePageLoad(): number {
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);
  }

  /**
   * 初回視聴からの経過時間（秒）
   */
  getTimeSinceFirstPlay(): number {
    if (!this.firstStreamPlaybackTime) return 0;
    return Math.floor((Date.now() - this.firstStreamPlaybackTime) / 1000);
  }

  /**
   * 現在のエンゲージメントスコアを取得
   */
  getEngagementScore(): number {
    const sessionDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    return calculateEngagementScore(sessionDuration, this.eventCount);
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
