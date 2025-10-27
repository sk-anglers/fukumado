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

interface MetricsState {
  // データ
  systemMetrics: SystemMetrics | null;
  twitchRateLimit: TwitchRateLimit | null;
  youtubeQuota: YouTubeQuota | null;

  // 履歴データ（最大60ポイント = 5分間分）
  metricsHistory: MetricsHistoryPoint[];

  // 接続状態
  connectionStatus: ConnectionStatus;
  lastUpdate: string | null;
  error: string | null;

  // アクション
  setSystemMetrics: (metrics: SystemMetrics) => void;
  setTwitchRateLimit: (rateLimit: TwitchRateLimit) => void;
  setYoutubeQuota: (quota: YouTubeQuota) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  clearMetrics: () => void;
}

export const useMetricsStore = create<MetricsState>((set, get) => ({
  // 初期状態
  systemMetrics: null,
  twitchRateLimit: null,
  youtubeQuota: null,
  metricsHistory: [],
  connectionStatus: 'disconnected',
  lastUpdate: null,
  error: null,

  // アクション
  setSystemMetrics: (metrics) =>
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

      return {
        systemMetrics: metrics,
        metricsHistory: newHistory,
        lastUpdate: new Date().toISOString(),
        error: null
      };
    }),

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
      lastUpdate: null,
      error: null
    })
}));
