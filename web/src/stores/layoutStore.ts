import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LayoutPreset, Platform, StreamSlot, Streamer, ChannelSearchResult, VideoQuality } from '../types';

const DEFAULT_ACTIVE_SLOTS = 4;
const TOTAL_SLOT_CAPACITY = 8;
const DEFAULT_VOLUME = 70;

export const MAX_ACTIVE_SLOTS = TOTAL_SLOT_CAPACITY;

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
      quality: source?.quality ?? ('auto' as VideoQuality)
      // assignedStreamは起動時に常にクリア（配信情報は永続化しない）
    };
  });

export interface LayoutState {
  preset: LayoutPreset;
  slots: StreamSlot[];
  selectedSlotId: string | null;
  selectionTimestamp: number;
  showSelection: boolean;
  masterSlotId: string | null;
  mutedAll: boolean;
  masterVolume: number;
  slotsVolumeBeforeZero: number[];
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
}

const initialSlots = createInitialSlots();

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      preset: 'twoByTwo',
      slots: initialSlots,
      selectedSlotId: initialSlots[0]?.id ?? null,
      selectionTimestamp: Date.now(),
      mutedAll: false,
      masterVolume: 100,
      slotsVolumeBeforeZero: [],
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
          // 同じスロットでもタイムスタンプを更新して、選択が更新されたことを通知
          return { selectedSlotId: slotId, showSelection: true, selectionTimestamp: Date.now() };
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

          // 配列をコピーして、変更されたスロットのみ新しいオブジェクトを作成
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

          // 配列をコピーして、変更されたスロットのみ新しいオブジェクトを作成
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

          // 配列をコピーして、変更されたスロットのみ新しいオブジェクトを作成
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

          // 配列をコピーして、変更されたスロットのみ新しいオブジェクトを作成
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

          // 配列をコピーして、変更されたスロットのみ新しいオブジェクトを作成
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
        set((state) => {
          const maxCount = TOTAL_SLOT_CAPACITY;
          const nextCount = Math.min(Math.max(count, 1), maxCount);
          if (nextCount === state.activeSlotsCount) {
            return state;
          }

          // スロット数を減らす場合、配信が割り当てられているスロットを前方に詰める
          let nextSlots = state.slots;
          if (nextCount < state.activeSlotsCount) {
            // 配信があるスロットと空のスロットに分ける
            const slotsWithStream: StreamSlot[] = [];
            const emptySlots: StreamSlot[] = [];

            state.slots.forEach((slot) => {
              if (slot.assignedStream) {
                slotsWithStream.push(slot);
              } else {
                emptySlots.push(slot);
              }
            });

            // 配信があるスロットを前方、空のスロットを後方に配置
            nextSlots = [...slotsWithStream, ...emptySlots];

            console.log('[Layout] スロット数を削減:', state.activeSlotsCount, '->', nextCount);
            console.log('[Layout] 配信あり:', slotsWithStream.length, '空き:', emptySlots.length);
          }

          let nextSelectedId = state.selectedSlotId;
          if (nextSelectedId) {
            const selectedIndex = nextSlots.findIndex((slot) => slot.id === nextSelectedId);
            if (selectedIndex >= nextCount) {
              nextSelectedId = nextSlots[nextCount - 1]?.id ?? null;
            }
          }

          return {
            slots: nextSlots,
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
      setModalOpen: (isOpen) => set({ isModalOpen: isOpen })
    }),
    {
      name: 'fukumado-layout',
      version: 3,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.slots = hydrateSlots(state.slots.length ? state.slots : createInitialSlots());
        state.activeSlotsCount = Math.min(
          Math.max(state.activeSlotsCount ?? DEFAULT_ACTIVE_SLOTS, 1),
          TOTAL_SLOT_CAPACITY
        );
        // slotsVolumeBeforeZeroはセッション固有なのでリロード時にクリア
        state.slotsVolumeBeforeZero = [];
      },
      partialize: (state) => ({
        preset: state.preset,
        slots: state.slots.map(slot => ({
          id: slot.id,
          muted: slot.muted,
          volume: slot.volume,
          quality: slot.quality
        })),
        selectedSlotId: state.selectedSlotId,
        mutedAll: state.mutedAll,
        masterVolume: state.masterVolume,
        activeSlotsCount: state.activeSlotsCount,
        autoQualityEnabled: state.autoQualityEnabled
        // slotsVolumeBeforeZeroは永続化しない（セッション固有の状態）
      })
    }
  )
);
