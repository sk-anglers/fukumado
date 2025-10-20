import clsx from 'clsx';
import { useLayoutStore } from '../../stores/layoutStore';
import styles from './StreamGrid.module.css';
import { StreamSlotCard } from './StreamSlot/StreamSlot';

export const StreamGrid = (): JSX.Element => {
  const { slots, preset, selectedSlotId, selectSlot, activeSlotsCount } = useLayoutStore((state) => ({
    slots: state.slots,
    preset: state.preset,
    selectedSlotId: state.selectedSlotId,
    selectSlot: state.selectSlot,
    activeSlotsCount: state.activeSlotsCount
  }));

  const activeSlots = slots.slice(0, activeSlotsCount);

  return (
    <div className={clsx(styles.grid, styles[preset], styles[`count${activeSlotsCount}`])}>
      {activeSlots.map((slot) => (
        <StreamSlotCard
          key={slot.id}
          slot={slot}
          isActive={selectedSlotId === slot.id}
          onSelect={() => selectSlot(slot.id)}
        />
      ))}
    </div>
  );
};
