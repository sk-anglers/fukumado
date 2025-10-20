import 'express-session';

declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    twitchOauthState?: string;
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
  }
}
