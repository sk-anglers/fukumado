import { fetch } from 'undici';
import { env } from '../config/env';
import { trackedFetch } from '../utils/apiTracker';

interface AppAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Twitch App Access Token（サーバーレベルの認証トークン）を取得
 *
 * このトークンはユーザー認証不要で、サーバーアプリケーション全体で使用できます。
 * EventSubManager等のサーバーレベルの機能に使用します。
 */
export async function getTwitchAppAccessToken(): Promise<string> {
  const { clientId, clientSecret } = env.twitch;

  if (!clientId || !clientSecret) {
    throw new Error('Twitch client ID and secret are required');
  }

  console.log('[Twitch App Auth] Fetching App Access Token...');

  const response = await trackedFetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    }),
    service: 'twitch',
    endpoint: 'POST /oauth2/token (app auth)'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get App Access Token: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as AppAccessTokenResponse;
  console.log(`[Twitch App Auth] App Access Token obtained (expires in ${data.expires_in}s)`);

  return data.access_token;
}
