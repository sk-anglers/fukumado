import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { env } from '../config/env';
import axios from 'axios';

export const authRouter = Router();

// OAuth state管理（セッションの代わりに簡易的にメモリで管理）
const oauthStates = new Map<string, { timestamp: number }>();

// 古いstateを定期的にクリーンアップ（5分以上経過したものを削除）
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > 5 * 60 * 1000) {
      oauthStates.delete(state);
    }
  }
}, 60000);

/**
 * GET /auth/twitch
 * Twitchログイン開始
 */
authRouter.get('/twitch', (req: Request, res: Response) => {
  const state = randomBytes(16).toString('hex');
  oauthStates.set(state, { timestamp: Date.now() });

  const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authUrl.searchParams.set('client_id', env.twitch.clientId);
  authUrl.searchParams.set('redirect_uri', env.twitch.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'user:read:follows chat:read chat:edit');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('force_verify', 'true'); // 強制的に認証画面を表示

  console.log('[Twitch Auth] Redirecting to:', authUrl.toString());
  res.redirect(authUrl.toString());
});

/**
 * GET /auth/twitch/callback
 * Twitchコールバック
 */
authRouter.get('/twitch/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code || !state) {
    console.error('[Twitch Auth] Missing code or state');
    return res.status(400).json({ error: 'Missing code or state' });
  }

  // State検証
  if (!oauthStates.has(state as string)) {
    console.error('[Twitch Auth] Invalid state');
    return res.status(400).json({ error: 'Invalid state' });
  }

  oauthStates.delete(state as string);

  try {
    // トークン交換
    const tokenResponse = await axios.post(
      'https://id.twitch.tv/oauth2/token',
      null,
      {
        params: {
          client_id: env.twitch.clientId,
          client_secret: env.twitch.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: env.twitch.redirectUri
        }
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // ユーザー情報取得
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Client-Id': env.twitch.clientId
      }
    });

    const user = userResponse.data.data[0];

    console.log('[Twitch Auth] User authenticated:', user.login);

    // セッションにトークンとユーザー情報を保存
    (req.session as any).twitchAuth = {
      accessToken: access_token,
      refreshToken: refresh_token,
      user: {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url
      },
      authenticatedAt: new Date().toISOString()
    };

    // Main serverのEventSubManagerに認証情報を設定
    try {
      await axios.post(
        `${env.mainBackendUrl}/api/admin/eventsub/credentials`,
        {
          accessToken: access_token,
          clientId: env.twitch.clientId
        }
      );

      console.log('[Twitch Auth] Credentials sent to main server');
    } catch (error) {
      console.error('[Twitch Auth] Failed to send credentials to main server:', error);
    }

    // 成功ページにリダイレクト（トークンをクエリパラメータで渡す）
    res.redirect(`${env.adminFrontendUrl}/?twitch_auth=success&username=${encodeURIComponent(user.login)}`);
  } catch (error) {
    console.error('[Twitch Auth] OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /auth/twitch/status
 * Twitch認証状態確認
 */
authRouter.get('/twitch/status', (req: Request, res: Response) => {
  const twitchAuth = (req.session as any).twitchAuth;

  if (!twitchAuth || !twitchAuth.accessToken) {
    return res.json({
      authenticated: false
    });
  }

  res.json({
    authenticated: true,
    user: twitchAuth.user,
    authenticatedAt: twitchAuth.authenticatedAt
  });
});

/**
 * POST /auth/logout
 * ログアウト
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  (req.session as any).twitchAuth = null;
  res.json({ success: true });
});
