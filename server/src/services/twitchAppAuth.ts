import { fetch } from 'undici';
import { env } from '../config/env';
import { trackedFetch } from '../utils/apiTracker';

interface AppAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Twitch App Access Token管理クラス
 *
 * App Access Tokenのキャッシュと自動リフレッシュを管理します。
 * Conduits APIなど、アプリレベルの認証が必要な機能で使用します。
 */
class TwitchAppAuthManager {
  private cachedToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private refreshPromise: Promise<string> | null = null;

  /**
   * App Access Tokenを取得（キャッシュあり）
   * トークンが期限切れの場合は自動的にリフレッシュします
   */
  async getToken(): Promise<string> {
    // トークンが有効な場合はキャッシュを返す
    if (this.cachedToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.cachedToken;
    }

    // 既にリフレッシュ中の場合は、そのPromiseを返す（重複リクエスト防止）
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // トークンをリフレッシュ
    this.refreshPromise = this.fetchNewToken();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * 新しいApp Access Tokenを取得
   */
  private async fetchNewToken(): Promise<string> {
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

    // トークンをキャッシュ（有効期限の90%で期限切れとみなす）
    this.cachedToken = data.access_token;
    const expiresInMs = data.expires_in * 1000 * 0.9; // 90%
    this.tokenExpiresAt = new Date(Date.now() + expiresInMs);

    console.log(`[Twitch App Auth] App Access Token obtained (expires at ${this.tokenExpiresAt.toISOString()})`);

    return data.access_token;
  }

  /**
   * キャッシュをクリア（テスト用）
   */
  clearCache(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = null;
    this.refreshPromise = null;
  }
}

// シングルトンインスタンス
const appAuthManager = new TwitchAppAuthManager();

/**
 * Twitch App Access Token（サーバーレベルの認証トークン）を取得
 *
 * このトークンはユーザー認証不要で、サーバーアプリケーション全体で使用できます。
 * EventSubManager等のサーバーレベルの機能に使用します。
 *
 * @returns App Access Token（キャッシュされ、自動的にリフレッシュされます）
 */
export async function getTwitchAppAccessToken(): Promise<string> {
  return appAuthManager.getToken();
}

/**
 * App Access Tokenのキャッシュをクリア（テスト用）
 */
export function clearAppAccessTokenCache(): void {
  appAuthManager.clearCache();
}
