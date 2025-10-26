import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Platform } from '../types';

export interface FollowedChannel {
  platform: Platform;
  channelId: string;
  label?: string;
}

interface UserState {
  // ユーザーIDごとにフォロー情報を保存
  followedChannelsByUser: {
    [userId: string]: FollowedChannel[];
  };
  currentYoutubeUserId: string | null;
  currentTwitchUserId: string | null;

  // 現在のユーザーのフォローチャンネルを取得（computed property）
  followedChannels: FollowedChannel[];

  // ユーザーID設定
  setCurrentYoutubeUser: (userId: string | null) => void;
  setCurrentTwitchUser: (userId: string | null) => void;

  // チャンネル操作
  addFollowedChannel: (channel: FollowedChannel) => void;
  addFollowedChannels: (channels: FollowedChannel[]) => void;
  removeFollowedChannel: (channelId: string, platform?: Platform) => void;
  clearFollowedChannels: () => void;
}

const makeKey = (channel: FollowedChannel): string => `${channel.platform}:${channel.channelId}`;

// 現在のユーザーの複合キーを生成
const getCurrentUserKey = (state: UserState, platform: Platform): string | null => {
  if (platform === 'youtube') {
    return state.currentYoutubeUserId ? `youtube:${state.currentYoutubeUserId}` : null;
  } else if (platform === 'twitch') {
    return state.currentTwitchUserId ? `twitch:${state.currentTwitchUserId}` : null;
  }
  return null;
};

// 現在のすべてのユーザーキーを取得
const getAllCurrentUserKeys = (state: UserState): string[] => {
  const keys: string[] = [];
  if (state.currentYoutubeUserId) {
    keys.push(`youtube:${state.currentYoutubeUserId}`);
  }
  if (state.currentTwitchUserId) {
    keys.push(`twitch:${state.currentTwitchUserId}`);
  }
  return keys;
};

// 現在のユーザーのフォローチャンネルを集約
const getFollowedChannels = (state: UserState): FollowedChannel[] => {
  const userKeys = getAllCurrentUserKeys(state);
  const allChannels: FollowedChannel[] = [];

  userKeys.forEach((key) => {
    const channels = state.followedChannelsByUser[key] || [];
    allChannels.push(...channels);
  });

  return allChannels;
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      followedChannelsByUser: {},
      currentYoutubeUserId: null,
      currentTwitchUserId: null,
      followedChannels: [],

      setCurrentYoutubeUser: (userId) => {
        set(() => {
          const newState = {
            ...get(),
            currentYoutubeUserId: userId
          };
          return {
            currentYoutubeUserId: userId,
            followedChannels: getFollowedChannels(newState)
          };
        });
      },

      setCurrentTwitchUser: (userId) => {
        set(() => {
          const newState = {
            ...get(),
            currentTwitchUserId: userId
          };
          return {
            currentTwitchUserId: userId,
            followedChannels: getFollowedChannels(newState)
          };
        });
      },

      addFollowedChannel: (channel) => {
        set(() => {
          const state = get();
          const userKey = getCurrentUserKey(state, channel.platform);
          if (!userKey) return state;

          const currentChannels = state.followedChannelsByUser[userKey] || [];
          const exists = currentChannels.some(
            (item) => item.platform === channel.platform && item.channelId === channel.channelId
          );
          if (exists) return state;

          const newFollowedChannelsByUser = {
            ...state.followedChannelsByUser,
            [userKey]: [...currentChannels, channel]
          };

          const newState = {
            ...state,
            followedChannelsByUser: newFollowedChannelsByUser
          };

          return {
            followedChannelsByUser: newFollowedChannelsByUser,
            followedChannels: getFollowedChannels(newState)
          };
        });
      },

      addFollowedChannels: (channels) => {
        set(() => {
          const state = get();

          if (channels.length === 0) return state;

          // プラットフォームごとにグループ化
          const byPlatform: { [key in Platform]?: FollowedChannel[] } = {};
          channels.forEach((channel) => {
            if (!byPlatform[channel.platform]) {
              byPlatform[channel.platform] = [];
            }
            byPlatform[channel.platform]!.push(channel);
          });

          const newFollowedChannelsByUser = { ...state.followedChannelsByUser };
          let updated = false;

          // プラットフォームごとに処理
          Object.entries(byPlatform).forEach(([platform, platformChannels]) => {
            const userKey = getCurrentUserKey(state, platform as Platform);

            if (!userKey) {
              return;
            }

            const currentChannels = newFollowedChannelsByUser[userKey] || [];
            const currentKeys = new Set(currentChannels.map(makeKey));
            const newOnes = platformChannels!.filter((channel) => !currentKeys.has(makeKey(channel)));

            if (newOnes.length > 0) {
              newFollowedChannelsByUser[userKey] = [...currentChannels, ...newOnes];
              updated = true;
            }
          });

          if (!updated) return state;

          const newState = {
            ...state,
            followedChannelsByUser: newFollowedChannelsByUser
          };

          return {
            followedChannelsByUser: newFollowedChannelsByUser,
            followedChannels: getFollowedChannels(newState)
          };
        });
      },

      removeFollowedChannel: (channelId, platform) => {
        set(() => {
          const state = get();
          const newFollowedChannelsByUser = { ...state.followedChannelsByUser };
          let updated = false;

          if (platform) {
            // 特定プラットフォームから削除
            const userKey = getCurrentUserKey(state, platform);
            if (userKey && newFollowedChannelsByUser[userKey]) {
              const filtered = newFollowedChannelsByUser[userKey].filter(
                (item) => item.channelId !== channelId || item.platform !== platform
              );
              if (filtered.length !== newFollowedChannelsByUser[userKey].length) {
                newFollowedChannelsByUser[userKey] = filtered;
                updated = true;
              }
            }
          } else {
            // すべてのプラットフォームから削除
            const userKeys = getAllCurrentUserKeys(state);
            userKeys.forEach((userKey) => {
              if (newFollowedChannelsByUser[userKey]) {
                const filtered = newFollowedChannelsByUser[userKey].filter(
                  (item) => item.channelId !== channelId
                );
                if (filtered.length !== newFollowedChannelsByUser[userKey].length) {
                  newFollowedChannelsByUser[userKey] = filtered;
                  updated = true;
                }
              }
            });
          }

          if (!updated) return state;

          const newState = {
            ...state,
            followedChannelsByUser: newFollowedChannelsByUser
          };

          return {
            followedChannelsByUser: newFollowedChannelsByUser,
            followedChannels: getFollowedChannels(newState)
          };
        });
      },

      clearFollowedChannels: () => {
        set(() => {
          const state = get();
          const newFollowedChannelsByUser = { ...state.followedChannelsByUser };
          const userKeys = getAllCurrentUserKeys(state);

          userKeys.forEach((userKey) => {
            delete newFollowedChannelsByUser[userKey];
          });

          const newState = {
            ...state,
            followedChannelsByUser: newFollowedChannelsByUser
          };

          return {
            followedChannelsByUser: newFollowedChannelsByUser,
            followedChannels: getFollowedChannels(newState)
          };
        });
      }
    }),
    {
      name: 'fukumado-user',
      version: 2  // バージョンを上げて新しいデータ構造に移行
    }
  )
);
