import React, { useState, useEffect } from 'react';
import { TermsAndPrivacyModal } from './TermsAndPrivacyModal';
import { CookieConsentBanner } from './CookieConsentBanner';
import { WelcomeScreen } from './WelcomeScreen/WelcomeScreen';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../utils/api';

interface ConsentStatus {
  hasAcceptedTerms: boolean;
  hasAcceptedPrivacy: boolean;
  essentialCookies: boolean;
  analyticsCookies: boolean;
  marketingCookies: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
  lastUpdated: Date | null;
}

interface ConsentNeeds {
  needsTermsAndPrivacy: boolean;
  needsCookieConsent: boolean;
  reason: string;
}

export const ConsentManager: React.FC = () => {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);
  const [consentNeeds, setConsentNeeds] = useState<ConsentNeeds | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [isAutoAccepting, setIsAutoAccepting] = useState(false);

  const twitchAuthenticated = useAuthStore((state) => state.twitchAuthenticated);
  const twitchLoading = useAuthStore((state) => state.twitchLoading);

  useEffect(() => {
    checkConsentStatus();
  }, []);

  // Twitch認証状態の変化を検知（リロード時に認証済みの場合に対応）
  useEffect(() => {
    // 初回ロード中、Twitch認証状態取得中、または自動同意処理中はスキップ
    if (loading || twitchLoading || isAutoAccepting) {
      console.log('[ConsentManager] Skipping auth change check:', {
        loading,
        twitchLoading,
        isAutoAccepting
      });
      return;
    }

    console.log('[ConsentManager] Twitch auth state changed:', {
      twitchAuthenticated,
      showWelcome,
      showTermsModal
    });

    // 認証状態が変わったら同意状態を再チェック
    checkConsentStatus();
  }, [twitchAuthenticated]);

  const checkConsentStatus = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/consent/status');
      const data = await response.json();

      setConsentStatus(data.status);
      setConsentNeeds(data.needs);

      // フロー判定
      if (data.needs.needsTermsAndPrivacy) {
        // 利用規約同意が必要
        if (!twitchAuthenticated) {
          // 未ログイン → Welcome画面
          setShowWelcome(true);
          setShowTermsModal(false);
        } else {
          // ログイン済みだが規約未同意 → 規約モーダル
          setShowWelcome(false);
          setShowTermsModal(true);
        }
      } else {
        // 利用規約同意済み
        setShowWelcome(false);
        setShowTermsModal(false);
      }

      // Cookieバナーは独立して制御（メイン画面と同時表示可能）
      if (data.needs.needsCookieConsent) {
        setShowCookieBanner(true);
      } else {
        setShowCookieBanner(false);
      }
    } catch (error) {
      console.error('Failed to check consent status:', error);
      // エラー時は未ログインならWelcome表示
      if (!twitchAuthenticated) {
        setShowWelcome(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    console.log('[ConsentManager] Login successful, auto-accepting terms');
    setIsAutoAccepting(true); // 自動同意処理中フラグを立てる
    setShowWelcome(false);
    setShowTermsModal(false); // 規約モーダルは確実に非表示

    // ログイン時点で利用規約・プライバシーポリシーに自動同意
    try {
      console.log('[ConsentManager] Sending auto-consent request...');
      const response = await apiFetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          consents: [
            { type: 'terms', granted: true },
            { type: 'privacy', granted: true }
          ]
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[ConsentManager] Terms auto-accepted successfully:', result);

        // 同意完了後、Cookieバナーの表示判定のみ実行
        console.log('[ConsentManager] Checking if cookie consent is needed...');
        const statusResponse = await apiFetch('/api/consent/status');
        if (statusResponse.ok) {
          const data = await statusResponse.json();
          console.log('[ConsentManager] Consent status after auto-accept:', data);

          // Cookieバナーのみ制御（規約関連は確実に非表示）
          if (data.needs.needsCookieConsent) {
            setShowCookieBanner(true);
          } else {
            setShowCookieBanner(false);
          }
        }
      } else {
        const errorText = await response.text();
        console.error('[ConsentManager] Failed to auto-accept terms:', response.status, errorText);
      }
    } catch (error) {
      console.error('[ConsentManager] Error auto-accepting terms:', error);
    } finally {
      setIsAutoAccepting(false); // 処理完了後、フラグを下ろす
      console.log('[ConsentManager] Auto-accept process completed');
    }
  };

  const handleTermsAccept = async () => {
    try {
      // 利用規約とプライバシーポリシーの同意を記録
      const response = await apiFetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          consents: [
            { type: 'terms', granted: true },
            { type: 'privacy', granted: true }
          ]
        })
      });

      if (response.ok) {
        console.log('[Consent Manager] Terms and privacy accepted');
        setShowTermsModal(false);

        // 同意状態を再チェック（クッキー同意が必要かどうか確認）
        await checkConsentStatus();
      } else {
        console.error('[Consent Manager] Failed to record terms consent');
      }
    } catch (error) {
      console.error('[Consent Manager] Error recording terms consent:', error);
    }
  };

  const handleCookieAccept = async (cookieConsents: {
    essential_cookies: boolean;
    analytics_cookies: boolean;
    marketing_cookies: boolean;
  }) => {
    try {
      // クッキー同意を記録
      const response = await apiFetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          consents: [
            { type: 'essential_cookies', granted: cookieConsents.essential_cookies },
            { type: 'analytics_cookies', granted: cookieConsents.analytics_cookies },
            { type: 'marketing_cookies', granted: cookieConsents.marketing_cookies }
          ]
        })
      });

      if (response.ok) {
        console.log('[Consent Manager] Cookie consent recorded:', cookieConsents);
        setShowCookieBanner(false);

        // 同意状態を更新
        await checkConsentStatus();

        // Analytics初期化（承諾された場合）
        if (cookieConsents.analytics_cookies) {
          initializeAnalytics();
        }

        // マーケティングタグ初期化（承諾された場合）
        if (cookieConsents.marketing_cookies) {
          initializeMarketing();
        }
      } else {
        console.error('[Consent Manager] Failed to record cookie consent');
      }
    } catch (error) {
      console.error('[Consent Manager] Error recording cookie consent:', error);
    }
  };

  const initializeAnalytics = () => {
    // Google Analytics等の初期化コードをここに記述
    console.log('[Consent Manager] Analytics initialized');
    // 例: window.gtag('consent', 'update', { analytics_storage: 'granted' });
  };

  const initializeMarketing = () => {
    // マーケティングタグの初期化コードをここに記述
    console.log('[Consent Manager] Marketing tags initialized');
    // 例: window.gtag('consent', 'update', { ad_storage: 'granted' });
  };

  if (loading) {
    return null; // ローディング中は何も表示しない
  }

  return (
    <>
      {showWelcome && (
        <WelcomeScreen onLoginSuccess={handleLoginSuccess} />
      )}
      <TermsAndPrivacyModal
        isOpen={showTermsModal}
        onAccept={handleTermsAccept}
      />
      <CookieConsentBanner
        isOpen={showCookieBanner}
        onAccept={handleCookieAccept}
      />
    </>
  );
};
