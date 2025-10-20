"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.youtubeRouter = void 0;
const express_1 = require("express");
const youtubeService_1 = require("../services/youtubeService");
exports.youtubeRouter = (0, express_1.Router)();
exports.youtubeRouter.get('/live', async (req, res) => {
    try {
        const channelIdsParam = req.query.channelId;
        const queryParam = req.query.q;
        const maxResultsParam = req.query.maxResults;
        const channelIds = Array.isArray(channelIdsParam)
            ? channelIdsParam.map(String)
            : channelIdsParam
                ? [String(channelIdsParam)]
                : undefined;
        const maxResults = maxResultsParam ? Number(maxResultsParam) : undefined;
        if ((!channelIds || channelIds.length === 0) && !queryParam) {
            return res.status(400).json({
                error: 'Either "channelId" (can be multiple) or "q" query parameter must be provided.'
            });
        }
        const results = await (0, youtubeService_1.fetchLiveStreams)({
            channelIds,
            query: queryParam ? String(queryParam) : undefined,
            maxResults
        });
        res.json({ items: results });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});
exports.youtubeRouter.get('/channels', async (req, res) => {
    try {
        const query = req.query.q;
        const maxResultsParam = req.query.maxResults;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: '"q" query parameter is required' });
        }
        const maxResults = maxResultsParam ? Number(maxResultsParam) : undefined;
        const channels = await (0, youtubeService_1.searchChannels)(query, maxResults);
        res.json({ items: channels });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});
//# sourceMappingURL=youtube.js.map