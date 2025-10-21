import { create } from 'zustand';
import type { ChatMessage, Platform } from '../types';

type ChatFilter = 'all' | Platform;

const MAX_MESSAGES = 100;

interface ChatState {
  filter: ChatFilter;
  messages: ChatMessage[];
  setFilter: (filter: ChatFilter) => void;
  addMessage: (message: ChatMessage) => void;
  highlightedCount: number;
}

const now = new Date();
const formatTime = (date: Date) =>
  date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit'
  });

const baseMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    platform: 'youtube',
    author: 'すずめ',
    message: 'ナイスクラッチ！',
    timestamp: formatTime(new Date(now.getTime() - 5 * 60 * 1000)),
    avatarColor: '#38bdf8',
    highlight: true
  },
  {
    id: 'msg-2',
    platform: 'twitch',
    author: 'cyanrain',
    message: 'おはようございます！今日もよろしく〜',
    timestamp: formatTime(new Date(now.getTime() - 4 * 60 * 1000)),
    avatarColor: '#a855f7'
  },
  {
    id: 'msg-3',
    platform: 'niconico',
    author: 'コメント職人',
    message: '888888888888',
    timestamp: formatTime(new Date(now.getTime() - 3 * 60 * 1000)),
    avatarColor: '#f97316'
  },
  {
    id: 'msg-4',
    platform: 'youtube',
    author: '夜更けの管理人',
    message: 'メンバー限定コンテンツも楽しみです！',
    timestamp: formatTime(new Date(now.getTime() - 2 * 60 * 1000)),
    avatarColor: '#facc15'
  },
  {
    id: 'msg-5',
    platform: 'twitch',
    author: 'GGwp',
    message: 'CLUTCH KING！！！',
    timestamp: formatTime(new Date(now.getTime() - 1 * 60 * 1000)),
    avatarColor: '#22d3ee',
    highlight: true
  }
];

export const useChatStore = create<ChatState>((set, get) => ({
  filter: 'all',
  messages: baseMessages,
  highlightedCount: baseMessages.filter((message) => message.highlight).length,
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
    })
}));
