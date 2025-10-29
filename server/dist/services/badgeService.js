"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.badgeService = void 0;
const apiTracker_1 = require("../utils/apiTracker");
class BadgeService {
    constructor() {
        this.globalBadges = {};
        this.channelBadges = {};
        this.accessToken = null;
        this.clientId = process.env.TWITCH_CLIENT_ID || '';
    }
    setAccessToken(token) {
        this.accessToken = token;
    }
    // グローバルバッジを取得
    async fetchGlobalBadges() {
        if (!this.accessToken) {
            console.warn('[Badge Service] No access token set, skipping global badges fetch');
            return;
        }
        try {
            const response = await (0, apiTracker_1.trackedFetch)('https://api.twitch.tv/helix/chat/badges/global', {
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.accessToken}`
                },
                service: 'twitch',
                endpoint: 'GET /chat/badges/global'
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch global badges: ${response.status}`);
            }
            const data = await response.json();
            data.data.forEach((badgeSet) => {
                if (!this.globalBadges[badgeSet.set_id]) {
                    this.globalBadges[badgeSet.set_id] = {};
                }
                badgeSet.versions.forEach((version) => {
                    this.globalBadges[badgeSet.set_id][version.id] = version.image_url_1x;
                });
            });
            console.log('[Badge Service] Global badges loaded:', Object.keys(this.globalBadges).length, 'sets');
        }
        catch (error) {
            console.error('[Badge Service] Error fetching global badges:', error);
        }
    }
    // チャンネル固有のバッジを取得
    async fetchChannelBadges(broadcasterId) {
        if (!this.accessToken) {
            console.warn('[Badge Service] No access token set, skipping channel badges fetch');
            return;
        }
        if (this.channelBadges[broadcasterId]) {
            console.log('[Badge Service] Channel badges already cached for:', broadcasterId);
            return;
        }
        try {
            const response = await (0, apiTracker_1.trackedFetch)(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${broadcasterId}`, {
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.accessToken}`
                },
                service: 'twitch',
                endpoint: 'GET /chat/badges (channel)'
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch channel badges: ${response.status}`);
            }
            const data = await response.json();
            this.channelBadges[broadcasterId] = {};
            data.data.forEach((badgeSet) => {
                if (!this.channelBadges[broadcasterId][badgeSet.set_id]) {
                    this.channelBadges[broadcasterId][badgeSet.set_id] = {};
                }
                badgeSet.versions.forEach((version) => {
                    this.channelBadges[broadcasterId][badgeSet.set_id][version.id] = version.image_url_1x;
                });
            });
            console.log('[Badge Service] Channel badges loaded for', broadcasterId, ':', Object.keys(this.channelBadges[broadcasterId]).length, 'sets');
        }
        catch (error) {
            console.error('[Badge Service] Error fetching channel badges:', error);
        }
    }
    // バッジのURLを取得
    getBadgeUrl(setId, version, channelId) {
        // チャンネル固有のバッジを優先
        if (channelId && this.channelBadges[channelId]?.[setId]?.[version]) {
            return this.channelBadges[channelId][setId][version];
        }
        // グローバルバッジをチェック
        if (this.globalBadges[setId]?.[version]) {
            return this.globalBadges[setId][version];
        }
        return null;
    }
}
exports.badgeService = new BadgeService();
//# sourceMappingURL=badgeService.js.map