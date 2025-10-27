import React, { useState } from 'react';
import './CookieConsentBanner.css';

interface CookieConsentBannerProps {
  isOpen: boolean;
  onAccept: (consents: {
    essential_cookies: boolean;
    analytics_cookies: boolean;
    marketing_cookies: boolean;
  }) => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ isOpen, onAccept }) => {
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsCookies, setAnalyticsCookies] = useState(true);
  const [marketingCookies, setMarketingCookies] = useState(true);

  const handleAcceptAll = () => {
    onAccept({
      essential_cookies: true,
      analytics_cookies: true,
      marketing_cookies: true
    });
  };

  const handleAcceptSelected = () => {
    onAccept({
      essential_cookies: true,
      analytics_cookies: analyticsCookies,
      marketing_cookies: marketingCookies
    });
  };

  const handleRejectAll = () => {
    onAccept({
      essential_cookies: true,
      analytics_cookies: false,
      marketing_cookies: false
    });
  };

  if (!isOpen) return null;

  return (
    <div className="cookie-banner-overlay">
      <div className="cookie-banner">
        <div className="cookie-banner-content">
          <h3 className="cookie-banner-title">🍪 クッキーの使用について</h3>
          <p className="cookie-banner-text">
            当サービスでは、サービスの向上と最適な体験を提供するためにクッキーを使用しています。
            必須クッキーはサービスの基本機能に必要ですが、分析・マーケティングクッキーは任意です。
          </p>

          {showCustomize && (
            <div className="cookie-options">
              <div className="cookie-option">
                <div className="cookie-option-header">
                  <input
                    type="checkbox"
                    id="essential-cookies"
                    checked={true}
                    disabled={true}
                  />
                  <label htmlFor="essential-cookies">
                    <strong>必須クッキー</strong>
                    <span className="required-badge">必須</span>
                  </label>
                </div>
                <p className="cookie-option-description">
                  認証、セキュリティ、基本機能に必要なクッキーです。これらは無効にできません。
                </p>
              </div>

              <div className="cookie-option">
                <div className="cookie-option-header">
                  <input
                    type="checkbox"
                    id="analytics-cookies"
                    checked={analyticsCookies}
                    onChange={(e) => setAnalyticsCookies(e.target.checked)}
                  />
                  <label htmlFor="analytics-cookies">
                    <strong>分析クッキー</strong>
                    <span className="optional-badge">任意</span>
                  </label>
                </div>
                <p className="cookie-option-description">
                  サービスの利用状況を分析し、改善に役立てるためのクッキーです（Google Analytics等）。
                </p>
              </div>

              <div className="cookie-option">
                <div className="cookie-option-header">
                  <input
                    type="checkbox"
                    id="marketing-cookies"
                    checked={marketingCookies}
                    onChange={(e) => setMarketingCookies(e.target.checked)}
                  />
                  <label htmlFor="marketing-cookies">
                    <strong>マーケティングクッキー</strong>
                    <span className="optional-badge">任意</span>
                  </label>
                </div>
                <p className="cookie-option-description">
                  パーソナライズされた広告や関連性の高いコンテンツを提供するためのクッキーです。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="cookie-banner-actions">
          {!showCustomize ? (
            <>
              <button className="cookie-button cookie-button-primary" onClick={handleAcceptAll}>
                すべて許可
              </button>
              <button className="cookie-button cookie-button-secondary" onClick={() => setShowCustomize(true)}>
                カスタマイズ
              </button>
              <button className="cookie-button cookie-button-tertiary" onClick={handleRejectAll}>
                必須のみ許可
              </button>
            </>
          ) : (
            <>
              <button className="cookie-button cookie-button-primary" onClick={handleAcceptSelected}>
                選択を保存
              </button>
              <button className="cookie-button cookie-button-secondary" onClick={() => setShowCustomize(false)}>
                戻る
              </button>
            </>
          )}
        </div>

        <p className="cookie-banner-footer">
          詳細は<a href="/privacy-policy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>をご確認ください
        </p>
      </div>
    </div>
  );
};
