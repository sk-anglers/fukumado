"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTwitchAccessToken = exports.ensureGoogleAccessToken = exports.authRouter = void 0;
const express_1 = require("express");
const googleOAuth_1 = require("../utils/googleOAuth");
const twitchOAuth_1 = require("../utils/twitchOAuth");
exports.authRouter = (0, express_1.Router)();
// Google OAuth
exports.authRouter.get('/google', (req, res) => {
    const state = (0, googleOAuth_1.createState)();
    req.session.oauthState = state;
    const url = (0, googleOAuth_1.buildAuthUrl)(state);
    res.redirect(url);
});
exports.authRouter.get('/google/callback', async (req, res) => {
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
        const tokenResponse = await (0, googleOAuth_1.exchangeCodeForTokens)(code);
        req.session.oauthState = undefined;
        req.session.googleTokens = {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            scope: tokenResponse.scope,
            tokenType: tokenResponse.token_type,
            expiryDate: Date.now() + tokenResponse.expires_in * 1000
        };
        const userInfo = await (0, googleOAuth_1.fetchGoogleUserInfo)(tokenResponse.access_token);
        req.session.googleUser = {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture
        };
        res.redirect('/auth/success');
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});
exports.authRouter.get('/status', (req, res) => {
    if (!req.session.googleTokens || !req.session.googleUser) {
        return res.json({ authenticated: false });
    }
    res.json({
        authenticated: true,
        user: req.session.googleUser,
        scope: req.session.googleTokens.scope
    });
});
exports.authRouter.post('/logout', (req, res) => {
    req.session.googleTokens = undefined;
    req.session.googleUser = undefined;
    res.json({ success: true });
});
// Twitch OAuth
exports.authRouter.get('/twitch', (req, res) => {
    console.log('[Twitch Login] Starting OAuth flow');
    console.log('[Twitch Login] Session ID:', req.sessionID);
    const state = (0, googleOAuth_1.createState)();
    req.session.twitchOauthState = state;
    const url = (0, twitchOAuth_1.buildTwitchAuthUrl)(state);
    console.log('[Twitch Login] Redirecting to:', url);
    res.redirect(url);
});
exports.authRouter.get('/twitch/callback', async (req, res) => {
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
        const tokenResponse = await (0, twitchOAuth_1.exchangeTwitchCodeForTokens)(code);
        req.session.twitchOauthState = undefined;
        req.session.twitchTokens = {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            scope: tokenResponse.scope,
            tokenType: tokenResponse.token_type,
            expiryDate: Date.now() + tokenResponse.expires_in * 1000
        };
        const userInfo = await (0, twitchOAuth_1.fetchTwitchUserInfo)(tokenResponse.access_token);
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
        // セッションを保存してからリダイレクト
        req.session.save((err) => {
            if (err) {
                console.error('[Twitch Callback] Session save error:', err);
            }
            else {
                console.log('[Twitch Callback] Session saved successfully');
            }
            res.redirect('/auth/success');
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Twitch Callback] Error:', message);
        res.status(500).json({ error: message });
    }
});
exports.authRouter.get('/twitch/status', (req, res) => {
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
exports.authRouter.post('/twitch/logout', (req, res) => {
    req.session.twitchTokens = undefined;
    req.session.twitchUser = undefined;
    res.json({ success: true });
});
exports.authRouter.get('/twitch/logout', (req, res) => {
    req.session.twitchTokens = undefined;
    req.session.twitchUser = undefined;
    res.redirect('/');
});
exports.authRouter.get('/success', (_req, res) => {
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
          <a href="http://localhost:5173/" style="display: inline-block; padding: 1rem 2rem; border-radius: 12px; border: none; background: #38bdf8; color: #0f172a; text-decoration: none; font-size: 1.1rem; font-weight: 600; min-height: 44px; line-height: 1.5;">
            アプリに戻る
          </a>
        </div>
        <script>
          setTimeout(function() {
            window.location.href = 'http://localhost:5173/';
          }, 3000);
        </script>
      </body>
    </html>
  `);
});
const ensureGoogleAccessToken = async (req) => {
    const tokens = req.session.googleTokens;
    if (!tokens)
        return null;
    if (tokens.expiryDate > Date.now() - 30_000) {
        return tokens.accessToken;
    }
    if (!tokens.refreshToken) {
        return null;
    }
    try {
        const refreshed = await (0, googleOAuth_1.refreshAccessToken)(tokens.refreshToken);
        req.session.googleTokens = {
            accessToken: refreshed.access_token,
            refreshToken: tokens.refreshToken,
            scope: refreshed.scope,
            tokenType: refreshed.token_type,
            expiryDate: Date.now() + refreshed.expires_in * 1000
        };
        return refreshed.access_token;
    }
    catch {
        req.session.googleTokens = undefined;
        return null;
    }
};
exports.ensureGoogleAccessToken = ensureGoogleAccessToken;
const ensureTwitchAccessToken = async (req) => {
    const tokens = req.session.twitchTokens;
    if (!tokens)
        return null;
    if (tokens.expiryDate > Date.now() - 30_000) {
        return tokens.accessToken;
    }
    if (!tokens.refreshToken) {
        return null;
    }
    try {
        const refreshed = await (0, twitchOAuth_1.refreshTwitchAccessToken)(tokens.refreshToken);
        req.session.twitchTokens = {
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
            scope: refreshed.scope,
            tokenType: refreshed.token_type,
            expiryDate: Date.now() + refreshed.expires_in * 1000
        };
        return refreshed.access_token;
    }
    catch {
        req.session.twitchTokens = undefined;
        return null;
    }
};
exports.ensureTwitchAccessToken = ensureTwitchAccessToken;
//# sourceMappingURL=auth.js.map