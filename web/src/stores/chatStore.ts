import { create } from 'zustand';
import type { ChatMessage, Platform } from '../types';

type ChatFilter = 'all' | Platform;

const MAX_MESSAGES = 100;

interface SentMessageCache {
  message: string;
  author: string;
  timestamp: number;
}

interface ChatState {
  filter: ChatFilter;
  messages: ChatMessage[];
  selectedChannelId: string | null;
  recentlySentMessages: SentMessageCache[]; // 最近送信したメッセージのキャッシュ（重複防止用）
  setFilter: (filter: ChatFilter) => void;
  addMessage: (message: ChatMessage) => void;
  setSelectedChannelId: (channelId: string | null) => void;
  addSentMessage: (message: string, author: string) => void;
  isDuplicateSentMessage: (message: string, author: string) => boolean;
  highlightedCount: number;
}

export const useChatStore = create<ChatState>((set, get) => ({
  filter: 'all',
  messages: [],
  selectedChannelId: null,
  recentlySentMessages: [],
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
  addSentMessage: (message, author) =>
    set((state) => {
      const newCache: SentMessageCache = {
        message,
        author,
        timestamp: Date.now()
      };
      const updated = [...state.recentlySentMessages, newCache];

      // 10秒後にキャッシュから削除
      setTimeout(() => {
        set((state) => ({
          recentlySentMessages: state.recentlySentMessages.filter(
            (cache) => cache !== newCache
          )
        }));
      }, 10000);

      return { recentlySentMessages: updated };
    }),
  isDuplicateSentMessage: (message, author) => {
    const state = get();
    const now = Date.now();
    // 10秒以内に送信した同じメッセージかチェック
    return state.recentlySentMessages.some(
      (cache) =>
        cache.message === message &&
        cache.author === author &&
        now - cache.timestamp < 10000
    );
  },
  setSelectedChannelId: (channelId) => set({ selectedChannelId: channelId })
}));
