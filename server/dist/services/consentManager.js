"use strict";
/**
 * 同意管理サービス
 * GDPR・個人情報保護法対応のための同意記録・管理
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.consentManager = exports.ConsentManager = void 0;
/**
 * 同意管理クラス
 */
class ConsentManager {
    constructor() {
        // セッションID -> 同意記録
        this.consentRecords = new Map();
        // 現在の文書バージョン
        this.CURRENT_TERMS_VERSION = '1.0.0';
        this.CURRENT_PRIVACY_VERSION = '1.0.0';
        console.log('[Consent Manager] Initialized');
        this.startPeriodicCleanup();
    }
    /**
     * 同意を記録
     */
    recordConsent(sessionId, ipAddress, userAgent, consents) {
        const record = {
            id: `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sessionId,
            ipAddress,
            userAgent,
            timestamp: new Date(),
            consents: consents.map(c => ({
                ...c,
                version: this.getVersionForType(c.type)
            }))
        };
        // セッションの記録を取得または作成
        const records = this.consentRecords.get(sessionId) || [];
        records.push(record);
        this.consentRecords.set(sessionId, records);
        console.log('[Consent Manager] Consent recorded:', {
            sessionId: sessionId.substring(0, 8),
            consents: consents.map(c => `${c.type}:${c.granted}`).join(', ')
        });
        return record;
    }
    /**
     * 同意タイプに対応するバージョンを取得
     */
    getVersionForType(type) {
        switch (type) {
            case 'terms':
                return this.CURRENT_TERMS_VERSION;
            case 'privacy':
                return this.CURRENT_PRIVACY_VERSION;
            default:
                return '1.0.0';
        }
    }
    /**
     * セッションの同意状態を取得
     */
    getConsentStatus(sessionId) {
        const records = this.consentRecords.get(sessionId) || [];
        if (records.length === 0) {
            return {
                hasAcceptedTerms: false,
                hasAcceptedPrivacy: false,
                essentialCookies: false,
                analyticsCookies: false,
                marketingCookies: false,
                termsVersion: null,
                privacyVersion: null,
                lastUpdated: null
            };
        }
        // 最新の記録から同意状態を構築
        const latestRecord = records[records.length - 1];
        const status = {
            hasAcceptedTerms: false,
            hasAcceptedPrivacy: false,
            essentialCookies: false,
            analyticsCookies: false,
            marketingCookies: false,
            termsVersion: null,
            privacyVersion: null,
            lastUpdated: latestRecord.timestamp
        };
        // すべての記録から最新の同意状態を取得
        for (const record of records) {
            for (const consent of record.consents) {
                switch (consent.type) {
                    case 'terms':
                        status.hasAcceptedTerms = consent.granted;
                        status.termsVersion = consent.version;
                        break;
                    case 'privacy':
                        status.hasAcceptedPrivacy = consent.granted;
                        status.privacyVersion = consent.version;
                        break;
                    case 'essential_cookies':
                        status.essentialCookies = consent.granted;
                        break;
                    case 'analytics_cookies':
                        status.analyticsCookies = consent.granted;
                        break;
                    case 'marketing_cookies':
                        status.marketingCookies = consent.granted;
                        break;
                }
            }
        }
        return status;
    }
    /**
     * 同意が必要かチェック
     */
    needsConsent(sessionId) {
        const status = this.getConsentStatus(sessionId);
        // 利用規約・プライバシーポリシーの同意が必要
        if (!status.hasAcceptedTerms || !status.hasAcceptedPrivacy) {
            return {
                needsTermsAndPrivacy: true,
                needsCookieConsent: false,
                reason: 'Terms and privacy policy not accepted'
            };
        }
        // バージョンが更新されている場合
        if (status.termsVersion !== this.CURRENT_TERMS_VERSION ||
            status.privacyVersion !== this.CURRENT_PRIVACY_VERSION) {
            return {
                needsTermsAndPrivacy: true,
                needsCookieConsent: false,
                reason: 'Terms or privacy policy version updated'
            };
        }
        // クッキー同意が必要
        if (!status.essentialCookies) {
            return {
                needsTermsAndPrivacy: false,
                needsCookieConsent: true,
                reason: 'Cookie consent not given'
            };
        }
        return {
            needsTermsAndPrivacy: false,
            needsCookieConsent: false,
            reason: 'All consents granted'
        };
    }
    /**
     * 同意を撤回
     */
    revokeConsent(sessionId, ipAddress, userAgent, types) {
        const consents = types.map(type => ({
            type,
            granted: false
        }));
        return this.recordConsent(sessionId, ipAddress, userAgent, consents);
    }
    /**
     * セッションの全同意記録を取得
     */
    getConsentHistory(sessionId) {
        return this.consentRecords.get(sessionId) || [];
    }
    /**
     * 統計情報を取得
     */
    getStats() {
        const stats = {
            totalSessions: this.consentRecords.size,
            sessionsWithConsent: 0,
            consentRate: 0,
            consentsByType: {
                terms: { granted: 0, total: 0 },
                privacy: { granted: 0, total: 0 },
                essential_cookies: { granted: 0, total: 0 },
                analytics_cookies: { granted: 0, total: 0 },
                marketing_cookies: { granted: 0, total: 0 }
            }
        };
        for (const [sessionId, records] of this.consentRecords) {
            const status = this.getConsentStatus(sessionId);
            if (status.hasAcceptedTerms && status.hasAcceptedPrivacy) {
                stats.sessionsWithConsent++;
            }
            // 各タイプの同意数をカウント
            for (const record of records) {
                for (const consent of record.consents) {
                    stats.consentsByType[consent.type].total++;
                    if (consent.granted) {
                        stats.consentsByType[consent.type].granted++;
                    }
                }
            }
        }
        stats.consentRate = stats.totalSessions > 0
            ? (stats.sessionsWithConsent / stats.totalSessions) * 100
            : 0;
        return stats;
    }
    /**
     * 古い記録をクリーンアップ（30日以上前）
     */
    cleanup() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        let removedCount = 0;
        for (const [sessionId, records] of this.consentRecords) {
            // 最新の記録が30日以上前の場合、セッション全体を削除
            const latestRecord = records[records.length - 1];
            if (latestRecord.timestamp < thirtyDaysAgo) {
                this.consentRecords.delete(sessionId);
                removedCount++;
            }
        }
        if (removedCount > 0) {
            console.log(`[Consent Manager] Cleaned up ${removedCount} old consent records`);
        }
    }
    /**
     * 定期的なクリーンアップを開始
     */
    startPeriodicCleanup() {
        // 1日ごとにクリーンアップ
        setInterval(() => {
            this.cleanup();
        }, 24 * 60 * 60 * 1000);
    }
    /**
     * 現在の文書バージョンを取得
     */
    getCurrentVersions() {
        return {
            terms: this.CURRENT_TERMS_VERSION,
            privacy: this.CURRENT_PRIVACY_VERSION
        };
    }
    /**
     * GDPR準拠のデータエクスポート
     * ユーザーが自分の同意記録を要求した場合
     */
    exportConsentData(sessionId) {
        return {
            sessionId,
            records: this.getConsentHistory(sessionId),
            currentStatus: this.getConsentStatus(sessionId),
            exportedAt: new Date()
        };
    }
}
exports.ConsentManager = ConsentManager;
// シングルトンインスタンス
exports.consentManager = new ConsentManager();
//# sourceMappingURL=consentManager.js.map