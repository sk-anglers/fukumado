import { useEffect, useRef, useCallback } from 'react';
import {
  trackLayoutChange,
  trackButtonClick,
  trackFeatureUse,
  trackStreamAction,
  trackAuthAction,
  sessionManager
} from '../services/analyticsService';
import type {
  LayoutPreset,
  ButtonType,
  FeatureType,
  StreamActionType,
  Platform
} from '../types/analytics';

/**
 * アナリティクストラッキング用のReact Hook
 */
export function useAnalytics() {
  const isInitialized = useRef(false);

  // セッション開始（アプリ起動時に1度だけ）
  useEffect(() => {
    if (!isInitialized.current) {
      sessionManager.start();
      isInitialized.current = true;
    }
  }, []);

  // 画面遷移を監視（popstate/hashchange）
  useEffect(() => {
    const handleNavigation = () => {
      sessionManager.incrementPageView();
    };

    // ブラウザの戻る/進むボタンを監視
    window.addEventListener('popstate', handleNavigation);
    // hash変更を監視
    window.addEventListener('hashchange', handleNavigation);

    return () => {
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('hashchange', handleNavigation);
    };
  }, []);

  // レイアウト変更を追跡
  const trackLayout = useCallback((data: {
    slotsCount: number;
    preset: LayoutPreset;
    previousSlotsCount?: number;
    previousPreset?: LayoutPreset;
  }) => {
    trackLayoutChange(data);
  }, []);

  // ボタンクリックを追跡
  const trackButton = useCallback((buttonType: ButtonType, location?: string) => {
    trackButtonClick({ buttonType, location });
  }, []);

  // 機能使用を追跡
  const trackFeature = useCallback((
    featureType: FeatureType,
    platform?: Platform,
    duration?: number
  ) => {
    trackFeatureUse({ featureType, platform, duration });
  }, []);

  // 配信操作を追跡
  const trackStream = useCallback((data: {
    actionType: StreamActionType;
    platform: Platform;
    slotId?: string;
    value?: number;
  }) => {
    trackStreamAction(data);
  }, []);

  // 認証操作を追跡
  const trackAuth = useCallback((
    platform: Platform,
    action: 'login' | 'logout',
    success: boolean
  ) => {
    trackAuthAction({ platform, action, success });
  }, []);

  return {
    trackLayout,
    trackButton,
    trackFeature,
    trackStream,
    trackAuth
  };
}

/**
 * レイアウト変更を自動追跡するHook
 */
export function useLayoutTracking(slotsCount: number, preset: LayoutPreset) {
  const prevSlotsCount = useRef<number>(slotsCount);
  const prevPreset = useRef<LayoutPreset>(preset);
  const { trackLayout } = useAnalytics();

  useEffect(() => {
    // 初回レンダリング時はスキップ
    if (prevSlotsCount.current === slotsCount && prevPreset.current === preset) {
      return;
    }

    // レイアウト変更を記録
    trackLayout({
      slotsCount,
      preset,
      previousSlotsCount: prevSlotsCount.current,
      previousPreset: prevPreset.current
    });

    // 現在の値を保存
    prevSlotsCount.current = slotsCount;
    prevPreset.current = preset;
  }, [slotsCount, preset, trackLayout]);
}

/**
 * 機能使用時間を計測するHook
 */
export function useFeatureTimer(featureType: FeatureType, platform?: Platform) {
  const startTime = useRef<number>(Date.now());
  const { trackFeature } = useAnalytics();

  useEffect(() => {
    startTime.current = Date.now();

    return () => {
      const duration = Date.now() - startTime.current;
      trackFeature(featureType, platform, duration);
    };
  }, [featureType, platform, trackFeature]);
}
