import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LayoutPreset, Platform, StreamSlot, Streamer, ChannelSearchResult, VideoQuality } from '../types';

const DEFAULT_ACTIVE_SLOTS = 4;
const TOTAL_SLOT_CAPACITY = 8;
const DEFAULT_VOLUME = 70;

export const MAX_ACTIVE_SLOTS = TOTAL_SLOT_CAPACITY;

// モバイルかどうかに応じた最大スロット数を取得
const getMaxSlotsForDevice = (): number => {
  if (typeof window === 'undefined') return TOTAL_SLOT_CAPACITY;

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return TOTAL_SLOT_CAPACITY;

  // モバイルは画面の向きに応じて最大スロット数を変更
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  return isLandscape ? 2 : 4; // 横向き: 2枠、縦向き: 4枠
};

const createInitialSlots = (): StreamSlot[] =>
  Array.from({ length: TOTAL_SLOT_CAPACITY }, (_, index) => ({
    id: `slot-${index + 1}`,
    muted: false,
    volume: DEFAULT_VOLUME,
    quality: 'auto' as VideoQuality
  }));

const hydrateSlots = (slots: StreamSlot[]): StreamSlot[] =>
  Array.from({ length: TOTAL_SLOT_CAPACITY }, (_, index) => {
    const source = slots[index];
    return {
      id: source?.id ?? `slot-${index + 1}`,
      muted: source?.muted ?? false,
      volume: source?.volume ?? DEFAULT_VOLUME,
      quality: source?.quality ?? ('auto' as VideoQuality),
      assignedStream: source?.assignedStream
    };
  });

export interface LayoutState {
  preset: LayoutPreset;
  slots: StreamSlot[];
  selectedSlotId: string | null;
  showSelection: boolean;
  masterSlotId: string | null;
  mutedAll: boolean;
  masterVolume: number;
  activeSlotsCount: number;
  availableStreams: Streamer[];
  streamsLoading: boolean;
  streamsError?: string;
  platforms: Platform[];
  searchQuery: string;
  channelSearchResults: ChannelSearchResult[];
  channelSearchLoading: boolean;
  channelSearchError?: string;
  pendingStream: Streamer | null;
  autoQualityEnabled: boolean;
  isModalOpen: boolean;
  userInteracted: boolean;
  slotReadyStates: Record<string, boolean>;
  autoUnmutedApplied: boolean;
  setPreset: (preset: LayoutPreset) => void;
  setUserInteracted: (value: boolean) => void;
  setShowSelection: (value: boolean) => void;
  setMasterSlot: (slotId: string) => void;
  clearMasterSlot: () => void;
  selectSlot: (slotId: string) => void;
  clearSelection: () => void;
  assignStream: (slotId: string, stream: Streamer) => void;
  clearSlot: (slotId: string) => void;
  toggleMuteAll: () => void;
  toggleSlotMute: (slotId: string) => void;
  setVolume: (slotId: string, volume: number) => void;
  setMasterVolume: (volume: number) => void;
  setSlotQuality: (slotId: string, quality: VideoQuality) => void;
  setAutoQualityEnabled: (enabled: boolean) => void;
  swapSlots: (sourceSlotId: string, targetSlotId: string) => void;
  ensureSelection: () => void;
  setActiveSlotsCount: (count: number) => void;
  setAvailableStreamsForPlatform: (platform: Platform, streams: Streamer[]) => void;
  setStreamsLoading: (loading: boolean) => void;
  setStreamsError: (message?: string) => void;
  setSearchQuery: (query: string) => void;
  setChannelSearchResults: (results: ChannelSearchResult[]) => void;
  setChannelSearchLoading: (loading: boolean) => void;
  setChannelSearchError: (error?: string) => void;
  clearChannelSearch: () => void;
  fullscreen: boolean;
  setFullscreen: (value: boolean) => void;
  setPendingStream: (stream: Streamer | null) => void;
  setModalOpen: (isOpen: boolean) => void;
  getMaxSlots: () => number;
  setSlotReady: (slotId: string, ready: boolean) => void;
  resetAutoUnmuted: () => void;
}

const initialSlots = createInitialSlots();

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      preset: 'twoByTwo',
      slots: initialSlots,
      selectedSlotId: initialSlots[0]?.id ?? null,
      mutedAll: false,
      masterVolume: 100,
      activeSlotsCount: DEFAULT_ACTIVE_SLOTS,
      availableStreams: [],
      streamsLoading: false,
      streamsError: undefined,
      fullscreen: false,
      platforms: ['youtube', 'twitch', 'niconico'],
      searchQuery: '',
      channelSearchResults: [],
      channelSearchLoading: false,
      channelSearchError: undefined,
      pendingStream: null,
      autoQualityEnabled: true,
      isModalOpen: false,
      userInteracted: false,
      showSelection: false,
      masterSlotId: null,
      slotReadyStates: {},
      autoUnmutedApplied: false,
      setPreset: (preset) => set({ preset }),
      setUserInteracted: (value) => set({ userInteracted: value }),
      setShowSelection: (value) => set({ showSelection: value }),
      setMasterSlot: (slotId) => set({ masterSlotId: slotId }),
      clearMasterSlot: () => set({ masterSlotId: null }),
      selectSlot: (slotId) =>
        set((state) => {
          const index = state.slots.findIndex((slot) => slot.id === slotId);
          if (index === -1 || index >= state.activeSlotsCount) {
            return state;
          }
          return { selectedSlotId: slotId, showSelection: true };
        }),
      clearSelection: () => set({ selectedSlotId: null }),
      assignStream: (slotId, stream) =>
        set((state) => {
          const index = state.slots.findIndex((slot) => slot.id === slotId);
          if (index === -1 || index >= state.activeSlotsCount) {
            return state;
          }

          // ストリームオブジェクトをコピーして、同期処理の影響を受けないようにする
          const independentStream = { ...stream };

          // 最適化: 変更されたスロットのみ新しいオブジェクト参照を持つ
          const nextSlots = state.slots.slice();
          nextSlots[index] = {
            ...nextSlots[index],
            assignedStream: independentStream
          };

          return { slots: nextSlots };
        }),
      clearSlot: (slotId) =>
        set((state) => {
          const index = state.slots.findIndex((slot) => slot.id === slotId);
          if (index === -1 || index >= state.activeSlotsCount) {
            return state;
          }

          // 最適化: 変更されたスロットのみ新しいオブジェクト参照を持つ
          const nextSlots = state.slots.slice();
          nextSlots[index] = {
            ...nextSlots[index],
            assignedStream: undefined
          };

          return { slots: nextSlots };
        }),
      toggleMuteAll: () =>
        set((state) => {
          const nextMuted = !state.mutedAll;
          return {
            mutedAll: nextMuted,
            slots: state.slots.map((slot) => ({
              ...slot,
              muted: nextMuted
            }))
          };
        }),
      toggleSlotMute: (slotId) =>
        set((state) => {
          const index = state.slots.findIndex((slot) => slot.id === slotId);
          if (index === -1 || index >= state.activeSlotsCount) {
            return state;
          }

          // 最適化: 変更されたスロットのみ新しいオブジェクト参照を持つ
          const nextSlots = state.slots.slice();
          nextSlots[index] = {
            ...nextSlots[index],
            muted: !nextSlots[index].muted
          };

          return {
            slots: nextSlots,
            mutedAll: nextSlots.slice(0, state.activeSlotsCount).every((slot) => slot.muted)
          };
        }),
      setVolume: (slotId, volume) =>
        set((state) => {
          const index = state.slots.findIndex((slot) => slot.id === slotId);
          if (index === -1 || index >= state.activeSlotsCount) {
            return state;
          }

          // 最適化: 変更されたスロットのみ新しいオブジェクト参照を持つ
          const nextSlots = state.slots.slice();
          nextSlots[index] = {
            ...nextSlots[index],
            volume
          };

          return { slots: nextSlots };
        }),
      setMasterVolume: (volume) => set({ masterVolume: volume }),
      setSlotQuality: (slotId, quality) =>
        set((state) => {
          const index = state.slots.findIndex((slot) => slot.id === slotId);
          if (index === -1 || index >= state.activeSlotsCount) {
            return state;
          }

          // 最適化: 変更されたスロットのみ新しいオブジェクト参照を持つ
          const nextSlots = state.slots.slice();
          nextSlots[index] = {
            ...nextSlots[index],
            quality
          };

          return { slots: nextSlots };
        }),
      setAutoQualityEnabled: (enabled) => {
        set({ autoQualityEnabled: enabled });
        // 自動画質が有効になったら、全スロットを'auto'に設定
        if (enabled) {
          set((state) => ({
            slots: state.slots.map((slot) => ({ ...slot, quality: 'auto' as VideoQuality }))
          }));
        }
      },
      swapSlots: (sourceSlotId, targetSlotId) =>
        set((state) => {
          const sourceIndex = state.slots.findIndex((slot) => slot.id === sourceSlotId);
          const targetIndex = state.slots.findIndex((slot) => slot.id === targetSlotId);
          if (
            sourceIndex === -1 ||
            targetIndex === -1 ||
            sourceIndex >= state.activeSlotsCount ||
            targetIndex >= state.activeSlotsCount
          ) {
            return state;
          }

          const nextSlots = state.slots.slice();
          const temp = nextSlots[sourceIndex].assignedStream;
          nextSlots[sourceIndex] = {
            ...nextSlots[sourceIndex],
            assignedStream: nextSlots[targetIndex].assignedStream
          };
          nextSlots[targetIndex] = {
            ...nextSlots[targetIndex],
            assignedStream: temp
          };
          return { slots: nextSlots };
        }),
      ensureSelection: () => {
        const state = get();
        const activeSlots = state.slots.slice(0, state.activeSlotsCount);
        if (activeSlots.length === 0) {
          set({ selectedSlotId: null });
          return;
        }

        if (!state.selectedSlotId) {
          const target =
            activeSlots.find((slot) => !slot.assignedStream)?.id ?? activeSlots[0]?.id ?? null;
          set({ selectedSlotId: target });
          return;
        }

        const currentIndex = activeSlots.findIndex((slot) => slot.id === state.selectedSlotId);
        if (currentIndex === -1) {
          const target =
            activeSlots.find((slot) => !slot.assignedStream)?.id ?? activeSlots[0]?.id ?? null;
          set({ selectedSlotId: target });
        }
      },
      setActiveSlotsCount: (count) => {
        const state = get();
        const maxCount = getMaxSlotsForDevice();
        const nextCount = Math.min(Math.max(count, 1), maxCount);
        if (nextCount === state.activeSlotsCount) {
          return;
        }

        // スロット数が減少する場合、範囲外になるスロットをクリア
        if (nextCount < state.activeSlotsCount) {
          const slotsToRemove = state.slots.slice(nextCount, state.activeSlotsCount);
          slotsToRemove.forEach((slot) => {
            state.clearSlot(slot.id);
          });
        }

        set((state) => {
          let nextSelectedId = state.selectedSlotId;
          if (nextSelectedId) {
            const selectedIndex = state.slots.findIndex((slot) => slot.id === nextSelectedId);
            if (selectedIndex >= nextCount) {
              nextSelectedId = state.slots[nextCount - 1]?.id ?? null;
            }
          }

          return {
            activeSlotsCount: nextCount,
            selectedSlotId: nextSelectedId
          };
        });
        get().ensureSelection();
      },
      setAvailableStreamsForPlatform: (platform, streams) =>
        set((state) => ({
          availableStreams: [
            ...state.availableStreams.filter((item) => item.platform !== platform),
            ...streams
          ]
        })),
      setStreamsLoading: (loading) => set({ streamsLoading: loading }),
      setStreamsError: (message) => set({ streamsError: message }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setChannelSearchResults: (results) => set({ channelSearchResults: results }),
      setChannelSearchLoading: (loading) => set({ channelSearchLoading: loading }),
      setChannelSearchError: (error) => set({ channelSearchError: error }),
      clearChannelSearch: () => set({ channelSearchResults: [], channelSearchError: undefined }),
      setFullscreen: (value) => set({ fullscreen: value }),
      setPendingStream: (stream) => set({ pendingStream: stream }),
      setModalOpen: (isOpen) => set({ isModalOpen: isOpen }),
      getMaxSlots: () => getMaxSlotsForDevice(),
      setSlotReady: (slotId, ready) =>
        set((state) => ({
          slotReadyStates: {
            ...state.slotReadyStates,
            [slotId]: ready
          }
        })),
      resetAutoUnmuted: () => set({ autoUnmutedApplied: false })
    }),
    {
      name: 'fukumado-layout',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.slots = hydrateSlots(state.slots.length ? state.slots : createInitialSlots());
        state.activeSlotsCount = Math.min(
          Math.max(state.activeSlotsCount ?? DEFAULT_ACTIVE_SLOTS, 1),
          TOTAL_SLOT_CAPACITY
        );
      },
      partialize: (state) => ({
        preset: state.preset,
        slots: state.slots,
        selectedSlotId: state.selectedSlotId,
        mutedAll: state.mutedAll,
        masterVolume: state.masterVolume,
        activeSlotsCount: state.activeSlotsCount,
        autoQualityEnabled: state.autoQualityEnabled
      })
    }
  )
);
