"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminStreamsRouter = void 0;
const express_1 = require("express");
const streamSyncService_1 = require("../services/streamSyncService");
exports.adminStreamsRouter = (0, express_1.Router)();
/**
 * GET /api/admin/streams
 * 配信情報の取得
 */
exports.adminStreamsRouter.get('/', async (req, res) => {
    try {
        const streams = await streamSyncService_1.streamSyncService.getCachedStreams();
        const stats = streamSyncService_1.streamSyncService.getStats();
        if (!streams) {
            return res.json({
                success: true,
                data: {
                    youtube: [],
                    twitch: [],
                    stats: {
                        ...stats,
                        cacheAvailable: false
                    }
                },
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            success: true,
            data: {
                youtube: streams.youtube,
                twitch: streams.twitch,
                stats: {
                    ...stats,
                    cacheAvailable: true
                }
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[Admin Streams] Error getting streams:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
//# sourceMappingURL=adminStreams.js.map