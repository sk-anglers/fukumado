"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUserSubscriptions = exports.searchChannels = exports.fetchLiveStreams = void 0;
const undici_1 = require("undici");
const env_1 = require("../config/env");
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const maxResultsDefault = 10;
const buildSearchUrl = (params) => `${YOUTUBE_API_BASE}/search?${params.toString()}`;
const performRequest = async (url) => {
    const response = await (0, undici_1.request)(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    if (response.statusCode >= 400) {
        const body = await response.body.text();
        throw new Error(`YouTube API error: ${response.statusCode} - ${body}`);
    }
    return await response.body.json();
};
const normalizeSearchItems = (items) => items
    .filter((item) => item.id.videoId)
    .map((item) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    description: item.snippet.description,
    thumbnailUrl: item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        '',
    publishedAt: item.snippet.publishedAt
}));
const fetchLiveStreams = async (options) => {
    const apiKey = (0, env_1.ensureYouTubeApiKey)();
    const maxResults = options.maxResults ?? maxResultsDefault;
    const results = [];
    if (options.channelIds?.length) {
        const responses = await Promise.allSettled(options.channelIds.map(async (channelId) => {
            const params = new URLSearchParams({
                part: 'snippet',
                channelId,
                type: 'video',
                eventType: 'live',
                key: apiKey,
                maxResults: maxResults.toString()
            });
            const url = buildSearchUrl(params);
            const data = await performRequest(url);
            return normalizeSearchItems(data.items);
        }));
        for (const response of responses) {
            if (response.status === 'fulfilled') {
                results.push(...response.value);
            }
        }
    }
    else if (options.query) {
        const params = new URLSearchParams({
            part: 'snippet',
            type: 'video',
            eventType: 'live',
            key: apiKey,
            maxResults: maxResults.toString(),
            q: options.query
        });
        const url = buildSearchUrl(params);
        const data = await performRequest(url);
        results.push(...normalizeSearchItems(data.items));
    }
    else {
        throw new Error('Either channelIds or query must be provided to fetch YouTube live streams.');
    }
    return results;
};
exports.fetchLiveStreams = fetchLiveStreams;
const normalizeChannelItems = (items) => items
    .filter((item) => item.id.channelId)
    .map((item) => ({
    id: item.id.channelId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        '',
    customUrl: item.snippet.customUrl
}));
const searchChannels = async (query, maxResults = 10) => {
    const apiKey = (0, env_1.ensureYouTubeApiKey)();
    if (!query.trim()) {
        return [];
    }
    const params = new URLSearchParams({
        part: 'snippet',
        type: 'channel',
        key: apiKey,
        maxResults: Math.min(Math.max(maxResults, 1), 25).toString(),
        q: query
    });
    const url = buildSearchUrl(params);
    const data = await performRequest(url);
    return normalizeChannelItems(data.items);
};
exports.searchChannels = searchChannels;
const normalizeSubscriptionItem = (item) => ({
    id: item.snippet.resourceId.channelId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        '',
    customUrl: item.snippet.channelTitle
});
const fetchUserSubscriptions = async (accessToken) => {
    const params = new URLSearchParams({
        part: 'snippet',
        mine: 'true',
        maxResults: '50',
        order: 'alphabetical'
    });
    const response = await (0, undici_1.request)(`${YOUTUBE_API_BASE}/subscriptions?${params.toString()}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });
    if (response.statusCode >= 400) {
        const body = await response.body.text();
        throw new Error(`Failed to fetch subscriptions: ${response.statusCode} - ${body}`);
    }
    const data = (await response.body.json());
    return data.items.map(normalizeSubscriptionItem);
};
exports.fetchUserSubscriptions = fetchUserSubscriptions;
//# sourceMappingURL=youtubeService.js.map