"use strict";
/**
 * Channel Service
 * チャンネル情報のDB保存と取得
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationSetting = exports.unfollowChannel = exports.getFollowedChannelsWithDetails = exports.getFollowedChannels = exports.addFollowedChannel = exports.searchChannelsInDB = exports.upsertTwitchChannels = exports.upsertTwitchChannel = void 0;
const prismaService_1 = __importDefault(require("./prismaService"));
/**
 * Twitchチャンネル情報をDBに保存または更新
 */
const upsertTwitchChannel = async (channelInfo) => {
    try {
        await prismaService_1.default.channel.upsert({
            where: {
                platform_channelId: {
                    platform: 'twitch',
                    channelId: channelInfo.id,
                },
            },
            update: {
                displayName: channelInfo.display_name,
                username: channelInfo.broadcaster_login,
                description: channelInfo.description || null,
                avatarUrl: channelInfo.profile_image_url || null,
                bannerUrl: channelInfo.offline_image_url || null,
                viewCount: channelInfo.view_count ? BigInt(channelInfo.view_count) : BigInt(0),
                isLive: channelInfo.is_live || false,
                lastSyncedAt: new Date(),
                lastAccessedAt: new Date(),
            },
            create: {
                platform: 'twitch',
                channelId: channelInfo.id,
                displayName: channelInfo.display_name,
                username: channelInfo.broadcaster_login,
                description: channelInfo.description || null,
                avatarUrl: channelInfo.profile_image_url || null,
                bannerUrl: channelInfo.offline_image_url || null,
                viewCount: channelInfo.view_count ? BigInt(channelInfo.view_count) : BigInt(0),
                isLive: channelInfo.is_live || false,
            },
        });
        console.log(`✅ Channel saved to DB: ${channelInfo.display_name} (${channelInfo.id})`);
    }
    catch (error) {
        console.error('❌ Failed to save channel to DB:', error);
        // エラーがあってもAPIレスポンスは返す（非同期処理）
    }
};
exports.upsertTwitchChannel = upsertTwitchChannel;
/**
 * 複数のTwitchチャンネル情報を一括保存
 */
const upsertTwitchChannels = async (channels) => {
    try {
        const promises = channels.map(channel => (0, exports.upsertTwitchChannel)(channel));
        await Promise.all(promises);
        console.log(`✅ ${channels.length} channels saved to DB`);
    }
    catch (error) {
        console.error('❌ Failed to save channels to DB:', error);
    }
};
exports.upsertTwitchChannels = upsertTwitchChannels;
/**
 * DBからチャンネルを検索
 */
const searchChannelsInDB = async (query, limit = 20) => {
    try {
        const channels = await prismaService_1.default.channel.findMany({
            where: {
                platform: 'twitch',
                OR: [
                    {
                        displayName: {
                            contains: query,
                            mode: 'insensitive',
                        },
                    },
                    {
                        username: {
                            contains: query,
                            mode: 'insensitive',
                        },
                    },
                ],
            },
            orderBy: [
                { isLive: 'desc' },
                { followerCount: 'desc' },
            ],
            take: limit,
        });
        return channels.map(channel => ({
            id: channel.channelId,
            broadcaster_login: channel.username,
            display_name: channel.displayName,
            description: channel.description,
            profile_image_url: channel.avatarUrl,
            offline_image_url: channel.bannerUrl,
            view_count: Number(channel.viewCount),
            is_live: channel.isLive,
        }));
    }
    catch (error) {
        console.error('❌ Failed to search channels in DB:', error);
        return [];
    }
};
exports.searchChannelsInDB = searchChannelsInDB;
/**
 * ユーザーのフォローチャンネルをDBに保存
 */
const addFollowedChannel = async (userId, platform, channelId) => {
    try {
        await prismaService_1.default.followedChannel.upsert({
            where: {
                userId_platform_channelId: {
                    userId,
                    platform,
                    channelId,
                },
            },
            update: {
            // 既に存在する場合は何もしない
            },
            create: {
                userId,
                platform,
                channelId,
            },
        });
        console.log(`✅ Followed channel saved: ${userId} -> ${platform}:${channelId}`);
    }
    catch (error) {
        console.error('❌ Failed to save followed channel:', error);
    }
};
exports.addFollowedChannel = addFollowedChannel;
/**
 * ユーザーのフォローチャンネルをDBから取得
 */
const getFollowedChannels = async (userId, platform = 'twitch') => {
    try {
        const followed = await prismaService_1.default.followedChannel.findMany({
            where: {
                userId,
                platform,
            },
            select: {
                channelId: true,
            },
        });
        return followed.map(f => f.channelId);
    }
    catch (error) {
        console.error('❌ Failed to get followed channels from DB:', error);
        return [];
    }
};
exports.getFollowedChannels = getFollowedChannels;
/**
 * ユーザーのフォローチャンネルを詳細情報付きで取得
 */
const getFollowedChannelsWithDetails = async (userId) => {
    try {
        const followed = await prismaService_1.default.followedChannel.findMany({
            where: { userId },
            select: {
                platform: true,
                channelId: true,
                followedAt: true,
                notificationEnabled: true,
            },
        });
        return followed;
    }
    catch (error) {
        console.error('❌ Failed to get followed channels with details:', error);
        return [];
    }
};
exports.getFollowedChannelsWithDetails = getFollowedChannelsWithDetails;
/**
 * ユーザーがチャンネルをアンフォロー
 */
const unfollowChannel = async (userId, platform, channelId) => {
    try {
        await prismaService_1.default.followedChannel.deleteMany({
            where: {
                userId,
                platform,
                channelId,
            },
        });
        console.log(`✅ Unfollowed channel: ${userId} -> ${platform}:${channelId}`);
    }
    catch (error) {
        console.error('❌ Failed to unfollow channel:', error);
        throw error;
    }
};
exports.unfollowChannel = unfollowChannel;
/**
 * 通知設定を更新
 */
const updateNotificationSetting = async (userId, platform, channelId, enabled) => {
    try {
        await prismaService_1.default.followedChannel.updateMany({
            where: {
                userId,
                platform,
                channelId,
            },
            data: {
                notificationEnabled: enabled,
            },
        });
        console.log(`✅ Updated notification setting: ${platform}:${channelId} -> ${enabled}`);
    }
    catch (error) {
        console.error('❌ Failed to update notification setting:', error);
        throw error;
    }
};
exports.updateNotificationSetting = updateNotificationSetting;
exports.default = {
    upsertTwitchChannel: exports.upsertTwitchChannel,
    upsertTwitchChannels: exports.upsertTwitchChannels,
    searchChannelsInDB: exports.searchChannelsInDB,
    addFollowedChannel: exports.addFollowedChannel,
    getFollowedChannels: exports.getFollowedChannels,
    getFollowedChannelsWithDetails: exports.getFollowedChannelsWithDetails,
    unfollowChannel: exports.unfollowChannel,
    updateNotificationSetting: exports.updateNotificationSetting,
};
//# sourceMappingURL=channelService.js.map