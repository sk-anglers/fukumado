/**
 * Data Sync Service
 * 24時間ごとのデータ同期処理を管理
 */

import prisma from './prismaService';
import { twitchService } from './twitchService';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24時間

/**
 * グローバルエモートをDBに同期
 */
export const syncGlobalEmotes = async (): Promise<void> => {
  try {
    console.log('🔄 Syncing global emotes...');

    const globalEmotes = await twitchService.getGlobalEmotes();

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
          imageUrl1x: emote.images.url_1x,
          imageUrl2x: emote.images.url_2x,
          imageUrl4x: emote.images.url_4x,
          emoteType: emote.emote_type || null,
          lastSyncedAt: new Date(),
        },
        create: {
          platform: 'twitch',
          emoteId: emote.id,
          emoteCode: emote.name,
          scope: 'global',
          channelId: null,
          imageUrl1x: emote.images.url_1x,
          imageUrl2x: emote.images.url_2x,
          imageUrl4x: emote.images.url_4x,
          emoteType: emote.emote_type || null,
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
export const syncChannelEmotes = async (channelId: string): Promise<void> => {
  try {
    console.log(`🔄 Syncing emotes for channel ${channelId}...`);

    const channelEmotes = await twitchService.getChannelEmotes(channelId);

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
          imageUrl1x: emote.images.url_1x,
          imageUrl2x: emote.images.url_2x,
          imageUrl4x: emote.images.url_4x,
          emoteType: emote.emote_type || null,
          tier: emote.tier || null,
          lastSyncedAt: new Date(),
        },
        create: {
          platform: 'twitch',
          emoteId: emote.id,
          emoteCode: emote.name,
          scope: 'channel',
          channelId: channelId,
          imageUrl1x: emote.images.url_1x,
          imageUrl2x: emote.images.url_2x,
          imageUrl4x: emote.images.url_4x,
          emoteType: emote.emote_type || null,
          tier: emote.tier || null,
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
export const syncStaleChannels = async (): Promise<void> => {
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

    for (const channel of staleChannels) {
      if (channel.platform === 'twitch') {
        // Twitchチャンネル情報を更新
        const freshData = await twitchService.getChannelInfo(channel.channelId);

        if (freshData) {
          await prisma.channel.update({
            where: { id: channel.id },
            data: {
              displayName: freshData.display_name,
              username: freshData.login,
              description: freshData.description,
              avatarUrl: freshData.profile_image_url,
              bannerUrl: freshData.offline_image_url,
              viewCount: BigInt(freshData.view_count || 0),
              lastSyncedAt: new Date(),
            },
          });

          // チャンネルエモートも同期
          await syncChannelEmotes(channel.channelId);
        }
      }
    }

    console.log(`✅ Synced ${staleChannels.length} channels`);
  } catch (error) {
    console.error('❌ Failed to sync stale channels:', error);
  }
};

/**
 * 定期同期タスクを開始
 */
export const startDataSync = (): void => {
  console.log('🚀 Starting data sync service...');

  // 起動時にグローバルエモートを同期
  syncGlobalEmotes();

  // 24時間ごとにグローバルエモートを同期
  setInterval(() => {
    syncGlobalEmotes();
  }, SYNC_INTERVAL_MS);

  // 6時間ごとに古いチャンネルデータを同期
  setInterval(() => {
    syncStaleChannels();
  }, 6 * 60 * 60 * 1000);

  console.log('✅ Data sync service started');
};

export default {
  syncGlobalEmotes,
  syncChannelEmotes,
  syncStaleChannels,
  startDataSync,
};
