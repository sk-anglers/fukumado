import { create } from 'zustand';

interface DataUsageState {
  totalBytes: number;
  sessionStartTime: number;
  addUsage: (bytes: number) => void;
  reset: () => void;
  getTotalMB: () => number;
  getTotalGB: () => number;
  getSessionDuration: () => number;
}

// セッションストレージから前回の値を復元
const loadFromSession = (): { totalBytes: number; sessionStartTime: number } => {
  try {
    const stored = sessionStorage.getItem('fukumado-data-usage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        totalBytes: parsed.totalBytes || 0,
        sessionStartTime: parsed.sessionStartTime || Date.now()
      };
    }
  } catch (error) {
    console.error('[DataUsage] セッションストレージ読み込みエラー:', error);
  }
  return {
    totalBytes: 0,
    sessionStartTime: Date.now()
  };
};

// セッションストレージに保存
const saveToSession = (totalBytes: number, sessionStartTime: number): void => {
  try {
    sessionStorage.setItem('fukumado-data-usage', JSON.stringify({ totalBytes, sessionStartTime }));
  } catch (error) {
    console.error('[DataUsage] セッションストレージ書き込みエラー:', error);
  }
};

const initialState = loadFromSession();

export const useDataUsageStore = create<DataUsageState>()((set, get) => ({
  totalBytes: initialState.totalBytes,
  sessionStartTime: initialState.sessionStartTime,

  addUsage: (bytes) => {
    set((state) => {
      const newTotal = state.totalBytes + bytes;
      saveToSession(newTotal, state.sessionStartTime);
      return { totalBytes: newTotal };
    });
  },

  reset: () => {
    const newStartTime = Date.now();
    set({ totalBytes: 0, sessionStartTime: newStartTime });
    saveToSession(0, newStartTime);
  },

  getTotalMB: () => {
    const { totalBytes } = get();
    return totalBytes / (1024 * 1024);
  },

  getTotalGB: () => {
    const { totalBytes } = get();
    return totalBytes / (1024 * 1024 * 1024);
  },

  getSessionDuration: () => {
    const { sessionStartTime } = get();
    return Math.floor((Date.now() - sessionStartTime) / 1000);
  }
}));
