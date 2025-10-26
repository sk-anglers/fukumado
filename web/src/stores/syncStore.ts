import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SyncSettings, SyncInterval } from '../types';

interface SyncState {
  settings: SyncSettings;
  syncing: boolean;
  lastSyncTime?: number;
  lastManualSyncTime?: number;
  lastFollowChannelSyncTime?: number;
  manualSyncTrigger: number; // タイムスタンプ、値が変わると手動同期をトリガー

  updateSettings: (partial: Partial<SyncSettings>) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
  triggerManualSync: () => void;
  canManualSync: () => boolean;
  getRemainingCooldown: () => number;
  recordFollowChannelSync: () => boolean;
  canFollowChannelSync: () => boolean;
  getFollowChannelRemainingCooldown: () => number;
}

const defaultSettings: SyncSettings = {
  enabled: true,
  interval: 60000 // デフォルト1分
};

const MANUAL_SYNC_COOLDOWN_MS = 60000; // 60秒
const FOLLOW_CHANNEL_SYNC_COOLDOWN_MS = 60000; // 60秒

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      syncing: false,
      lastSyncTime: undefined,
      lastManualSyncTime: undefined,
      lastFollowChannelSyncTime: undefined,
      manualSyncTrigger: 0,

      updateSettings: (partial) => {
        set((state) => ({
          settings: { ...state.settings, ...partial }
        }));
      },

      setSyncing: (syncing) => {
        set({ syncing });
      },

      setLastSyncTime: (time) => {
        set({ lastSyncTime: time });
      },

      triggerManualSync: () => {
        const now = Date.now();
        const { lastManualSyncTime } = get();

        // クールダウンチェック
        if (lastManualSyncTime && now - lastManualSyncTime < MANUAL_SYNC_COOLDOWN_MS) {
          const remaining = Math.ceil((MANUAL_SYNC_COOLDOWN_MS - (now - lastManualSyncTime)) / 1000);
          console.log(`[手動同期] クールダウン中です。あと${remaining}秒お待ちください。`);
          return;
        }

        set({
          manualSyncTrigger: now,
          lastManualSyncTime: now
        });
      },

      canManualSync: () => {
        const { lastManualSyncTime } = get();
        if (!lastManualSyncTime) return true;

        const now = Date.now();
        return now - lastManualSyncTime >= MANUAL_SYNC_COOLDOWN_MS;
      },

      getRemainingCooldown: () => {
        const { lastManualSyncTime } = get();
        if (!lastManualSyncTime) return 0;

        const now = Date.now();
        const elapsed = now - lastManualSyncTime;
        const remaining = MANUAL_SYNC_COOLDOWN_MS - elapsed;

        return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
      },

      recordFollowChannelSync: () => {
        const now = Date.now();
        const { lastFollowChannelSyncTime } = get();

        // クールダウンチェック
        if (lastFollowChannelSyncTime && now - lastFollowChannelSyncTime < FOLLOW_CHANNEL_SYNC_COOLDOWN_MS) {
          const remaining = Math.ceil((FOLLOW_CHANNEL_SYNC_COOLDOWN_MS - (now - lastFollowChannelSyncTime)) / 1000);
          console.log(`[フォローチャンネル同期] クールダウン中です。あと${remaining}秒お待ちください。`);
          return false;
        }

        set({ lastFollowChannelSyncTime: now });
        return true;
      },

      canFollowChannelSync: () => {
        const { lastFollowChannelSyncTime } = get();
        if (!lastFollowChannelSyncTime) return true;

        const now = Date.now();
        return now - lastFollowChannelSyncTime >= FOLLOW_CHANNEL_SYNC_COOLDOWN_MS;
      },

      getFollowChannelRemainingCooldown: () => {
        const { lastFollowChannelSyncTime } = get();
        if (!lastFollowChannelSyncTime) return 0;

        const now = Date.now();
        const elapsed = now - lastFollowChannelSyncTime;
        const remaining = FOLLOW_CHANNEL_SYNC_COOLDOWN_MS - elapsed;

        return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
      }
    }),
    {
      name: 'fukumado-sync',
      version: 1,
      partialize: (state) => ({
        settings: state.settings
        // syncingやlastSyncTimeは永続化しない（セッション固有の状態）
      })
    }
  )
);

// 同期間隔の選択肢（ミリ秒 -> ラベル）
export const SYNC_INTERVAL_OPTIONS: Array<{ value: SyncInterval; label: string }> = [
  { value: 30000, label: '30秒' },
  { value: 60000, label: '1分' },
  { value: 180000, label: '3分' },
  { value: 300000, label: '5分' }
];
