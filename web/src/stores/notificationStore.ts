import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notification, NotificationSettings } from '../types';

const MAX_NOTIFICATIONS = 50;

const defaultSettings: NotificationSettings = {
  enabled: true,
  youtube: true,
  twitch: true,
  sound: false
};

interface NotificationState {
  notifications: Notification[];
  settings: NotificationSettings;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      settings: defaultSettings,

      addNotification: (notification) => {
        const { settings } = get();

        // 通知が無効な場合は追加しない
        if (!settings.enabled) return;

        // プラットフォーム別の設定をチェック
        if (notification.platform === 'youtube' && !settings.youtube) return;
        if (notification.platform === 'twitch' && !settings.twitch) return;

        const newNotification: Notification = {
          ...notification,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          timestamp: Date.now(),
          read: false
        };

        set((state) => {
          const nextNotifications = [newNotification, ...state.notifications];

          // 最大数を超えたら古い通知を削除
          if (nextNotifications.length > MAX_NOTIFICATIONS) {
            nextNotifications.splice(MAX_NOTIFICATIONS);
          }

          return { notifications: nextNotifications };
        });

        // 通知音を再生（設定が有効な場合）
        if (settings.sound) {
          // ブラウザの通知音を再生（将来的にカスタム音源に変更可能）
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTE=');
          audio.play().catch(() => {
            // 音声再生エラーは無視
          });
        }
      },

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          )
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true }))
        })),

      clearAll: () => set({ notifications: [] }),

      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        })),

      getUnreadCount: () => {
        const { notifications } = get();
        return notifications.filter((n) => !n.read).length;
      }
    }),
    {
      name: 'fukumado-notifications',
      version: 1,
      partialize: (state) => ({
        notifications: state.notifications,
        settings: state.settings
      })
    }
  )
);
