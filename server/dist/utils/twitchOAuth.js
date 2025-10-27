"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchTwitchUserInfo = exports.refreshTwitchAccessToken = exports.exchangeTwitchCodeForTokens = exports.buildTwitchAuthUrl = void 0;
const undici_1 = require("undici");
const env_1 = require("../config/env");
const TWITCH_AUTH_BASE = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_ENDPOINT = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USER_ENDPOINT = 'https://api.twitch.tv/helix/users';
const scopes = ['user:read:follows', 'chat:read', 'chat:edit'];
const buildTwitchAuthUrl = (state) => {
    const { clientId, redirectUri } = (0, env_1.ensureTwitchOAuthConfig)();
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state
    });
    return `${TWITCH_AUTH_BASE}?${params.toString()}`;
};
exports.buildTwitchAuthUrl = buildTwitchAuthUrl;
const formUrlEncoded = (data) => Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
const exchangeTwitchCodeForTokens = async (code) => {
    const { clientId, clientSecret, redirectUri } = (0, env_1.ensureTwitchOAuthConfig)();
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
    const response = await (0, undici_1.request)(TWITCH_TOKEN_ENDPOINT, {
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    if (response.statusCode >= 400) {
        const text = await response.body.text();
        console.error('[Twitch OAuth Error] Token exchange failed:');
        console.error('  Status:', response.statusCode);
        console.error('  Response:', text);
        throw new Error(`Failed to exchange Twitch code: ${response.statusCode} - ${text}`);
    }
    return (await response.body.json());
};
exports.exchangeTwitchCodeForTokens = exchangeTwitchCodeForTokens;
const refreshTwitchAccessToken = async (refreshToken) => {
    const { clientId, clientSecret } = (0, env_1.ensureTwitchOAuthConfig)();
    const body = formUrlEncoded({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
    });
    const response = await (0, undici_1.request)(TWITCH_TOKEN_ENDPOINT, {
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    if (response.statusCode >= 400) {
        const text = await response.body.text();
        throw new Error(`Failed to refresh Twitch token: ${response.statusCode} - ${text}`);
    }
    return (await response.body.json());
};
exports.refreshTwitchAccessToken = refreshTwitchAccessToken;
const fetchTwitchUserInfo = async (accessToken) => {
    const { clientId } = (0, env_1.ensureTwitchOAuthConfig)();
    const response = await (0, undici_1.request)(TWITCH_USER_ENDPOINT, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Client-ID': clientId
        }
    });
    if (response.statusCode >= 400) {
        const text = await response.body.text();
        throw new Error(`Failed to fetch Twitch user info: ${response.statusCode} - ${text}`);
    }
    const data = (await response.body.json());
    if (!data.data || data.data.length === 0) {
        throw new Error('Twitch user info response was empty');
    }
    return data.data[0];
};
exports.fetchTwitchUserInfo = fetchTwitchUserInfo;
//# sourceMappingURL=twitchOAuth.js.map