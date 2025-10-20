import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FollowedChannel {
  platform: 'youtube';
  channelId: string;
  label?: string;
}

interface UserState {
  followedChannels: FollowedChannel[];
  addFollowedChannel: (channel: FollowedChannel) => void;
  removeFollowedChannel: (channelId: string) => void;
  clearFollowedChannels: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
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
      removeFollowedChannel: (channelId) => {
        set((state) => ({
          followedChannels: state.followedChannels.filter((item) => item.channelId !== channelId)
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
