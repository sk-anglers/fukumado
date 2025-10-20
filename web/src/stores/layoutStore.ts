import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LayoutPreset, Platform, StreamSlot, Streamer } from '../types';

const DEFAULT_ACTIVE_SLOTS = 4;
const TOTAL_SLOT_CAPACITY = 8;
const DEFAULT_VOLUME = 70;

export const MAX_ACTIVE_SLOTS = TOTAL_SLOT_CAPACITY;

const createInitialSlots = (): StreamSlot[] =>
  Array.from({ length: TOTAL_SLOT_CAPACITY }, (_, index) => ({
    id: `slot-${index + 1}`,
    muted: false,
    volume: DEFAULT_VOLUME
  }));

const hydrateSlots = (slots: StreamSlot[]): StreamSlot[] =>
  Array.from({ length: TOTAL_SLOT_CAPACITY }, (_, index) => {
    const source = slots[index];
    return {
      id: source?.id ?? `slot-${index + 1}`,
      muted: source?.muted ?? false,
      volume: source?.volume ?? DEFAULT_VOLUME,
      assignedStream: source?.assignedStream
    };
  });

export interface LayoutState {
  preset: LayoutPreset;
  slots: StreamSlot[];
  selectedSlotId: string | null;
  mutedAll: boolean;
  activeSlotsCount: number;
  availableStreams: Streamer[];
  streamsLoading: boolean;
  streamsError?: string;
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
  setAvailableStreamsForPlatform: (platform: Platform, streams: Streamer[]) => void;
  setStreamsLoading: (loading: boolean) => void;
  setStreamsError: (message?: string) => void;
  fullscreen: boolean;
  setFullscreen: (value: boolean) => void;
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
      availableStreams: [],
      streamsLoading: false,
      streamsError: undefined,
      fullscreen: false,
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
      setFullscreen: (value) => set({ fullscreen: value })
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
