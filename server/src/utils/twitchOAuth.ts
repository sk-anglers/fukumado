import { request } from 'undici';
import { ensureTwitchOAuthConfig } from '../config/env';
import { trackedTwitchRequest } from './apiTracker';

const TWITCH_AUTH_BASE = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_ENDPOINT = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USER_ENDPOINT = 'https://api.twitch.tv/helix/users';

const scopes = ['user:read:follows', 'chat:read', 'chat:edit'];

export interface TwitchTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string[];
  token_type: string;
}

export interface TwitchUserInfo {
  id: string;
  login: string;
  display_name: string;
  profile_image_url?: string;
}

export const buildTwitchAuthUrl = (state: string): string => {
  const { clientId, redirectUri } = ensureTwitchOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state
  });
  return `${TWITCH_AUTH_BASE}?${params.toString()}`;
};

const formUrlEncoded = (data: Record<string, string>): string =>
  Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

export const exchangeTwitchCodeForTokens = async (code: string): Promise<TwitchTokenResponse> => {
  const { clientId, clientSecret, redirectUri } = ensureTwitchOAuthConfig();

  // Debug log
  console.log('[Twitch OAuth Debug] Token exchange parameters:');
  console.log('  client_id:', clientId);
  console.log('  client_secret:', clientSecret ? `${clientSecret.substring(0, 5)}...` : 'MISSING');
  console.log('  redirect_uri:', redirectUri);
  console.log('  code:', code ? `${code.substring(0, 10)}...` : 'MISSING');

  const body = formUrlEncoded({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  });

  const response = await trackedTwitchRequest(TWITCH_TOKEN_ENDPOINT, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, 'POST /oauth2/token (code exchange)');

  if (response.statusCode >= 400) {
    const text = await response.body.text();
    console.error('[Twitch OAuth Error] Token exchange failed:');
    console.error('  Status:', response.statusCode);
    console.error('  Response:', text);
    throw new Error(`Failed to exchange Twitch code: ${response.statusCode} - ${text}`);
  }

  return (await response.body.json()) as TwitchTokenResponse;
};

export const refreshTwitchAccessToken = async (refreshToken: string): Promise<TwitchTokenResponse> => {
  const { clientId, clientSecret } = ensureTwitchOAuthConfig();
  const body = formUrlEncoded({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await trackedTwitchRequest(TWITCH_TOKEN_ENDPOINT, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, 'POST /oauth2/token (refresh)');

  if (response.statusCode >= 400) {
    const text = await response.body.text();
    throw new Error(`Failed to refresh Twitch token: ${response.statusCode} - ${text}`);
  }

  return (await response.body.json()) as TwitchTokenResponse;
};

export const fetchTwitchUserInfo = async (accessToken: string): Promise<TwitchUserInfo> => {
  const { clientId } = ensureTwitchOAuthConfig();
  const response = await trackedTwitchRequest(TWITCH_USER_ENDPOINT, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-ID': clientId
    }
  }, 'GET /helix/users (OAuth)');

  if (response.statusCode >= 400) {
    const text = await response.body.text();
    throw new Error(`Failed to fetch Twitch user info: ${response.statusCode} - ${text}`);
  }

  const data = (await response.body.json()) as { data: TwitchUserInfo[] };
  if (!data.data || data.data.length === 0) {
    throw new Error('Twitch user info response was empty');
  }
  return data.data[0];
};
