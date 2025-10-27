"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchChannelEmotes = exports.fetchGlobalEmotes = exports.searchChannels = exports.fetchLiveStreams = exports.fetchFollowedChannels = void 0;
const undici_1 = require("undici");
const env_1 = require("../config/env");
const TWITCH_BASE = 'https://api.twitch.tv/helix';
const buildHeaders = (accessToken) => {
    const { clientId } = (0, env_1.ensureTwitchOAuthConfig)();
    return {
        Authorization: `Bearer ${accessToken}`,
        'Client-ID': clientId
    };
};
const fetchFollowedChannels = async (accessToken, userId) => {
    console.log('[Twitch Service] Fetching followed channels for user:', userId);
    const headers = buildHeaders(accessToken);
    const allChannels = [];
    let cursor = undefined;
    let pageCount = 0;
    do {
        pageCount++;
        const params = new URLSearchParams({
            user_id: userId,
            first: '100'
        });
        if (cursor) {
            params.append('after', cursor);
        }
        const url = `${TWITCH_BASE}/channels/followed?${params.toString()}`;
        console.log(`[Twitch Service] Fetching page ${pageCount}:`, url);
        const response = await (0, undici_1.request)(url, {
            method: 'GET',
            headers
        });
        console.log(`[Twitch Service] Page ${pageCount} response status:`, response.statusCode);
        if (response.statusCode >= 400) {
            const text = await response.body.text();
            // 429 Rate Limitエラーの特別処理
            if (response.statusCode === 429) {
                const retryAfter = response.headers['retry-after'] || response.headers['ratelimit-reset'];
                console.error('[Twitch Service] ⚠️ Rate limit exceeded!');
                console.error(`[Twitch Service] Retry-After: ${retryAfter || '不明'}`);
                console.error('[Twitch Service] APIリクエストの頻度が高すぎます。しばらく待ってから再試行してください。');
                const retryMessage = retryAfter
                    ? `${retryAfter}秒後に再試行してください`
                    : 'しばらく待ってから再試行してください';
                throw new Error(`Twitch APIのレート制限に達しました。${retryMessage}`);
            }
            console.error('[Twitch Service] Error response:', text);
            throw new Error(`Failed to fetch followed channels: ${response.statusCode} - ${text}`);
        }
        const data = (await response.body.json());
        console.log(`[Twitch Service] Page ${pageCount} fetched ${data.data.length} channels`);
        const channels = data.data.map((item) => ({
            id: item.broadcaster_id,
            login: item.broadcaster_login,
            displayName: item.broadcaster_name
        }));
        allChannels.push(...channels);
        cursor = data.pagination?.cursor;
        console.log(`[Twitch Service] Total channels so far: ${allChannels.length}, Next cursor: ${cursor ? 'exists' : 'none'}`);
    } while (cursor);
    console.log(`[Twitch Service] Finished fetching all ${allChannels.length} channels in ${pageCount} pages`);
    return allChannels;
};
exports.fetchFollowedChannels = fetchFollowedChannels;
const fetchLiveStreams = async (accessToken, channelIds) => {
    if (channelIds.length === 0)
        return [];
    console.log('[Twitch Service] Fetching live streams for channels:', channelIds.length);
    const headers = buildHeaders(accessToken);
    const allStreams = [];
    // チャンネルIDを100件ずつのバッチに分割
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < channelIds.length; i += batchSize) {
        batches.push(channelIds.slice(i, i + batchSize));
    }
    console.log(`[Twitch Service] Split into ${batches.length} batches of up to ${batchSize} channels`);
    // 各バッチに対してAPIリクエストを実行
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const params = new URLSearchParams();
        batch.forEach((id) => params.append('user_id', id));
        console.log(`[Twitch Service] Fetching batch ${batchIndex + 1}/${batches.length} (${batch.length} channels)`);
        const response = await (0, undici_1.request)(`${TWITCH_BASE}/streams?${params.toString()}`, {
            method: 'GET',
            headers
        });
        if (response.statusCode >= 400) {
            const text = await response.body.text();
            // 429 Rate Limitエラーの特別処理
            if (response.statusCode === 429) {
                const retryAfter = response.headers['retry-after'] || response.headers['ratelimit-reset'];
                console.error('[Twitch Service] ⚠️ Rate limit exceeded!');
                console.error(`[Twitch Service] Retry-After: ${retryAfter || '不明'}`);
                console.error('[Twitch Service] APIリクエストの頻度が高すぎます。しばらく待ってから再試行してください。');
                const retryMessage = retryAfter
                    ? `${retryAfter}秒後に再試行してください`
                    : 'しばらく待ってから再試行してください';
                throw new Error(`Twitch APIのレート制限に達しました。${retryMessage}`);
            }
            console.error(`[Twitch Service] Batch ${batchIndex + 1} error:`, text);
            throw new Error(`Failed to fetch Twitch streams: ${response.statusCode} - ${text}`);
        }
        const data = (await response.body.json());
        console.log(`[Twitch Service] Batch ${batchIndex + 1} returned ${data.data.length} live streams`);
        const streams = data.data.map((item) => ({
            id: item.id,
            userId: item.user_id,
            login: item.user_login,
            displayName: item.user_name,
            title: item.title,
            viewerCount: item.viewer_count,
            thumbnailUrl: item.thumbnail_url.replace('{width}', '640').replace('{height}', '360'),
            startedAt: item.started_at
        }));
        allStreams.push(...streams);
    }
    console.log(`[Twitch Service] Total live streams found: ${allStreams.length}`);
    return allStreams;
};
exports.fetchLiveStreams = fetchLiveStreams;
const searchChannels = async (accessToken, query, maxResults = 10) => {
    const headers = buildHeaders(accessToken);
    const params = new URLSearchParams({
        query,
        first: String(Math.min(maxResults, 100))
    });
    const response = await (0, undici_1.request)(`${TWITCH_BASE}/search/channels?${params.toString()}`, {
        method: 'GET',
        headers
    });
    if (response.statusCode >= 400) {
        const text = await response.body.text();
        throw new Error(`Failed to search Twitch channels: ${response.statusCode} - ${text}`);
    }
    const data = (await response.body.json());
    return data.data.map((item) => ({
        id: item.id,
        login: item.broadcaster_login,
        displayName: item.display_name,
        description: item.game_name || '',
        thumbnailUrl: item.thumbnail_url
    }));
};
exports.searchChannels = searchChannels;
const fetchGlobalEmotes = async (accessToken) => {
    console.log('[Twitch Service] Fetching global emotes');
    const headers = buildHeaders(accessToken);
    const response = await (0, undici_1.request)(`${TWITCH_BASE}/chat/emotes/global`, {
        method: 'GET',
        headers
    });
    if (response.statusCode >= 400) {
        const text = await response.body.text();
        console.error('[Twitch Service] Error fetching global emotes:', text);
        throw new Error(`Failed to fetch global emotes: ${response.statusCode} - ${text}`);
    }
    const data = (await response.body.json());
    console.log(`[Twitch Service] Fetched ${data.data.length} global emotes`);
    return data.data.map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.images.url_1x,
        emoteType: item.emote_type,
        emoteSetId: item.emote_set_id,
        ownerId: item.owner_id
    }));
};
exports.fetchGlobalEmotes = fetchGlobalEmotes;
const fetchChannelEmotes = async (accessToken, broadcasterId) => {
    console.log('[Twitch Service] Fetching channel emotes for broadcaster:', broadcasterId);
    const headers = buildHeaders(accessToken);
    const params = new URLSearchParams({
        broadcaster_id: broadcasterId
    });
    const response = await (0, undici_1.request)(`${TWITCH_BASE}/chat/emotes?${params.toString()}`, {
        method: 'GET',
        headers
    });
    if (response.statusCode >= 400) {
        const text = await response.body.text();
        console.error('[Twitch Service] Error fetching channel emotes:', text);
        throw new Error(`Failed to fetch channel emotes: ${response.statusCode} - ${text}`);
    }
    const data = (await response.body.json());
    console.log(`[Twitch Service] Fetched ${data.data.length} channel emotes`);
    return data.data.map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.images.url_1x,
        emoteType: item.emote_type,
        emoteSetId: item.emote_set_id,
        ownerId: item.owner_id
    }));
};
exports.fetchChannelEmotes = fetchChannelEmotes;
//# sourceMappingURL=twitchService.js.map