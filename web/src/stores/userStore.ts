import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Platform } from '../types';

export interface FollowedChannel {
  platform: Platform;
  channelId: string;
  label?: string;
}

interface UserState {
  followedChannels: FollowedChannel[];
  addFollowedChannel: (channel: FollowedChannel) => void;
  addFollowedChannels: (channels: FollowedChannel[]) => void;
  removeFollowedChannel: (channelId: string, platform?: Platform) => void;
  clearFollowedChannels: () => void;
}

const makeKey = (channel: FollowedChannel): string => ${channel.platform}:;

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      followedChannels: [],
      addFollowedChannel: (channel) => {
        set((state) => {
          const exists = state.followedChannels.some(
            (item) => item.platform === channel.platform && item.channelId === channel.channelId
          );
          if (exists) {
            return state;
          }
          return {
            followedChannels: [...state.followedChannels, channel]
          };
        });
      },
      addFollowedChannels: (channels) => {
        set((state) => {
          if (channels.length === 0) return state;
          const currentKeys = new Set(state.followedChannels.map(makeKey));
          const newOnes = channels.filter((channel) => !currentKeys.has(makeKey(channel)));
          if (newOnes.length === 0) return state;
          return {
            followedChannels: [...state.followedChannels, ...newOnes]
          };
        });
      },
      removeFollowedChannel: (channelId, platform) => {
        set((state) => ({
          followedChannels: state.followedChannels.filter((item) =>
            platform ? item.channelId !== channelId || item.platform !== platform : item.channelId !== channelId
          )
        }));
      },
      clearFollowedChannels: () => {
        set({ followedChannels: [] });
      }
    }),
    {
      name: 'fukumado-user',
      version: 1
    }
  )
);
