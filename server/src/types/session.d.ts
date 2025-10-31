import 'express-session';

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    twitchOauthState?: string;
    isAdminAuth?: boolean;
    googleTokens?: {
      accessToken: string;
      refreshToken?: string;
      expiryDate: number;
      scope: string;
      tokenType: string;
    };
    googleUser?: {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    twitchTokens?: {
      accessToken: string;
      refreshToken?: string;
      expiryDate: number;
      scope: string[];
      tokenType: string;
    };
    twitchUser?: {
      id: string;
      login: string;
      displayName: string;
      profileImageUrl?: string;
    };
    // StreamSyncService用
    streamSyncUserId?: string;
    streamSyncTokens?: {
      youtube?: string;
      twitch?: string;
    };
    // セッションメタデータ
    createdAt?: string;
    lastActivity?: string;
    ipAddress?: string;
    userAgent?: string;
    // 同意情報
    consent?: {
      hasAcceptedTerms: boolean;
      hasAcceptedPrivacy: boolean;
      essentialCookies: boolean;
      analyticsCookies: boolean;
      marketingCookies: boolean;
      termsVersion: string | null;
      privacyVersion: string | null;
      lastUpdated: Date;
    };
  }
}

// Express名前空間の拡張
declare global {
  namespace Express {
    interface SessionData {
      oauthState?: string;
      twitchOauthState?: string;
      isAdminAuth?: boolean;
      googleTokens?: {
        accessToken: string;
        refreshToken?: string;
        expiryDate: number;
        scope: string;
        tokenType: string;
      };
      googleUser?: {
        id: string;
        email?: string;
        name?: string;
        picture?: string;
      };
      twitchTokens?: {
        accessToken: string;
        refreshToken?: string;
        expiryDate: number;
        scope: string[];
        tokenType: string;
      };
      twitchUser?: {
        id: string;
        login: string;
        displayName: string;
        profileImageUrl?: string;
      };
      streamSyncUserId?: string;
      streamSyncTokens?: {
        youtube?: string;
        twitch?: string;
      };
      // セッションメタデータ
      createdAt?: string;
      lastActivity?: string;
      ipAddress?: string;
      userAgent?: string;
      // 同意情報
      consent?: {
        hasAcceptedTerms: boolean;
        hasAcceptedPrivacy: boolean;
        essentialCookies: boolean;
        analyticsCookies: boolean;
        marketingCookies: boolean;
        termsVersion: string | null;
        privacyVersion: string | null;
        lastUpdated: Date;
      };
    }
  }
}
