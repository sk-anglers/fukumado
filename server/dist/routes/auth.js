"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAccessToken = exports.authRouter = void 0;
const express_1 = require("express");
const googleOAuth_1 = require("../utils/googleOAuth");
exports.authRouter = (0, express_1.Router)();
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
exports.authRouter.get('/success', (_req, res) => {
    res.send(`
    <html>
      <body style="font-family: sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh;">
        <div style="text-align: center;">
          <h2>認証が完了しました</h2>
          <p>このウィンドウを閉じてアプリに戻ってください。</p>
          <button onclick="window.close()" style="padding: 0.5rem 1rem; border-radius: 8px; border: none; background: #38bdf8; color: #0f172a;">閉じる</button>
        </div>
      </body>
    </html>
  `);
});
const ensureAccessToken = async (req) => {
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
    catch (error) {
        req.session.googleTokens = undefined;
        return null;
    }
};
exports.ensureAccessToken = ensureAccessToken;
//# sourceMappingURL=auth.js.map