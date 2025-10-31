import { Router } from 'express';
import type { Request } from 'express';
import {
  buildAuthUrl as buildGoogleAuthUrl,
  createState,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  refreshAccessToken
} from '../utils/googleOAuth';
import {
  buildTwitchAuthUrl,
  exchangeTwitchCodeForTokens,
  fetchTwitchUserInfo,
  refreshTwitchAccessToken
} from '../utils/twitchOAuth';
import { fetchGlobalEmotes } from '../services/twitchService';
import { env } from '../config/env';

export const authRouter = Router();

// Google OAuth
authRouter.get('/google', (req, res) => {
  const state = createState();
  req.session.oauthState = state;
  const url = buildGoogleAuthUrl(state);
  res.redirect(url);
});

authRouter.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.status(400).json({ error: String(error) });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing code' });
  }
  if (!state || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing state' });
  }
  if (!req.session.oauthState || req.session.oauthState !== state) {
    return res.status(400).json({ error: 'Invalid state' });
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code);
    req.session.oauthState = undefined;
    req.session.googleTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      scope: tokenResponse.scope,
      tokenType: tokenResponse.token_type,
      expiryDate: Date.now() + tokenResponse.expires_in * 1000
    };

    const userInfo = await fetchGoogleUserInfo(tokenResponse.access_token);
    req.session.googleUser = {
      id: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    };

    res.redirect('/auth/success');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

authRouter.get('/status', (req, res) => {
  if (!req.session.googleTokens || !req.session.googleUser) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: req.session.googleUser,
    scope: req.session.googleTokens.scope
  });
});

authRouter.post('/logout', (req, res) => {
  req.session.googleTokens = undefined;
  req.session.googleUser = undefined;
  res.json({ success: true });
});

// Twitch OAuth
authRouter.get('/twitch', (req, res) => {
  console.log('[Twitch Login] Starting OAuth flow');
  console.log('[Twitch Login] Session ID:', req.sessionID);

  // adminパラメータを検出（管理ダッシュボード用）
  const isAdminAuth = req.query.admin === 'true';
  if (isAdminAuth) {
    console.log('[Twitch Login] Admin authentication detected');
  }

  const state = createState();
  req.session.twitchOauthState = state;
  req.session.isAdminAuth = isAdminAuth; // adminフラグを保存
  const url = buildTwitchAuthUrl(state);
  console.log('[Twitch Login] Redirecting to:', url);
  res.redirect(url);
});

authRouter.get('/twitch/callback', async (req, res) => {
  console.log('[Twitch Callback] Received callback');
  console.log('[Twitch Callback] Session ID:', req.sessionID);

  const { code, state, error } = req.query;
  if (error) {
    console.error('[Twitch Callback] Error:', error);
    return res.status(400).json({ error: String(error) });
  }
  if (!code || typeof code !== 'string') {
    console.error('[Twitch Callback] Missing code');
    return res.status(400).json({ error: 'Missing code' });
  }
  if (!state || typeof state !== 'string') {
    console.error('[Twitch Callback] Missing state');
    return res.status(400).json({ error: 'Missing state' });
  }
  if (!req.session.twitchOauthState || req.session.twitchOauthState !== state) {
    console.error('[Twitch Callback] Invalid state. Expected:', req.session.twitchOauthState, 'Got:', state);
    return res.status(400).json({ error: 'Invalid state' });
  }

  try {
    const tokenResponse = await exchangeTwitchCodeForTokens(code);
    req.session.twitchOauthState = undefined;
    req.session.twitchTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      scope: tokenResponse.scope,
      tokenType: tokenResponse.token_type,
      expiryDate: Date.now() + tokenResponse.expires_in * 1000
    };

    const userInfo = await fetchTwitchUserInfo(tokenResponse.access_token);
    req.session.twitchUser = {
      id: userInfo.id,
      login: userInfo.login,
      displayName: userInfo.display_name,
      profileImageUrl: userInfo.profile_image_url
    };

    console.log('[Twitch Callback] User authenticated:', userInfo.login);
    console.log('[Twitch Callback] Session data set:', {
      hasTokens: !!req.session.twitchTokens,
      hasUser: !!req.session.twitchUser
    });

    // 管理ダッシュボード用の認証の場合
    const isAdminAuth = req.session.isAdminAuth;
    req.session.isAdminAuth = undefined; // フラグをクリア

    if (isAdminAuth) {
      console.log('[Twitch Callback] Admin authentication - sending credentials to admin dashboard');

      // トークンをEventSubManagerに送信
      try {
        const { fetch } = await import('undici');
        const response = await fetch(`${env.apiUrl}/api/admin/eventsub/credentials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-API-Key': env.adminApiKey
          },
          body: JSON.stringify({
            accessToken: tokenResponse.access_token,
            clientId: process.env.TWITCH_CLIENT_ID
          })
        });

        if (response.ok) {
          console.log('[Twitch Callback] Credentials sent to EventSubManager successfully');
        } else {
          console.error('[Twitch Callback] Failed to send credentials:', response.status);
        }
      } catch (error) {
        console.error('[Twitch Callback] Error sending credentials:', error);
      }

      // 管理ダッシュボードにリダイレクト
      return res.redirect(`${env.adminFrontendUrl}/eventsub?twitch_auth=success&username=${encodeURIComponent(userInfo.login)}`);
    }

    // 通常の認証フロー
    // グローバルエモートを先読み（バックグラウンドで非同期実行）
    fetchGlobalEmotes(tokenResponse.access_token)
      .then(() => {
        console.log('[Twitch Callback] Global emotes preloaded successfully');
      })
      .catch((error) => {
        console.error('[Twitch Callback] Failed to preload global emotes:', error.message);
      });

    // セッションを保存してからリダイレクト
    req.session.save((err) => {
      if (err) {
        console.error('[Twitch Callback] Session save error:', err);
      } else {
        console.log('[Twitch Callback] Session saved successfully');
      }
      res.redirect('/auth/success');
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Twitch Callback] Error:', message);
    res.status(500).json({ error: message });
  }
});

authRouter.get('/twitch/status', (req, res) => {
  console.log('[Twitch Status] Session ID:', req.sessionID);
  console.log('[Twitch Status] Has tokens:', !!req.session.twitchTokens);
  console.log('[Twitch Status] Has user:', !!req.session.twitchUser);

  if (!req.session.twitchTokens || !req.session.twitchUser) {
    console.log('[Twitch Status] Not authenticated');
    return res.json({ authenticated: false });
  }

  console.log('[Twitch Status] Authenticated as:', req.session.twitchUser.login);
  res.json({
    authenticated: true,
    user: req.session.twitchUser,
    scope: req.session.twitchTokens.scope
  });
});

authRouter.post('/twitch/logout', (req, res) => {
  req.session.twitchTokens = undefined;
  req.session.twitchUser = undefined;
  res.json({ success: true });
});

authRouter.get('/twitch/logout', (req, res) => {
  req.session.twitchTokens = undefined;
  req.session.twitchUser = undefined;
  res.redirect('/');
});

authRouter.get('/success', (_req, res) => {
  const nonce = res.locals.nonce || '';
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta charset="UTF-8">
        <title>認証完了</title>
      </head>
      <body style="font-family: sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 1rem;">
        <div style="text-align: center; max-width: 500px; padding: 2rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
          <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">認証が完了しました</h2>
          <p style="font-size: 1.1rem; margin-bottom: 2rem; line-height: 1.6;">
            3秒後に自動的にアプリに戻ります...<br>
            戻らない場合は下のボタンを押してください。
          </p>
          <a href="javascript:void(0)" id="backButton" style="display: inline-block; padding: 1rem 2rem; border-radius: 12px; border: none; background: #38bdf8; color: #0f172a; text-decoration: none; font-size: 1.1rem; font-weight: 600; min-height: 44px; line-height: 1.5;">
            アプリに戻る
          </a>
        </div>
        <script nonce="${nonce}">
          // 即座に実行（IIFE）
          (function() {
            console.log('[Auth Success] Script started');
            console.log('[Auth Success] window.opener:', window.opener);
            console.log('[Auth Success] window.opener type:', typeof window.opener);

            var link = document.getElementById('backButton');

            // window.opener がある場合（ポップアップで開かれた場合）
            if (window.opener && !window.opener.closed) {
              console.log('[Auth Success] Popup detected, sending postMessage');

              // 親ウィンドウに認証完了を通知（postMessage）
              try {
                var targetOrigin = '${env.frontendUrl}';
                console.log('[Auth Success] Target origin:', targetOrigin);
                window.opener.postMessage(
                  { type: 'AUTH_SUCCESS', platform: 'oauth' },
                  targetOrigin
                );
                console.log('[Auth Success] postMessage sent successfully');
              } catch (error) {
                console.error('[Auth Success] postMessage error:', error);
              }

              // ボタンクリックでクローズ
              link.onclick = function() {
                console.log('[Auth Success] Close button clicked');
                window.close();
                return false;
              };

              // 3秒後に自動クローズ
              setTimeout(function() {
                console.log('[Auth Success] Auto-closing after 3 seconds');
                window.close();
              }, 3000);
            } else {
              // window.opener がない場合（通常のウィンドウで開かれた場合）
              console.log('[Auth Success] Normal window detected, redirecting');
              console.log('[Auth Success] window.opener is null or closed');
              link.href = '${env.frontendUrl}/';

              // 3秒後にリダイレクト
              setTimeout(function() {
                console.log('[Auth Success] Redirecting to:', '${env.frontendUrl}/');
                window.location.href = '${env.frontendUrl}/';
              }, 3000);
            }

            console.log('[Auth Success] Script completed');
          })();
        </script>
      </body>
    </html>
  `);
});

export const ensureGoogleAccessToken = async (req: Request): Promise<string | null> => {
  const tokens = req.session.googleTokens;
  if (!tokens) return null;
  if (tokens.expiryDate > Date.now() - 30_000) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    return null;
  }

  try {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    req.session.googleTokens = {
      accessToken: refreshed.access_token,
      refreshToken: tokens.refreshToken,
      scope: refreshed.scope,
      tokenType: refreshed.token_type,
      expiryDate: Date.now() + refreshed.expires_in * 1000
    };
    return refreshed.access_token;
  } catch {
    req.session.googleTokens = undefined;
    return null;
  }
};

export const ensureTwitchAccessToken = async (req: Request): Promise<string | null> => {
  const tokens = req.session.twitchTokens;
  if (!tokens) return null;
  if (tokens.expiryDate > Date.now() - 30_000) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    return null;
  }

  try {
    const refreshed = await refreshTwitchAccessToken(tokens.refreshToken);
    req.session.twitchTokens = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
      scope: refreshed.scope,
      tokenType: refreshed.token_type,
      expiryDate: Date.now() + refreshed.expires_in * 1000
    };
    return refreshed.access_token;
  } catch {
    req.session.twitchTokens = undefined;
    return null;
  }
};
