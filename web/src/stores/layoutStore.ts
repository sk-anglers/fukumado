import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LayoutPreset, Platform, StreamSlot, Streamer } from '../types';

export interface LayoutState {
  preset: LayoutPreset;
  slots: StreamSlot[];
  selectedSlotId: string | null;
  mutedAll: boolean;
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
}

const initialStreams: Streamer[] = [
  {
    id: 'yt-1',
    displayName: '空想つばめ',
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
    displayName: 'ミラクル太郎',
    platform: 'niconico',
    title: '歌枠リクエストスペシャル',
    gameTitle: 'Karaoke',
    liveSince: '2025-10-20T08:15:00+09:00',
    viewerCount: 980
  },
  {
    id: 'yt-2',
    displayName: '電子ひよこ',
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
  }
];

const initialSlots: StreamSlot[] = [
  { id: 'slot-1', muted: false, volume: 70 },
  { id: 'slot-2', muted: false, volume: 70 },
  { id: 'slot-3', muted: false, volume: 70 },
  { id: 'slot-4', muted: false, volume: 70 }
];

const hydrateSlots = (slots: StreamSlot[]): StreamSlot[] =>
  slots.map((slot) => ({
    ...slot,
    muted: slot.muted ?? false,
    volume: slot.volume ?? 70
  }));

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      preset: 'twoByTwo',
      slots: initialSlots,
      selectedSlotId: initialSlots[0].id,
      mutedAll: false,
      availableStreams: initialStreams,
      platforms: ['youtube', 'twitch', 'niconico'],
      setPreset: (preset) => set({ preset }),
      selectSlot: (slotId) => set({ selectedSlotId: slotId }),
      assignStream: (slotId, stream) =>
        set((state) => ({
          slots: state.slots.map((slot) =>
            slot.id === slotId
              ? {
                  ...slot,
                  assignedStream: stream
                }
              : slot
          )
        })),
      clearSlot: (slotId) =>
        set((state) => ({
          slots: state.slots.map((slot) =>
            slot.id === slotId
              ? {
                  ...slot,
                  assignedStream: undefined
                }
              : slot
          )
        })),
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
          const nextSlots = state.slots.map((slot) =>
            slot.id === slotId ? { ...slot, muted: !slot.muted } : slot
          );
          return {
            slots: nextSlots,
            mutedAll: nextSlots.every((slot) => slot.muted)
          };
        }),
      setVolume: (slotId, volume) =>
        set((state) => ({
          slots: state.slots.map((slot) =>
            slot.id === slotId
              ? {
                  ...slot,
                  volume
                }
              : slot
          )
        })),
      swapSlots: (sourceSlotId, targetSlotId) =>
        set((state) => {
          const sourceIndex = state.slots.findIndex((slot) => slot.id === sourceSlotId);
          const targetIndex = state.slots.findIndex((slot) => slot.id === targetSlotId);
          if (sourceIndex === -1 || targetIndex === -1) {
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
        if (!state.selectedSlotId) {
          const target = state.slots.find((slot) => !slot.assignedStream)?.id ?? state.slots[0]?.id ?? null;
          set({ selectedSlotId: target });
        }
      }
    }),
    {
      name: 'fukumado-layout',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.slots = hydrateSlots(state.slots);
      },
      partialize: (state) => ({
        preset: state.preset,
        slots: state.slots,
        selectedSlotId: state.selectedSlotId,
        mutedAll: state.mutedAll
      })
    }
  )
);
