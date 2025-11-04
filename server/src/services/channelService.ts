/**
 * Channel Service
 * チャンネル情報のDB保存と取得
 */

import prisma from './prismaService';

interface TwitchChannelInfo {
  id: string;
  broadcaster_login: string;
  display_name: string;
  description?: string;
  profile_image_url?: string;
  offline_image_url?: string;
  view_count?: number;
  broadcaster_type?: string;
  is_live?: boolean;
}

/**
 * Twitchチャンネル情報をDBに保存または更新
 */
export const upsertTwitchChannel = async (
  channelInfo: TwitchChannelInfo
): Promise<void> => {
  try {
    await prisma.channel.upsert({
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
  } catch (error) {
    console.error('❌ Failed to save channel to DB:', error);
    // エラーがあってもAPIレスポンスは返す（非同期処理）
  }
};

/**
 * 複数のTwitchチャンネル情報を一括保存
 */
export const upsertTwitchChannels = async (
  channels: TwitchChannelInfo[]
): Promise<void> => {
  try {
    const promises = channels.map(channel => upsertTwitchChannel(channel));
    await Promise.all(promises);
    console.log(`✅ ${channels.length} channels saved to DB`);
  } catch (error) {
    console.error('❌ Failed to save channels to DB:', error);
  }
};

/**
 * DBからチャンネルを検索
 */
export const searchChannelsInDB = async (
  query: string,
  limit: number = 20
): Promise<any[]> => {
  try {
    const channels = await prisma.channel.findMany({
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
  } catch (error) {
    console.error('❌ Failed to search channels in DB:', error);
    return [];
  }
};

/**
 * ユーザーのフォローチャンネルをDBに保存
 */
export const addFollowedChannel = async (
  userId: string,
  platform: string,
  channelId: string
): Promise<void> => {
  try {
    await prisma.followedChannel.upsert({
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
  } catch (error) {
    console.error('❌ Failed to save followed channel:', error);
  }
};

/**
 * ユーザーのフォローチャンネルをDBから取得
 */
export const getFollowedChannels = async (
  userId: string,
  platform: string = 'twitch'
): Promise<string[]> => {
  try {
    const followed = await prisma.followedChannel.findMany({
      where: {
        userId,
        platform,
      },
      select: {
        channelId: true,
      },
    });

    return followed.map(f => f.channelId);
  } catch (error) {
    console.error('❌ Failed to get followed channels from DB:', error);
    return [];
  }
};

/**
 * ユーザーのフォローチャンネルを詳細情報付きで取得
 */
export const getFollowedChannelsWithDetails = async (
  userId: string
): Promise<any[]> => {
  try {
    const followed = await prisma.followedChannel.findMany({
      where: { userId },
      select: {
        platform: true,
        channelId: true,
        followedAt: true,
        notificationEnabled: true,
      },
    });

    return followed;
  } catch (error) {
    console.error('❌ Failed to get followed channels with details:', error);
    return [];
  }
};

/**
 * ユーザーがチャンネルをアンフォロー
 */
export const unfollowChannel = async (
  userId: string,
  platform: string,
  channelId: string
): Promise<void> => {
  try {
    await prisma.followedChannel.deleteMany({
      where: {
        userId,
        platform,
        channelId,
      },
    });

    console.log(`✅ Unfollowed channel: ${userId} -> ${platform}:${channelId}`);
  } catch (error) {
    console.error('❌ Failed to unfollow channel:', error);
    throw error;
  }
};

/**
 * 通知設定を更新
 */
export const updateNotificationSetting = async (
  userId: string,
  platform: string,
  channelId: string,
  enabled: boolean
): Promise<void> => {
  try {
    await prisma.followedChannel.updateMany({
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
  } catch (error) {
    console.error('❌ Failed to update notification setting:', error);
    throw error;
  }
};

export default {
  upsertTwitchChannel,
  upsertTwitchChannels,
  searchChannelsInDB,
  addFollowedChannel,
  getFollowedChannels,
  getFollowedChannelsWithDetails,
  unfollowChannel,
  updateNotificationSetting,
};
