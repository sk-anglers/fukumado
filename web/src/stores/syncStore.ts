import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SyncSettings, SyncInterval } from '../types';

interface SyncState {
  settings: SyncSettings;
  syncing: boolean;
  lastSyncTime?: number;
  manualSyncTrigger: number; // タイムスタンプ、値が変わると手動同期をトリガー

  updateSettings: (partial: Partial<SyncSettings>) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
  triggerManualSync: () => void;
}

const defaultSettings: SyncSettings = {
  enabled: true,
  interval: 60000 // デフォルト1分
};

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      syncing: false,
      lastSyncTime: undefined,
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
        set({ manualSyncTrigger: Date.now() });
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
