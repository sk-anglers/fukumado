import React, { useState, useEffect } from 'react';
import './TermsAndPrivacyModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface LegalDocument {
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  content: string;
  type: string;
}

interface TermsAndPrivacyModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const TermsAndPrivacyModal: React.FC<TermsAndPrivacyModalProps> = ({ isOpen, onAccept }) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [privacyScrolled, setPrivacyScrolled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsDocument, setTermsDocument] = useState<LegalDocument | null>(null);
  const [privacyDocument, setPrivacyDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
    }
  }, [isOpen]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/legal/all`, {
        credentials: 'include'
      });
      const data = await response.json();
      setTermsDocument(data.terms);
      setPrivacyDocument(data.privacy);
    } catch (error) {
      console.error('Failed to fetch legal documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isScrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;

    if (isScrolledToBottom) {
      if (activeTab === 'terms') {
        setTermsScrolled(true);
      } else {
        setPrivacyScrolled(true);
      }
    }
  };

  const handleAccept = () => {
    if (termsAccepted && privacyAccepted && termsScrolled && privacyScrolled) {
      onAccept();
    }
  };

  const canAccept = termsAccepted && privacyAccepted && termsScrolled && privacyScrolled;

  if (!isOpen) return null;

  return (
    <div className="terms-modal-overlay">
      <div className="terms-modal">
        <div className="terms-modal-header">
          <h2>利用規約とプライバシーポリシーへの同意</h2>
          <p className="terms-modal-subtitle">
            サービスをご利用いただくには、利用規約とプライバシーポリシーへの同意が必要です。
          </p>
        </div>

        <div className="terms-modal-tabs">
          <button
            className={`terms-tab ${activeTab === 'terms' ? 'active' : ''}`}
            onClick={() => setActiveTab('terms')}
          >
            利用規約
            {termsScrolled && termsAccepted && (
              <span className="tab-check">✓</span>
            )}
          </button>
          <button
            className={`terms-tab ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            プライバシーポリシー
            {privacyScrolled && privacyAccepted && (
              <span className="tab-check">✓</span>
            )}
          </button>
        </div>

        <div className="terms-modal-content" onScroll={handleScroll}>
          {loading ? (
            <div className="terms-loading">読み込み中...</div>
          ) : (
            <>
              {activeTab === 'terms' && termsDocument && (
                <div className="terms-document">
                  <div className="document-meta">
                    <span>バージョン: {termsDocument.version}</span>
                    <span>最終更新: {termsDocument.lastUpdated}</span>
                  </div>
                  <div className="document-content">
                    {termsDocument.content.split('\n').map((line, index) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={index}>{line.substring(2)}</h1>;
                      } else if (line.startsWith('## ')) {
                        return <h2 key={index}>{line.substring(3)}</h2>;
                      } else if (line.trim() === '') {
                        return <br key={index} />;
                      } else {
                        return <p key={index}>{line}</p>;
                      }
                    })}
                  </div>
                  {!termsScrolled && (
                    <div className="scroll-indicator">
                      ↓ 最後までスクロールしてください ↓
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'privacy' && privacyDocument && (
                <div className="terms-document">
                  <div className="document-meta">
                    <span>バージョン: {privacyDocument.version}</span>
                    <span>最終更新: {privacyDocument.lastUpdated}</span>
                  </div>
                  <div className="document-content">
                    {privacyDocument.content.split('\n').map((line, index) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={index}>{line.substring(2)}</h1>;
                      } else if (line.startsWith('## ')) {
                        return <h2 key={index}>{line.substring(3)}</h2>;
                      } else if (line.trim() === '') {
                        return <br key={index} />;
                      } else {
                        return <p key={index}>{line}</p>;
                      }
                    })}
                  </div>
                  {!privacyScrolled && (
                    <div className="scroll-indicator">
                      ↓ 最後までスクロールしてください ↓
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="terms-modal-checkboxes">
          <label className="terms-checkbox-label">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              disabled={!termsScrolled}
            />
            <span className={!termsScrolled ? 'disabled-text' : ''}>
              利用規約を読み、同意します
              {!termsScrolled && ' (最後までスクロールしてください)'}
            </span>
          </label>
          <label className="terms-checkbox-label">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              disabled={!privacyScrolled}
            />
            <span className={!privacyScrolled ? 'disabled-text' : ''}>
              プライバシーポリシーを読み、同意します
              {!privacyScrolled && ' (最後までスクロールしてください)'}
            </span>
          </label>
        </div>

        <div className="terms-modal-footer">
          <button
            className="terms-accept-button"
            onClick={handleAccept}
            disabled={!canAccept}
          >
            同意して続ける
          </button>
          {!canAccept && (
            <p className="terms-footer-hint">
              両方の文書を最後まで読み、チェックボックスにチェックを入れてください
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
