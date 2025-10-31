import { create } from 'zustand';
import { PVStats } from '../types';

interface PVStore {
  pvStats: PVStats | null;
  loading: boolean;
  error: string | null;
  setPVStats: (stats: PVStats | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePVStore = create<PVStore>((set) => ({
  pvStats: null,
  loading: false,
  error: null,
  setPVStats: (stats) => set({ pvStats: stats }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
