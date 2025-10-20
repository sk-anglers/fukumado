import clsx from 'clsx';
import { useLayoutStore } from '../../stores/layoutStore';
import styles from './StreamGrid.module.css';
import { StreamSlotCard } from './StreamSlot/StreamSlot';

export const StreamGrid = (): JSX.Element => {
  const { slots, preset, selectedSlotId, selectSlot } = useLayoutStore((state) => ({
    slots: state.slots,
    preset: state.preset,
    selectedSlotId: state.selectedSlotId,
    selectSlot: state.selectSlot
  }));

  return (
    <div className={clsx(styles.grid, styles[preset])}>
      {slots.map((slot) => (
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
