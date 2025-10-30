import { create } from 'zustand';
import {
  SystemMetrics,
  TwitchRateLimit,
  YouTubeQuota,
  ConnectionStatus
} from '../types';

// グラフ用の履歴データポイント
export interface MetricsHistoryPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  wsConnections: number;
  streamSyncCount: number;
  twitchUsagePercent?: number;
  youtubeUsagePercent?: number;
}

// API統計履歴データポイント
export interface ApiStatsPoint {
  timestamp: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
}

interface MetricsState {
  // データ
  systemMetrics: SystemMetrics | null;
  twitchRateLimit: TwitchRateLimit | null;
  youtubeQuota: YouTubeQuota | null;

  // 履歴データ（最大60ポイント = 5分間分）
  metricsHistory: MetricsHistoryPoint[];
  apiStatsHistory: ApiStatsPoint[];

  // 接続状態
  connectionStatus: ConnectionStatus;
  lastUpdate: string | null;
  error: string | null;

  // アクション
  setSystemMetrics: (metrics: SystemMetrics) => void;
  setTwitchRateLimit: (rateLimit: TwitchRateLimit) => void;
  setYoutubeQuota: (quota: YouTubeQuota) => void;
  setApiStats: (stats: { totalCalls: number; successfulCalls: number; failedCalls: number; averageResponseTime: number }) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  clearMetrics: () => void;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  // 初期状態
  systemMetrics: null,
  twitchRateLimit: null,
  youtubeQuota: null,
  metricsHistory: [],
  apiStatsHistory: [],
  connectionStatus: 'disconnected',
  lastUpdate: null,
  error: null,

  // アクション
  setSystemMetrics: (metrics) => {
    console.log('[DEBUG] metricsStore: setSystemMetrics called');
    set((state) => {
      const { twitchRateLimit, youtubeQuota, metricsHistory } = state;

      // 履歴データポイントを作成
      const historyPoint: MetricsHistoryPoint = {
        timestamp: metrics.timestamp,
        cpu: metrics.cpu,
        memory: metrics.memory,
        wsConnections: metrics.wsConnections,
        streamSyncCount: metrics.streamSyncCount,
        twitchUsagePercent: twitchRateLimit?.usagePercent,
        youtubeUsagePercent: youtubeQuota?.usagePercent
      };

      // 最大60ポイントまで保持（5分間分）
      const newHistory = [...metricsHistory, historyPoint].slice(-60);

      console.log('[DEBUG] metricsStore: setSystemMetrics updating state');
      return {
        systemMetrics: metrics,
        metricsHistory: newHistory,
        lastUpdate: new Date().toISOString(),
        error: null
      };
    });
    console.log('[DEBUG] metricsStore: setSystemMetrics completed');
  },

  setTwitchRateLimit: (rateLimit) =>
    set({
      twitchRateLimit: rateLimit,
      error: null
    }),

  setYoutubeQuota: (quota) =>
    set({
      youtubeQuota: quota,
      error: null
    }),

  setApiStats: (stats) =>
    set((state) => {
      const { apiStatsHistory } = state;

      // 履歴データポイントを作成
      const historyPoint: ApiStatsPoint = {
        timestamp: new Date().toISOString(),
        totalCalls: stats.totalCalls,
        successfulCalls: stats.successfulCalls,
        failedCalls: stats.failedCalls,
        averageResponseTime: stats.averageResponseTime
      };

      // 最大60ポイントまで保持（5分間分）
      const newHistory = [...apiStatsHistory, historyPoint].slice(-60);

      return {
        apiStatsHistory: newHistory,
        error: null
      };
    }),

  setConnectionStatus: (status) =>
    set({ connectionStatus: status }),

  setError: (error) =>
    set({ error }),

  clearMetrics: () =>
    set({
      systemMetrics: null,
      twitchRateLimit: null,
      youtubeQuota: null,
      metricsHistory: [],
      apiStatsHistory: [],
      lastUpdate: null,
      error: null
    })
}));
