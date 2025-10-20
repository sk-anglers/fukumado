"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLiveStreams = void 0;
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
        const responses = await Promise.all(options.channelIds.map(async (channelId) => {
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
        responses.forEach((streams) => {
            results.push(...streams);
        });
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
//# sourceMappingURL=youtubeService.js.map