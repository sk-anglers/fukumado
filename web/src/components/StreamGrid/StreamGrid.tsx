import clsx from 'clsx';
import { useLayoutStore } from '../../stores/layoutStore';
import styles from './StreamGrid.module.css';
import { StreamSlotCard } from './StreamSlot/StreamSlot';

export const StreamGrid = (): JSX.Element => {
  const { slots, preset, selectedSlotId, selectSlot, activeSlotsCount, fullscreen, setFullscreen } = useLayoutStore((state) => ({
    slots: state.slots,
    preset: state.preset,
    selectedSlotId: state.selectedSlotId,
    selectSlot: state.selectSlot,
    activeSlotsCount: state.activeSlotsCount,
    fullscreen: state.fullscreen,
    setFullscreen: state.setFullscreen
  }));

  const activeSlots = slots.slice(0, activeSlotsCount);

  const handleEnterFullscreen = async (): Promise<void> => {
    try {
      const element = document.querySelector(`.${styles.gridContainer}`);
      if (!element) return;
      await element.requestFullscreen();
      setFullscreen(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to enter fullscreen', error);
    }
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
    <div className={clsx(styles.gridContainer, fullscreen && styles.gridContainerFullscreen)}>
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
      <div className={styles.fullscreenToggle}>
        {fullscreen ? (
          <button type="button" onClick={handleExitFullscreen}>
            全画面を終了
          </button>
        ) : (
          <button type="button" onClick={handleEnterFullscreen}>
            分割レイアウトを全画面表示
          </button>
        )}
      </div>
    </div>
  );
};
