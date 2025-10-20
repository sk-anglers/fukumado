"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchGoogleUserInfo = exports.refreshAccessToken = exports.exchangeCodeForTokens = exports.buildAuthUrl = exports.createState = void 0;
const node_crypto_1 = require("node:crypto");
const undici_1 = require("undici");
const env_1 = require("../config/env");
const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const scopes = [
    'openid',
    'email',
    'https://www.googleapis.com/auth/youtube.readonly'
];
const createState = () => (0, node_crypto_1.randomBytes)(24).toString('hex');
exports.createState = createState;
const buildAuthUrl = (state) => {
    const { clientId, redirectUri } = (0, env_1.ensureYouTubeOAuthConfig)();
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
exports.buildAuthUrl = buildAuthUrl;
const urlEncoded = (data) => Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
const exchangeCodeForTokens = async (code) => {
    const { clientId, clientSecret, redirectUri } = (0, env_1.ensureYouTubeOAuthConfig)();
    const response = await (0, undici_1.request)(GOOGLE_TOKEN_ENDPOINT, {
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
    return (await response.body.json());
};
exports.exchangeCodeForTokens = exchangeCodeForTokens;
const refreshAccessToken = async (refreshToken) => {
    const { clientId, clientSecret } = (0, env_1.ensureYouTubeOAuthConfig)();
    const response = await (0, undici_1.request)(GOOGLE_TOKEN_ENDPOINT, {
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
    return (await response.body.json());
};
exports.refreshAccessToken = refreshAccessToken;
const fetchGoogleUserInfo = async (accessToken) => {
    const response = await (0, undici_1.request)(GOOGLE_USERINFO_ENDPOINT, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });
    if (response.statusCode >= 400) {
        const body = await response.body.text();
        throw new Error(`Failed to fetch user info: ${response.statusCode} - ${body}`);
    }
    return (await response.body.json());
};
exports.fetchGoogleUserInfo = fetchGoogleUserInfo;
//# sourceMappingURL=googleOAuth.js.map