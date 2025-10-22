import { create } from 'zustand';
import type { ChatMessage, Platform } from '../types';

type ChatFilter = 'all' | Platform;

const MAX_MESSAGES = 100;

interface ChatState {
  filter: ChatFilter;
  messages: ChatMessage[];
  selectedChannelId: string | null;
  setFilter: (filter: ChatFilter) => void;
  addMessage: (message: ChatMessage) => void;
  setSelectedChannelId: (channelId: string | null) => void;
  highlightedCount: number;
}

export const useChatStore = create<ChatState>((set, get) => ({
  filter: 'all',
  messages: [],
  selectedChannelId: null,
  highlightedCount: 0,
  setFilter: (filter) => set({ filter }),
  addMessage: (message) =>
    set((state) => {
      // 新しいメッセージを先頭に追加（上から下に流れる）
      const nextMessages = [message, ...state.messages];
      // 最大数を超えたら末尾から削除
      if (nextMessages.length > MAX_MESSAGES) {
        nextMessages.splice(MAX_MESSAGES);
      }
      return {
        messages: nextMessages,
        highlightedCount: nextMessages.filter((entry) => entry.highlight).length
      };
    }),
  setSelectedChannelId: (channelId) => set({ selectedChannelId: channelId })
}));
