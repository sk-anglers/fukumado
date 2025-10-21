import { XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useLayoutStore } from '../../stores/layoutStore';
import type { Streamer } from '../../types';
import styles from './SlotSelectionModal.module.css';

interface SlotSelectionModalProps {
  stream: Streamer;
  onClose: () => void;
}

const platformColor = {
  youtube: '#ef4444',
  twitch: '#a855f7',
  niconico: '#facc15'
} as const;

export const SlotSelectionModal = ({ stream, onClose }: SlotSelectionModalProps): JSX.Element => {
  const { slots, activeSlotsCount, preset, assignStream } = useLayoutStore((state) => ({
    slots: state.slots,
    activeSlotsCount: state.activeSlotsCount,
    preset: state.preset,
    assignStream: state.assignStream
  }));

  const activeSlots = slots.slice(0, activeSlotsCount);

  const handleSlotClick = (slotId: string): void => {
    assignStream(slotId, stream);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>配置する枠を選択</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            <XMarkIcon />
          </button>
        </div>

        <div className={styles.streamInfo}>
          <span
            className={styles.platformBadge}
            style={{ color: platformColor[stream.platform] }}
          >
            {stream.platform.toUpperCase()}
          </span>
          <div className={styles.streamDetails}>
            <span className={styles.displayName}>{stream.displayName}</span>
            <span className={styles.title}>{stream.title}</span>
          </div>
        </div>

        <div className={clsx(styles.slotGrid, styles[preset], styles[`count${activeSlotsCount}`])}>
          {activeSlots.map((slot, index) => {
            const assigned = slot.assignedStream;
            return (
              <button
                key={slot.id}
                type="button"
                className={clsx(
                  styles.slotButton,
                  assigned && styles.slotButtonAssigned
                )}
                onClick={() => handleSlotClick(slot.id)}
              >
                <div className={styles.slotNumber}>枠 {index + 1}</div>
                {assigned ? (
                  <div className={styles.slotContent}>
                    <span
                      className={styles.slotStreamer}
                      style={{ color: platformColor[assigned.platform] }}
                    >
                      {assigned.displayName}
                    </span>
                    <span className={styles.slotTitle}>{assigned.title}</span>
                  </div>
                ) : (
                  <div className={styles.slotEmpty}>空き枠</div>
                )}
              </button>
            );
          })}
        </div>

        <div className={styles.footer}>
          <p>配置する枠をクリックしてください</p>
        </div>
      </div>
    </div>
  );
};
