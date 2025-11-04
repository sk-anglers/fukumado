/**
 * Data Sync Service
 * 24時間ごとのデータ同期処理を管理
 */

import prisma from './prismaService';
import {
  fetchGlobalEmotes,
  fetchChannelEmotes,
  fetchChannelsByIds,
  fetchGlobalBadges,
  fetchChannelBadges
} from './twitchService';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24時間

// TODO: アクセストークンの管理方法を実装する必要があります
// 現時点では、DataSyncServiceは起動時に呼び出されていないため、
// 実際のAPI呼び出しは行われません

/**
 * グローバルエモートをDBに同期
 */
export const syncGlobalEmotes = async (accessToken: string): Promise<void> => {
  try {
    console.log('🔄 Syncing global emotes...');

    const globalEmotes = await fetchGlobalEmotes(accessToken);

    for (const emote of globalEmotes) {
      await prisma.emote.upsert({
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
  } catch (error) {
    console.error('❌ Failed to sync global emotes:', error);
  }
};

/**
 * チャンネルエモートをDBに同期
 */
export const syncChannelEmotes = async (accessToken: string, channelId: string): Promise<void> => {
  try {
    console.log(`🔄 Syncing emotes for channel ${channelId}...`);

    const channelEmotes = await fetchChannelEmotes(accessToken, channelId);

    for (const emote of channelEmotes) {
      await prisma.emote.upsert({
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
  } catch (error) {
    console.error(`❌ Failed to sync emotes for channel ${channelId}:`, error);
  }
};

/**
 * 24時間以上前に同期されたチャンネル情報を更新
 */
export const syncStaleChannels = async (accessToken: string): Promise<void> => {
  try {
    console.log('🔄 Syncing stale channels...');

    const oneDayAgo = new Date(Date.now() - SYNC_INTERVAL_MS);

    const staleChannels = await prisma.channel.findMany({
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
      const freshChannels = await fetchChannelsByIds(accessToken, twitchChannelIds);

      for (const freshData of freshChannels) {
        const existingChannel = staleChannels.find(ch => ch.channelId === freshData.id);
        if (existingChannel) {
          // TwitchChannelInfo には id, login, displayName のみが含まれています
          // description, avatarUrl, bannerUrl, viewCount は取得できません
          await prisma.channel.update({
            where: { id: existingChannel.id },
            data: {
              displayName: freshData.displayName,
              username: freshData.login,
              lastSyncedAt: new Date(),
            },
          });

          // チャンネルエモートとバッジも同期
          await syncChannelEmotes(accessToken, freshData.id);
          await syncChannelBadges(accessToken, freshData.id);
        }
      }
    }

    console.log(`✅ Synced ${staleChannels.length} channels`);
  } catch (error) {
    console.error('❌ Failed to sync stale channels:', error);
  }
};

/**
 * グローバルバッジをDBに同期
 */
export const syncGlobalBadges = async (accessToken: string): Promise<void> => {
  try {
    console.log('🔄 Syncing global badges...');

    const globalBadges = await fetchGlobalBadges(accessToken);

    for (const badge of globalBadges) {
      // 既存のバッジを検索（グローバルバッジ: channel_id IS NULL）
      const existing = await prisma.badge.findFirst({
        where: {
          platform: 'twitch',
          badgeSetId: badge.setId,
          badgeVersion: badge.version,
          channelId: null,
        },
      });

      if (existing) {
        // 更新
        await prisma.badge.update({
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
      } else {
        // 新規作成
        await prisma.badge.create({
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
  } catch (error) {
    console.error('❌ Failed to sync global badges:', error);
  }
};

/**
 * チャンネル固有のバッジをDBに同期
 */
export const syncChannelBadges = async (accessToken: string, channelId: string): Promise<void> => {
  try {
    console.log(`🔄 Syncing badges for channel ${channelId}...`);

    const channelBadges = await fetchChannelBadges(accessToken, channelId);

    for (const badge of channelBadges) {
      // 既存のバッジを検索（チャンネル固有バッジ: channel_id IS NOT NULL）
      const existing = await prisma.badge.findFirst({
        where: {
          platform: 'twitch',
          badgeSetId: badge.setId,
          badgeVersion: badge.version,
          channelId: channelId,
        },
      });

      if (existing) {
        // 更新
        await prisma.badge.update({
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
      } else {
        // 新規作成
        await prisma.badge.create({
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
  } catch (error) {
    console.error(`❌ Failed to sync badges for channel ${channelId}:`, error);
  }
};

/**
 * 定期同期タスクを開始
 *
 * TODO: Week 2で実装予定
 * アクセストークンの管理とスケジューリングを実装する必要があります
 */
export const startDataSync = (accessToken: string): void => {
  console.log('🚀 Starting data sync service...');

  // 起動時にグローバルエモートを同期
  syncGlobalEmotes(accessToken).catch(err => {
    console.error('Failed to sync global emotes:', err);
  });

  // 起動時にグローバルバッジを同期
  syncGlobalBadges(accessToken).catch(err => {
    console.error('Failed to sync global badges:', err);
  });

  // 24時間ごとにグローバルエモートを同期
  setInterval(() => {
    syncGlobalEmotes(accessToken).catch(err => {
      console.error('Failed to sync global emotes:', err);
    });
  }, SYNC_INTERVAL_MS);

  // 24時間ごとにグローバルバッジを同期
  setInterval(() => {
    syncGlobalBadges(accessToken).catch(err => {
      console.error('Failed to sync global badges:', err);
    });
  }, SYNC_INTERVAL_MS);

  // 6時間ごとに古いチャンネルデータを同期
  setInterval(() => {
    syncStaleChannels(accessToken).catch(err => {
      console.error('Failed to sync stale channels:', err);
    });
  }, 6 * 60 * 60 * 1000);

  console.log('✅ Data sync service started');
};

export default {
  syncGlobalEmotes,
  syncChannelEmotes,
  syncGlobalBadges,
  syncChannelBadges,
  syncStaleChannels,
  startDataSync,
};
