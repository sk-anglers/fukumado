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
  const state = createState();
  req.session.twitchOauthState = state;
  const url = buildTwitchAuthUrl(state);
  res.redirect(url);
});

authRouter.get('/twitch/callback', async (req, res) => {
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
  if (!req.session.twitchOauthState || req.session.twitchOauthState !== state) {
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

    res.redirect('/auth/success');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

authRouter.get('/twitch/status', (req, res) => {
  if (!req.session.twitchTokens || !req.session.twitchUser) {
    return res.json({ authenticated: false });
  }
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

authRouter.get('/success', (_req, res) => {
  res.send(
    <html>
      <body style="font-family: sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh;">
        <div style="text-align: center;">
          <h2>認証が完了しました</h2>
          <p>このウィンドウを閉じてアプリに戻ってください。</p>
          <button onclick="window.close()" style="padding: 0.5rem 1rem; border-radius: 8px; border: none; background: #38bdf8; color: #0f172a;">閉じる</button>
        </div>
      </body>
    </html>
  );
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
