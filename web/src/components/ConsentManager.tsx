import React, { useState, useEffect } from 'react';
import { TermsAndPrivacyModal } from './TermsAndPrivacyModal';
import { CookieConsentBanner } from './CookieConsentBanner';

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
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  useEffect(() => {
    checkConsentStatus();
  }, []);

  const checkConsentStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:4000/api/consent/status', {
        credentials: 'include'
      });
      const data = await response.json();

      setConsentStatus(data.status);
      setConsentNeeds(data.needs);

      // 同意が必要な場合、モーダル/バナーを表示
      if (data.needs.needsTermsAndPrivacy) {
        setShowTermsModal(true);
      } else if (data.needs.needsCookieConsent) {
        setShowCookieBanner(true);
      }
    } catch (error) {
      console.error('Failed to check consent status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTermsAccept = async () => {
    try {
      // 利用規約とプライバシーポリシーの同意を記録
      const response = await fetch('http://localhost:4000/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
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
      const response = await fetch('http://localhost:4000/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
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
