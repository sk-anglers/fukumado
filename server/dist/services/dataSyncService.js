"use strict";
/**
 * Data Sync Service
 * 24時間ごとのデータ同期処理を管理
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDataSync = exports.syncChannelBadges = exports.syncGlobalBadges = exports.syncStaleChannels = exports.syncChannelEmotes = exports.syncGlobalEmotes = void 0;
const prismaService_1 = __importDefault(require("./prismaService"));
const twitchService_1 = require("./twitchService");
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24時間
// TODO: アクセストークンの管理方法を実装する必要があります
// 現時点では、DataSyncServiceは起動時に呼び出されていないため、
// 実際のAPI呼び出しは行われません
/**
 * グローバルエモートをDBに同期
 */
const syncGlobalEmotes = async (accessToken) => {
    try {
        console.log('🔄 Syncing global emotes...');
        const globalEmotes = await (0, twitchService_1.fetchGlobalEmotes)(accessToken);
        for (const emote of globalEmotes) {
            await prismaService_1.default.emote.upsert({
                where: {
                    platform_emoteId: {
                        platform: 'twitch',
                        emoteId: emote.id,
                    },
                },
                update: {
                    emoteCode: emote.name,
                    imageUrl1x: emote.imageUrl,
                    imageUrl2x: null,
                    imageUrl4x: null,
                    emoteType: emote.emoteType || null,
                    lastSyncedAt: new Date(),
                },
                create: {
                    platform: 'twitch',
                    emoteId: emote.id,
                    emoteCode: emote.name,
                    scope: 'global',
                    channelId: null,
                    imageUrl1x: emote.imageUrl,
                    imageUrl2x: null,
                    imageUrl4x: null,
                    emoteType: emote.emoteType || null,
                },
            });
        }
        console.log(`✅ Synced ${globalEmotes.length} global emotes`);
    }
    catch (error) {
        console.error('❌ Failed to sync global emotes:', error);
    }
};
exports.syncGlobalEmotes = syncGlobalEmotes;
/**
 * チャンネルエモートをDBに同期
 */
const syncChannelEmotes = async (accessToken, channelId) => {
    try {
        console.log(`🔄 Syncing emotes for channel ${channelId}...`);
        const channelEmotes = await (0, twitchService_1.fetchChannelEmotes)(accessToken, channelId);
        for (const emote of channelEmotes) {
            await prismaService_1.default.emote.upsert({
                where: {
                    platform_emoteId: {
                        platform: 'twitch',
                        emoteId: emote.id,
                    },
                },
                update: {
                    emoteCode: emote.name,
                    imageUrl1x: emote.imageUrl,
                    imageUrl2x: null,
                    imageUrl4x: null,
                    emoteType: emote.emoteType || null,
                    tier: null,
                    lastSyncedAt: new Date(),
                },
                create: {
                    platform: 'twitch',
                    emoteId: emote.id,
                    emoteCode: emote.name,
                    scope: 'channel',
                    channelId: channelId,
                    imageUrl1x: emote.imageUrl,
                    imageUrl2x: null,
                    imageUrl4x: null,
                    emoteType: emote.emoteType || null,
                    tier: null,
                },
            });
        }
        console.log(`✅ Synced ${channelEmotes.length} emotes for channel ${channelId}`);
    }
    catch (error) {
        console.error(`❌ Failed to sync emotes for channel ${channelId}:`, error);
    }
};
exports.syncChannelEmotes = syncChannelEmotes;
/**
 * 24時間以上前に同期されたチャンネル情報を更新
 */
const syncStaleChannels = async (accessToken) => {
    try {
        console.log('🔄 Syncing stale channels...');
        const oneDayAgo = new Date(Date.now() - SYNC_INTERVAL_MS);
        const staleChannels = await prismaService_1.default.channel.findMany({
            where: {
                lastSyncedAt: {
                    lt: oneDayAgo,
                },
            },
            take: 100, // バッチサイズ制限
        });
        console.log(`Found ${staleChannels.length} stale channels to sync`);
        // Twitchチャンネルのみをフィルタリング
        const twitchChannelIds = staleChannels
            .filter(ch => ch.platform === 'twitch')
            .map(ch => ch.channelId);
        if (twitchChannelIds.length > 0) {
            // バッチでチャンネル情報を取得
            const freshChannels = await (0, twitchService_1.fetchChannelsByIds)(accessToken, twitchChannelIds);
            for (const freshData of freshChannels) {
                const existingChannel = staleChannels.find(ch => ch.channelId === freshData.id);
                if (existingChannel) {
                    // TwitchChannelInfo には id, login, displayName のみが含まれています
                    // description, avatarUrl, bannerUrl, viewCount は取得できません
                    await prismaService_1.default.channel.update({
                        where: { id: existingChannel.id },
                        data: {
                            displayName: freshData.displayName,
                            username: freshData.login,
                            lastSyncedAt: new Date(),
                        },
                    });
                    // チャンネルエモートとバッジも同期
                    await (0, exports.syncChannelEmotes)(accessToken, freshData.id);
                    await (0, exports.syncChannelBadges)(accessToken, freshData.id);
                }
            }
        }
        console.log(`✅ Synced ${staleChannels.length} channels`);
    }
    catch (error) {
        console.error('❌ Failed to sync stale channels:', error);
    }
};
exports.syncStaleChannels = syncStaleChannels;
/**
 * グローバルバッジをDBに同期
 */
const syncGlobalBadges = async (accessToken) => {
    try {
        console.log('🔄 Syncing global badges...');
        const globalBadges = await (0, twitchService_1.fetchGlobalBadges)(accessToken);
        for (const badge of globalBadges) {
            // 既存のバッジを検索（グローバルバッジ: channel_id IS NULL）
            const existing = await prismaService_1.default.badge.findFirst({
                where: {
                    platform: 'twitch',
                    badgeSetId: badge.setId,
                    badgeVersion: badge.version,
                    channelId: null,
                },
            });
            if (existing) {
                // 更新
                await prismaService_1.default.badge.update({
                    where: { id: existing.id },
                    data: {
                        imageUrl1x: badge.imageUrl1x,
                        imageUrl2x: badge.imageUrl2x,
                        imageUrl4x: badge.imageUrl4x,
                        title: badge.title,
                        description: badge.description,
                        lastSyncedAt: new Date(),
                    },
                });
            }
            else {
                // 新規作成
                await prismaService_1.default.badge.create({
                    data: {
                        platform: 'twitch',
                        badgeSetId: badge.setId,
                        badgeVersion: badge.version,
                        scope: 'global',
                        channelId: null,
                        imageUrl1x: badge.imageUrl1x,
                        imageUrl2x: badge.imageUrl2x,
                        imageUrl4x: badge.imageUrl4x,
                        title: badge.title,
                        description: badge.description,
                    },
                });
            }
        }
        console.log(`✅ Synced ${globalBadges.length} global badges`);
    }
    catch (error) {
        console.error('❌ Failed to sync global badges:', error);
    }
};
exports.syncGlobalBadges = syncGlobalBadges;
/**
 * チャンネル固有のバッジをDBに同期
 */
const syncChannelBadges = async (accessToken, channelId) => {
    try {
        console.log(`🔄 Syncing badges for channel ${channelId}...`);
        const channelBadges = await (0, twitchService_1.fetchChannelBadges)(accessToken, channelId);
        for (const badge of channelBadges) {
            // 既存のバッジを検索（チャンネル固有バッジ: channel_id IS NOT NULL）
            const existing = await prismaService_1.default.badge.findFirst({
                where: {
                    platform: 'twitch',
                    badgeSetId: badge.setId,
                    badgeVersion: badge.version,
                    channelId: channelId,
                },
            });
            if (existing) {
                // 更新
                await prismaService_1.default.badge.update({
                    where: { id: existing.id },
                    data: {
                        imageUrl1x: badge.imageUrl1x,
                        imageUrl2x: badge.imageUrl2x,
                        imageUrl4x: badge.imageUrl4x,
                        title: badge.title,
                        description: badge.description,
                        lastSyncedAt: new Date(),
                    },
                });
            }
            else {
                // 新規作成
                await prismaService_1.default.badge.create({
                    data: {
                        platform: 'twitch',
                        badgeSetId: badge.setId,
                        badgeVersion: badge.version,
                        scope: 'channel',
                        channelId: channelId,
                        imageUrl1x: badge.imageUrl1x,
                        imageUrl2x: badge.imageUrl2x,
                        imageUrl4x: badge.imageUrl4x,
                        title: badge.title,
                        description: badge.description,
                    },
                });
            }
        }
        console.log(`✅ Synced ${channelBadges.length} badges for channel ${channelId}`);
    }
    catch (error) {
        console.error(`❌ Failed to sync badges for channel ${channelId}:`, error);
    }
};
exports.syncChannelBadges = syncChannelBadges;
/**
 * 定期同期タスクを開始
 *
 * TODO: Week 2で実装予定
 * アクセストークンの管理とスケジューリングを実装する必要があります
 */
const startDataSync = (accessToken) => {
    console.log('🚀 Starting data sync service...');
    // 起動時にグローバルエモートを同期
    (0, exports.syncGlobalEmotes)(accessToken).catch(err => {
        console.error('Failed to sync global emotes:', err);
    });
    // 起動時にグローバルバッジを同期
    (0, exports.syncGlobalBadges)(accessToken).catch(err => {
        console.error('Failed to sync global badges:', err);
    });
    // 24時間ごとにグローバルエモートを同期
    setInterval(() => {
        (0, exports.syncGlobalEmotes)(accessToken).catch(err => {
            console.error('Failed to sync global emotes:', err);
        });
    }, SYNC_INTERVAL_MS);
    // 24時間ごとにグローバルバッジを同期
    setInterval(() => {
        (0, exports.syncGlobalBadges)(accessToken).catch(err => {
            console.error('Failed to sync global badges:', err);
        });
    }, SYNC_INTERVAL_MS);
    // 6時間ごとに古いチャンネルデータを同期
    setInterval(() => {
        (0, exports.syncStaleChannels)(accessToken).catch(err => {
            console.error('Failed to sync stale channels:', err);
        });
    }, 6 * 60 * 60 * 1000);
    console.log('✅ Data sync service started');
};
exports.startDataSync = startDataSync;
exports.default = {
    syncGlobalEmotes: exports.syncGlobalEmotes,
    syncChannelEmotes: exports.syncChannelEmotes,
    syncGlobalBadges: exports.syncGlobalBadges,
    syncChannelBadges: exports.syncChannelBadges,
    syncStaleChannels: exports.syncStaleChannels,
    startDataSync: exports.startDataSync,
};
//# sourceMappingURL=dataSyncService.js.map