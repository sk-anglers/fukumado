import { create } from 'zustand';
import {
  SecurityMetrics,
  Alert,
  MainServiceSecurityStats,
  MainServiceHealthCheck,
  AnomalyAlertsResponse,
  SessionStats,
  WebSocketStats,
  SecuritySummary
} from '../types';

interface SecurityState {
  // 管理ダッシュボードのデータ
  securityMetrics: SecurityMetrics | null;
  unreadAlertCount: number;

  // 本サービスのセキュリティデータ
  mainServiceStats: MainServiceSecurityStats | null;
  mainServiceHealth: MainServiceHealthCheck | null;
  mainServiceAlerts: AnomalyAlertsResponse | null;
  mainServiceSessions: SessionStats | null;
  mainServiceWebSocket: WebSocketStats | null;
  mainServiceSummary: SecuritySummary | null;

  // ローディング状態
  isLoading: boolean;
  error: string | null;

  // アクション
  setSecurityMetrics: (metrics: SecurityMetrics) => void;
  addAlert: (alert: Alert) => void;
  markAlertAsRead: (alertId: string) => void;
  markAllAlertsAsRead: () => void;

  // 本サービスのデータ設定
  setMainServiceStats: (stats: MainServiceSecurityStats) => void;
  setMainServiceHealth: (health: MainServiceHealthCheck) => void;
  setMainServiceAlerts: (alerts: AnomalyAlertsResponse) => void;
  setMainServiceSessions: (sessions: SessionStats) => void;
  setMainServiceWebSocket: (websocket: WebSocketStats) => void;
  setMainServiceSummary: (summary: SecuritySummary) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSecurityData: () => void;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  // 初期状態
  securityMetrics: null,
  unreadAlertCount: 0,

  // 本サービスのデータ初期状態
  mainServiceStats: null,
  mainServiceHealth: null,
  mainServiceAlerts: null,
  mainServiceSessions: null,
  mainServiceWebSocket: null,
  mainServiceSummary: null,

  isLoading: false,
  error: null,

  // アクション
  setSecurityMetrics: (metrics) =>
    set({
      securityMetrics: metrics,
      unreadAlertCount: metrics.recentAlerts.filter((a) => !a.read).length,
      error: null
    }),

  addAlert: (alert) =>
    set((state) => {
      if (!state.securityMetrics) return state;

      return {
        securityMetrics: {
          ...state.securityMetrics,
          recentAlerts: [alert, ...state.securityMetrics.recentAlerts]
        },
        unreadAlertCount: state.unreadAlertCount + 1
      };
    }),

  markAlertAsRead: (alertId) =>
    set((state) => {
      if (!state.securityMetrics) return state;

      const updatedAlerts = state.securityMetrics.recentAlerts.map((alert) =>
        alert.id === alertId ? { ...alert, read: true } : alert
      );

      return {
        securityMetrics: {
          ...state.securityMetrics,
          recentAlerts: updatedAlerts
        },
        unreadAlertCount: updatedAlerts.filter((a) => !a.read).length
      };
    }),

  markAllAlertsAsRead: () =>
    set((state) => {
      if (!state.securityMetrics) return state;

      return {
        securityMetrics: {
          ...state.securityMetrics,
          recentAlerts: state.securityMetrics.recentAlerts.map((alert) => ({
            ...alert,
            read: true
          }))
        },
        unreadAlertCount: 0
      };
    }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setError: (error) =>
    set({ error }),

  // 本サービスのデータ設定アクション
  setMainServiceStats: (stats) =>
    set({ mainServiceStats: stats, error: null }),

  setMainServiceHealth: (health) =>
    set({ mainServiceHealth: health, error: null }),

  setMainServiceAlerts: (alerts) =>
    set({ mainServiceAlerts: alerts, error: null }),

  setMainServiceSessions: (sessions) =>
    set({ mainServiceSessions: sessions, error: null }),

  setMainServiceWebSocket: (websocket) =>
    set({ mainServiceWebSocket: websocket, error: null }),

  setMainServiceSummary: (summary) =>
    set({ mainServiceSummary: summary, error: null }),

  clearSecurityData: () =>
    set({
      securityMetrics: null,
      unreadAlertCount: 0,
      mainServiceStats: null,
      mainServiceHealth: null,
      mainServiceAlerts: null,
      mainServiceSessions: null,
      mainServiceWebSocket: null,
      mainServiceSummary: null,
      error: null
    })
}));
