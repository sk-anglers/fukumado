import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserSettings } from '../types';

interface SettingsState extends UserSettings {
  // アクション
  setTheme: (theme: 'light' | 'dark') => void;
  setRefreshInterval: (interval: number) => void;
  setEnableNotifications: (enabled: boolean) => void;
  setEnableSounds: (enabled: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings: UserSettings = {
  theme: 'light',
  refreshInterval: 10000,  // 10秒
  enableNotifications: true,
  enableSounds: false
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // 初期状態
      ...defaultSettings,

      // アクション
      setTheme: (theme) =>
        set({ theme }),

      setRefreshInterval: (interval) =>
        set({ refreshInterval: interval }),

      setEnableNotifications: (enabled) =>
        set({ enableNotifications: enabled }),

      setEnableSounds: (enabled) =>
        set({ enableSounds: enabled }),

      resetSettings: () =>
        set(defaultSettings)
    }),
    {
      name: 'fukumado-admin-settings', // localStorage キー
    }
  )
);
