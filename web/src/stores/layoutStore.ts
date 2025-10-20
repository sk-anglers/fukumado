import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LayoutPreset, Platform, StreamSlot, Streamer } from '../types';

const DEFAULT_ACTIVE_SLOTS = 4;
const TOTAL_SLOT_CAPACITY = 8;
const DEFAULT_VOLUME = 70;

export const MAX_ACTIVE_SLOTS = TOTAL_SLOT_CAPACITY;

const initialStreams: Streamer[] = [
  {
    id: 'yt-1',
    displayName: 'Sorane Tsubame',
    platform: 'youtube',
    title: 'ランクマッチ耐久',
    gameTitle: 'APEX LEGENDS',
    liveSince: '2025-10-20T07:30:00+09:00',
    viewerCount: 12340
  },
  {
    id: 'tw-1',
    displayName: 'neonfox',
    platform: 'twitch',
    title: '深夜作業雑談 #fukumado',
    gameTitle: 'Just Chatting',
    liveSince: '2025-10-20T06:45:00+09:00',
    viewerCount: 3200
  },
  {
    id: 'nc-1',
    displayName: 'Miracle Taro',
    platform: 'niconico',
    title: '歌枠リクエストスペシャル',
    gameTitle: 'Karaoke',
    liveSince: '2025-10-20T08:15:00+09:00',
    viewerCount: 980
  },
  {
    id: 'yt-2',
    displayName: 'Digital Chick',
    platform: 'youtube',
    title: '新作インディーゲーム初見プレイ',
    gameTitle: 'Star Crashers',
    liveSince: '2025-10-20T09:00:00+09:00',
    viewerCount: 8600
  },
  {
    id: 'tw-2',
    displayName: 'MegRhythm',
    platform: 'twitch',
    title: '朝活デイリースクリム',
    gameTitle: 'VALORANT',
    liveSince: '2025-10-20T05:55:00+09:00',
    viewerCount: 4100
  },
  {
    id: 'yt-3',
    displayName: 'YoruKuma',
    platform: 'youtube',
    title: '深夜のパズル全クリ耐久',
    gameTitle: 'Puzzle Storm',
    liveSince: '2025-10-20T07:15:00+09:00',
    viewerCount: 5400
  },
  {
    id: 'tw-3',
    displayName: 'RaccoonLab',
    platform: 'twitch',
    title: '建築勢のサバイバル日誌',
    gameTitle: 'Minecraft',
    liveSince: '2025-10-20T04:20:00+09:00',
    viewerCount: 2800
  },
  {
    id: 'nc-2',
    displayName: 'Fika Network',
    platform: 'niconico',
    title: '朝活ラジオとニュースまとめ',
    gameTitle: 'Talk Show',
    liveSince: '2025-10-20T09:20:00+09:00',
    viewerCount: 1250
  }
];

const createInitialSlots = (): StreamSlot[] =>
  Array.from({ length: TOTAL_SLOT_CAPACITY }, (_, index) => ({
    id: `slot-${index + 1}`,
    muted: false,
    volume: DEFAULT_VOLUME
  }));

const hydrateSlots = (slots: StreamSlot[]): StreamSlot[] =>
  slots.map((slot, index) => ({
    id: slot.id ?? `slot-${index + 1}`,
    muted: slot.muted ?? false,
    volume: slot.volume ?? DEFAULT_VOLUME,
    assignedStream: slot.assignedStream
  }));

export interface LayoutState {
  preset: LayoutPreset;
  slots: StreamSlot[];
  selectedSlotId: string | null;
  mutedAll: boolean;
  activeSlotsCount: number;
  availableStreams: Streamer[];
  platforms: Platform[];
  setPreset: (preset: LayoutPreset) => void;
  selectSlot: (slotId: string) => void;
  assignStream: (slotId: string, stream: Streamer) => void;
  clearSlot: (slotId: string) => void;
  toggleMuteAll: () => void;
  toggleSlotMute: (slotId: string) => void;
  setVolume: (slotId: string, volume: number) => void;
  swapSlots: (sourceSlotId: string, targetSlotId: string) => void;
  ensureSelection: () => void;
  setActiveSlotsCount: (count: number) => void;
}

const initialSlots = createInitialSlots();

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      preset: 'twoByTwo',
      slots: initialSlots,
      selectedSlotId: initialSlots[0]?.id ?? null,
      mutedAll: false,
      activeSlotsCount: DEFAULT_ACTIVE_SLOTS,
      availableStreams: initialStreams,
      platforms: ['youtube', 'twitch', 'niconico'],
      setPreset: (preset) => set({ preset }),
      selectSlot: (slotId) =>
        set((state) => {
          const index = state.slots.findIndex((slot) => slot.id === slotId);
          if (index === -1 || index >= state.activeSlotsCount) {
            return state;
          }
          return { selectedSlotId: slotId };
        }),
      assignStream: (slotId, stream) =>
        set((state) => {
          const index = state.slots.findIndex((slot) => slot.id === slotId);
          if (index === -1 || index >= state.activeSlotsCount) {
            return state;
          }

          return {
            slots: state.slots.map((slot, slotIndex) =>
              slotIndex === index
                ? {
                    ...slot,
                    assignedStream: stream
                  }
                : slot
            )
          };
        }),
      clearSlot: (slotId) =>
        set((state) => {
          const index = state.slots.findIndex((slot) => slot.id === slotId);
          if (index === -1 || index >= state.activeSlotsCount) {
            return state;
          }
          return {
            slots: state.slots.map((slot, slotIndex) =>
              slotIndex === index
                ? {
                    ...slot,
                    assignedStream: undefined
                  }
                : slot
            )
          };
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

          const nextSlots = state.slots.map((slot, slotIndex) =>
            slotIndex === index ? { ...slot, muted: !slot.muted } : slot
          );
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
          return {
            slots: state.slots.map((slot, slotIndex) =>
              slotIndex === index
                ? {
                    ...slot,
                    volume
                  }
                : slot
            )
          };
        }),
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
      }
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
        activeSlotsCount: state.activeSlotsCount
      })
    }
  )
);
