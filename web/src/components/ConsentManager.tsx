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
  const [isAutoAccepting, setIsAutoAccepting] = useState(false);

  const twitchAuthenticated = useAuthStore((state) => state.twitchAuthenticated);
  const twitchLoading = useAuthStore((state) => state.twitchLoading);

  // ===== 派生状態（Derived State）: 表示制御を計算プロパティにする =====
  const shouldShowWelcome =
    !loading &&
    !twitchLoading &&
    !twitchAuthenticated &&
    consentNeeds?.needsTermsAndPrivacy === true &&
    !isAutoAccepting;

  const shouldShowTermsModal =
    !loading &&
    !twitchLoading &&
    twitchAuthenticated &&
    consentNeeds?.needsTermsAndPrivacy === true &&
    !isAutoAccepting;

  const shouldShowCookieBanner =
    !loading &&
    consentNeeds?.needsCookieConsent === true;

  // ===== 初回マウント時のみ同意状態を取得 =====
  useEffect(() => {
    fetchConsentStatus();
  }, []);

  const fetchConsentStatus = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/consent/status');
      const data = await response.json();

      console.log('[ConsentManager] Consent status fetched:', {
        needs: data.needs,
        twitchAuthenticated
      });

      setConsentStatus(data.status);
      setConsentNeeds(data.needs);
    } catch (error) {
      console.error('[ConsentManager] Failed to fetch consent status:', error);
      // エラー時はデフォルトで同意が必要と判断
      setConsentNeeds({
        needsTermsAndPrivacy: true,
        needsCookieConsent: true,
        reason: 'Error fetching consent status'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    console.log('[ConsentManager] Login successful, starting auto-consent process');
    setIsAutoAccepting(true);

    try {
      // 利用規約・プライバシーポリシーに自動同意
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

        // 同意状態を再取得（派生状態が自動的に更新される）
        console.log('[ConsentManager] Fetching updated consent status...');
        const statusResponse = await apiFetch('/api/consent/status');
        if (statusResponse.ok) {
          const data = await statusResponse.json();
          console.log('[ConsentManager] Updated consent status:', data);
          setConsentNeeds(data.needs);
        }
      } else {
        const errorText = await response.text();
        console.error('[ConsentManager] Failed to auto-accept terms:', response.status, errorText);
      }
    } catch (error) {
      console.error('[ConsentManager] Error during auto-consent:', error);
    } finally {
      setIsAutoAccepting(false);
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
        console.log('[ConsentManager] Terms and privacy accepted');
        // 同意状態を再取得（派生状態が自動的に更新される）
        await fetchConsentStatus();
      } else {
        console.error('[ConsentManager] Failed to record terms consent');
      }
    } catch (error) {
      console.error('[ConsentManager] Error recording terms consent:', error);
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
        console.log('[ConsentManager] Cookie consent recorded:', cookieConsents);

        // 同意状態を再取得（派生状態が自動的に更新される）
        await fetchConsentStatus();

        // Analytics初期化（承諾された場合）
        if (cookieConsents.analytics_cookies) {
          initializeAnalytics();
        }

        // マーケティングタグ初期化（承諾された場合）
        if (cookieConsents.marketing_cookies) {
          initializeMarketing();
        }
      } else {
        console.error('[ConsentManager] Failed to record cookie consent');
      }
    } catch (error) {
      console.error('[ConsentManager] Error recording cookie consent:', error);
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

  // ローディング中は何も表示しない
  if (loading || twitchLoading) {
    return null;
  }

  console.log('[ConsentManager] Render state:', {
    shouldShowWelcome,
    shouldShowTermsModal,
    shouldShowCookieBanner,
    twitchAuthenticated,
    needsTermsAndPrivacy: consentNeeds?.needsTermsAndPrivacy,
    needsCookieConsent: consentNeeds?.needsCookieConsent,
    isAutoAccepting
  });

  return (
    <>
      {shouldShowWelcome && (
        <WelcomeScreen onLoginSuccess={handleLoginSuccess} />
      )}
      <TermsAndPrivacyModal
        isOpen={shouldShowTermsModal}
        onAccept={handleTermsAccept}
      />
      <CookieConsentBanner
        isOpen={shouldShowCookieBanner}
        onAccept={handleCookieAccept}
      />
    </>
  );
};
