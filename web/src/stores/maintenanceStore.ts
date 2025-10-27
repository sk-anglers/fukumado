import { create } from 'zustand';

interface MaintenanceState {
  enabled: boolean;
  message: string;
  enabledAt?: string;
  duration?: number; // 分単位、0=無期限
  scheduledEndAt?: string;
  setMaintenance: (data: {
    enabled: boolean;
    message?: string;
    enabledAt?: string;
    duration?: number;
    scheduledEndAt?: string;
  }) => void;
  clearMaintenance: () => void;
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  enabled: false,
  message: '',
  enabledAt: undefined,
  duration: undefined,
  scheduledEndAt: undefined,
  setMaintenance: (data) =>
    set({
      enabled: data.enabled,
      message: data.message || '',
      enabledAt: data.enabledAt,
      duration: data.duration,
      scheduledEndAt: data.scheduledEndAt
    }),
  clearMaintenance: () =>
    set({
      enabled: false,
      message: '',
      enabledAt: undefined,
      duration: undefined,
      scheduledEndAt: undefined
    })
}));
