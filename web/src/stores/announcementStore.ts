import { create } from 'zustand';
import { getActiveAnnouncements, type Announcement } from '../api/announcements';

const DISMISSED_ANNOUNCEMENTS_KEY = 'fukumado_dismissed_announcements';

interface AnnouncementState {
  // 状態
  announcements: Announcement[];
  dismissedVersions: Map<string, number>; // id -> 閉じた時のversion
  loading: boolean;
  error: string | null;

  // アクション
  loadAnnouncements: () => Promise<void>;
  dismissAnnouncement: (id: string, version: number) => void;
  clearDismissed: () => void;
  getVisibleAnnouncements: () => Announcement[];
  setError: (error: string | null) => void;
}

/**
 * ローカルストレージから閉じられたお知らせID->versionマップを取得
 */
const loadDismissedVersions = (): Map<string, number> => {
  try {
    const stored = localStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // オブジェクト形式 {id: version} から Map へ変換
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return new Map(Object.entries(parsed).map(([id, version]) => [id, version as number]));
      }
      // 旧形式（配列）の場合は version=1 として扱う（後方互換性）
      if (Array.isArray(parsed)) {
        return new Map(parsed.map(id => [id, 1]));
      }
    }
  } catch (error) {
    console.error('[AnnouncementStore] Error loading dismissed versions:', error);
  }
  return new Map();
};

/**
 * ローカルストレージに閉じられたお知らせID->versionマップを保存
 */
const saveDismissedVersions = (versions: Map<string, number>): void => {
  try {
    // Map を オブジェクト形式 {id: version} に変換
    const obj: Record<string, number> = {};
    versions.forEach((version, id) => {
      obj[id] = version;
    });
    localStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('[AnnouncementStore] Error saving dismissed versions:', error);
  }
};

export const useAnnouncementStore = create<AnnouncementState>((set, get) => ({
  // 初期状態
  announcements: [],
  dismissedVersions: loadDismissedVersions(),
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

  // お知らせを閉じる（id と version を記録）
  dismissAnnouncement: (id: string, version: number) => {
    const { dismissedVersions } = get();
    const newDismissedVersions = new Map(dismissedVersions);
    newDismissedVersions.set(id, version);
    saveDismissedVersions(newDismissedVersions);
    set({ dismissedVersions: newDismissedVersions });
  },

  // 閉じたお知らせをクリア（全て再表示）
  clearDismissed: () => {
    saveDismissedVersions(new Map());
    set({ dismissedVersions: new Map() });
  },

  // 表示すべきお知らせを取得
  // お知らせのforceDisplayVersionが、閉じた時のversionより大きければ再表示
  getVisibleAnnouncements: () => {
    const { announcements, dismissedVersions } = get();
    return announcements.filter(announcement => {
      const dismissedVersion = dismissedVersions.get(announcement.id);
      // 閉じられていない、または閉じた時より新しいバージョンなら表示
      return dismissedVersion === undefined || announcement.forceDisplayVersion > dismissedVersion;
    });
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
