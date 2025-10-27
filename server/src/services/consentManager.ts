/**
 * 同意管理サービス
 * GDPR・個人情報保護法対応のための同意記録・管理
 */

/**
 * 同意タイプ
 */
export type ConsentType = 'terms' | 'privacy' | 'essential_cookies' | 'analytics_cookies' | 'marketing_cookies';

/**
 * 同意記録
 */
export interface ConsentRecord {
  id: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  consents: {
    type: ConsentType;
    granted: boolean;
    version: string; // 同意した文書のバージョン
  }[];
}

/**
 * 同意状態
 */
export interface ConsentStatus {
  hasAcceptedTerms: boolean;
  hasAcceptedPrivacy: boolean;
  essentialCookies: boolean;
  analyticsCookies: boolean;
  marketingCookies: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
  lastUpdated: Date | null;
}

/**
 * 同意管理クラス
 */
export class ConsentManager {
  // セッションID -> 同意記録
  private consentRecords: Map<string, ConsentRecord[]> = new Map();

  // 現在の文書バージョン
  private readonly CURRENT_TERMS_VERSION = '1.0.0';
  private readonly CURRENT_PRIVACY_VERSION = '1.0.0';

  constructor() {
    console.log('[Consent Manager] Initialized');
    this.startPeriodicCleanup();
  }

  /**
   * 同意を記録
   */
  public recordConsent(
    sessionId: string,
    ipAddress: string,
    userAgent: string,
    consents: { type: ConsentType; granted: boolean }[]
  ): ConsentRecord {
    const record: ConsentRecord = {
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
  private getVersionForType(type: ConsentType): string {
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
  public getConsentStatus(sessionId: string): ConsentStatus {
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
    const status: ConsentStatus = {
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
  public needsConsent(sessionId: string): {
    needsTermsAndPrivacy: boolean;
    needsCookieConsent: boolean;
    reason: string;
  } {
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
    if (
      status.termsVersion !== this.CURRENT_TERMS_VERSION ||
      status.privacyVersion !== this.CURRENT_PRIVACY_VERSION
    ) {
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
  public revokeConsent(
    sessionId: string,
    ipAddress: string,
    userAgent: string,
    types: ConsentType[]
  ): ConsentRecord {
    const consents = types.map(type => ({
      type,
      granted: false
    }));

    return this.recordConsent(sessionId, ipAddress, userAgent, consents);
  }

  /**
   * セッションの全同意記録を取得
   */
  public getConsentHistory(sessionId: string): ConsentRecord[] {
    return this.consentRecords.get(sessionId) || [];
  }

  /**
   * 統計情報を取得
   */
  public getStats(): {
    totalSessions: number;
    sessionsWithConsent: number;
    consentRate: number;
    consentsByType: Record<ConsentType, { granted: number; total: number }>;
  } {
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
      } as Record<ConsentType, { granted: number; total: number }>
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
  private cleanup(): void {
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
  private startPeriodicCleanup(): void {
    // 1日ごとにクリーンアップ
    setInterval(() => {
      this.cleanup();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * 現在の文書バージョンを取得
   */
  public getCurrentVersions(): {
    terms: string;
    privacy: string;
  } {
    return {
      terms: this.CURRENT_TERMS_VERSION,
      privacy: this.CURRENT_PRIVACY_VERSION
    };
  }

  /**
   * GDPR準拠のデータエクスポート
   * ユーザーが自分の同意記録を要求した場合
   */
  public exportConsentData(sessionId: string): {
    sessionId: string;
    records: ConsentRecord[];
    currentStatus: ConsentStatus;
    exportedAt: Date;
  } {
    return {
      sessionId,
      records: this.getConsentHistory(sessionId),
      currentStatus: this.getConsentStatus(sessionId),
      exportedAt: new Date()
    };
  }
}

// シングルトンインスタンス
export const consentManager = new ConsentManager();
