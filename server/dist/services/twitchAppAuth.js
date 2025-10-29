"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTwitchAppAccessToken = getTwitchAppAccessToken;
const env_1 = require("../config/env");
const apiTracker_1 = require("../utils/apiTracker");
/**
 * Twitch App Access Token（サーバーレベルの認証トークン）を取得
 *
 * このトークンはユーザー認証不要で、サーバーアプリケーション全体で使用できます。
 * EventSubManager等のサーバーレベルの機能に使用します。
 */
async function getTwitchAppAccessToken() {
    const { clientId, clientSecret } = env_1.env.twitch;
    if (!clientId || !clientSecret) {
        throw new Error('Twitch client ID and secret are required');
    }
    console.log('[Twitch App Auth] Fetching App Access Token...');
    const response = await (0, apiTracker_1.trackedFetch)('https://id.twitch.tv/oauth2/token', {
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
    const data = await response.json();
    console.log(`[Twitch App Auth] App Access Token obtained (expires in ${data.expires_in}s)`);
    return data.access_token;
}
//# sourceMappingURL=twitchAppAuth.js.map