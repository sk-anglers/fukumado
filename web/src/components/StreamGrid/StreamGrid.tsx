import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import styles from './StreamGrid.module.css';
import { StreamSlotCard } from './StreamSlot/StreamSlot';

export const StreamGrid = (): JSX.Element => {
  const { slots, preset, selectedSlotId, selectSlot, activeSlotsCount, fullscreen, setFullscreen, clearSelection, isModalOpen } = useLayoutStore((state) => ({
    slots: state.slots,
    preset: state.preset,
    selectedSlotId: state.selectedSlotId,
    selectSlot: state.selectSlot,
    activeSlotsCount: state.activeSlotsCount,
    fullscreen: state.fullscreen,
    setFullscreen: state.setFullscreen,
    clearSelection: state.clearSelection,
    isModalOpen: state.isModalOpen
  }));

  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeSlots = slots.slice(0, activeSlotsCount);

  // 選択状態の自動非表示（3秒後）
  useEffect(() => {
    if (!selectedSlotId || isModalOpen) return;

    // 既存のタイマーをクリア
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }

    // 3秒後に選択を解除
    autoHideTimerRef.current = setTimeout(() => {
      clearSelection();
    }, 3000);

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [selectedSlotId, clearSelection, isModalOpen]);

  // マウス移動時にタイマーをリセット
  const handleMouseMove = (): void => {
    if (!selectedSlotId || isModalOpen) return;

    // タイマーをリセット
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }

    autoHideTimerRef.current = setTimeout(() => {
      clearSelection();
    }, 3000);
  };

  const handleExitFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setFullscreen(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to exit fullscreen', error);
    }
  };

  return (
    <div className={clsx(styles.gridContainer, fullscreen && styles.gridContainerFullscreen)} onMouseMove={handleMouseMove}>
      <div className={clsx(styles.grid, styles[preset], styles[`count${activeSlotsCount}`], fullscreen && styles.gridFullscreen)}>
      {activeSlots.map((slot) => (
        <StreamSlotCard
          key={slot.id}
          slot={slot}
          isActive={selectedSlotId === slot.id}
          onSelect={() => selectSlot(slot.id)}
        />
      ))}
      </div>
      {fullscreen && (
        <div className={styles.fullscreenToggle}>
          <button type="button" onClick={handleExitFullscreen}>
            全画面を終了
          </button>
        </div>
      )}
    </div>
  );
};
