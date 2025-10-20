import { randomBytes } from 'node:crypto';
import { request } from 'undici';
import { ensureYouTubeOAuthConfig } from '../config/env';

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

const scopes = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/youtube.readonly'
];

export const createState = (): string => randomBytes(24).toString('hex');

export const buildAuthUrl = (state: string): string => {
  const { clientId, redirectUri } = ensureYouTubeOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
};

const urlEncoded = (data: Record<string, string>): string =>
  Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

export const exchangeCodeForTokens = async (code: string): Promise<OAuthTokenResponse> => {
  const { clientId, clientSecret, redirectUri } = ensureYouTubeOAuthConfig();

  const response = await request(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    body: urlEncoded({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (response.statusCode >= 400) {
    const body = await response.body.text();
    throw new Error(`Failed to exchange code for tokens: ${response.statusCode} - ${body}`);
  }

  return (await response.body.json()) as OAuthTokenResponse;
};

export const refreshAccessToken = async (refreshToken: string): Promise<OAuthTokenResponse> => {
  const { clientId, clientSecret } = ensureYouTubeOAuthConfig();

  const response = await request(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    body: urlEncoded({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  if (response.statusCode >= 400) {
    const body = await response.body.text();
    throw new Error(`Failed to refresh token: ${response.statusCode} - ${body}`);
  }

  return (await response.body.json()) as OAuthTokenResponse;
};

export const fetchGoogleUserInfo = async (accessToken: string): Promise<GoogleUserInfo> => {
  const response = await request(GOOGLE_USERINFO_ENDPOINT, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.statusCode >= 400) {
    const body = await response.body.text();
    throw new Error(`Failed to fetch user info: ${response.statusCode} - ${body}`);
  }

  return (await response.body.json()) as GoogleUserInfo;
};
