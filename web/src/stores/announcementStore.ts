import { create } from 'zustand';
import { getActiveAnnouncements, type Announcement } from '../api/announcements';

const DISMISSED_ANNOUNCEMENTS_KEY = 'fukumado_dismissed_announcements';

interface AnnouncementState {
  // 状態
  announcements: Announcement[];
  dismissedIds: Set<string>;
  loading: boolean;
  error: string | null;

  // アクション
  loadAnnouncements: () => Promise<void>;
  dismissAnnouncement: (id: string) => void;
  clearDismissed: () => void;
  getVisibleAnnouncements: () => Announcement[];
  setError: (error: string | null) => void;
}

/**
 * ローカルストレージから閉じられたお知らせIDを取得
 */
const loadDismissedIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Set(Array.isArray(parsed) ? parsed : []);
    }
  } catch (error) {
    console.error('[AnnouncementStore] Error loading dismissed IDs:', error);
  }
  return new Set();
};

/**
 * ローカルストレージに閉じられたお知らせIDを保存
 */
const saveDismissedIds = (ids: Set<string>): void => {
  try {
    localStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.error('[AnnouncementStore] Error saving dismissed IDs:', error);
  }
};

export const useAnnouncementStore = create<AnnouncementState>((set, get) => ({
  // 初期状態
  announcements: [],
  dismissedIds: loadDismissedIds(),
  loading: false,
  error: null,

  // アクティブなお知らせを読み込む
  loadAnnouncements: async () => {
    try {
      set({ loading: true, error: null });
      const announcements = await getActiveAnnouncements();

      // 優先度順にソート（既にサーバー側でソート済みだが念のため）
      const sorted = announcements.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      set({ announcements: sorted, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'お知らせの取得に失敗しました';
      set({ error: errorMessage, loading: false });
      console.error('[AnnouncementStore] Error loading announcements:', error);
    }
  },

  // お知らせを閉じる
  dismissAnnouncement: (id: string) => {
    const { dismissedIds } = get();
    const newDismissedIds = new Set(dismissedIds);
    newDismissedIds.add(id);
    saveDismissedIds(newDismissedIds);
    set({ dismissedIds: newDismissedIds });
  },

  // 閉じたお知らせをクリア（全て再表示）
  clearDismissed: () => {
    saveDismissedIds(new Set());
    set({ dismissedIds: new Set() });
  },

  // 表示すべきお知らせを取得（閉じられていないもの）
  getVisibleAnnouncements: () => {
    const { announcements, dismissedIds } = get();
    return announcements.filter(announcement => !dismissedIds.has(announcement.id));
  },

  // エラーを設定
  setError: (error: string | null) => {
    set({ error });
  }
}));

/**
 * お知らせの自動更新を開始
 * @param intervalMs 更新間隔（ミリ秒）デフォルト: 5分
 */
export const startAnnouncementAutoUpdate = (intervalMs: number = 5 * 60 * 1000): (() => void) => {
  const store = useAnnouncementStore.getState();

  // 初回読み込み
  store.loadAnnouncements();

  // 定期的に更新
  const intervalId = setInterval(() => {
    store.loadAnnouncements();
  }, intervalMs);

  // クリーンアップ関数を返す
  return () => {
    clearInterval(intervalId);
  };
};
