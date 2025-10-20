import { SquaresPlusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { type Streamer } from '../../types';
import { useLayoutStore } from '../../stores/layoutStore';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onOpenPresetModal: () => void;
}

const platformLabel: Record<Streamer['platform'], string> = {
  youtube: 'YouTube Live',
  twitch: 'Twitch',
  niconico: 'ニコニコ生放送'
};

const platformAccent: Record<Streamer['platform'], string> = {
  youtube: '#ef4444',
  twitch: '#a855f7',
  niconico: '#facc15'
};

export const Sidebar = ({ onOpenPresetModal }: SidebarProps): JSX.Element => {
  const {
    slots,
    selectedSlotId,
    selectSlot,
    availableStreams,
    assignStream,
    clearSlot,
    ensureSelection
  } = useLayoutStore((state) => ({
    slots: state.slots,
    selectedSlotId: state.selectedSlotId,
    selectSlot: state.selectSlot,
    availableStreams: state.availableStreams,
    assignStream: state.assignStream,
    clearSlot: state.clearSlot,
    ensureSelection: state.ensureSelection
  }));

  const activeSlot = slots.find((slot) => slot.id === selectedSlotId) ?? slots[0];
  const activeSlotIndex = activeSlot ? slots.indexOf(activeSlot) : -1;
  const activeSlotLabel = activeSlotIndex >= 0 ? activeSlotIndex + 1 : '―';

  return (
    <aside className={styles.sidebar}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>視聴枠</h2>
          <button className={styles.sectionAction} type="button" onClick={onOpenPresetModal}>
            <SquaresPlusIcon />
            <span>プリセット</span>
          </button>
        </div>
        <div className={styles.slotList}>
          {slots.map((slot, index) => (
            <button
              key={slot.id}
              type="button"
              className={clsx(styles.slotButton, selectedSlotId === slot.id && styles.slotButtonActive)}
              onClick={() => {
                selectSlot(slot.id);
                ensureSelection();
              }}
            >
              <div className={styles.slotIndex}>枠 {index + 1}</div>
              <div className={styles.slotContent}>
                {slot.assignedStream ? (
                  <>
                    <span
                      className={styles.streamerName}
                      style={{ color: platformAccent[slot.assignedStream.platform] }}
                    >
                      {slot.assignedStream.displayName}
                    </span>
                    <span className={styles.streamTitle}>{slot.assignedStream.title}</span>
                  </>
                ) : (
                  <span className={styles.slotEmpty}>未割り当て</span>
                )}
              </div>
              {slot.assignedStream && (
                <button
                  type="button"
                  className={styles.slotRemove}
                  onClick={(event) => {
                    event.stopPropagation();
                    clearSlot(slot.id);
                  }}
                >
                  ×
                </button>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>フォロー中の配信</h2>
          <span className={styles.sectionHint}>選択中の枠: 枠 {activeSlotLabel}</span>
        </div>
        <ul className={styles.streamList}>
          {availableStreams.map((stream) => (
            <li key={stream.id} className={styles.streamListItem}>
              <div className={styles.streamHeader}>
                <span className={styles.streamerLabel}>{stream.displayName}</span>
                <span className={styles.platformTag} style={{ color: platformAccent[stream.platform] }}>
                  {platformLabel[stream.platform]}
                </span>
              </div>
              <p className={styles.streamTitle}>{stream.title}</p>
              <div className={styles.streamMeta}>
                <span>{stream.gameTitle}</span>
                <span>視聴 {stream.viewerCount.toLocaleString()} 人</span>
              </div>
              {activeSlot ? (
                <button
                  type="button"
                  className={styles.assignButton}
                  onClick={() => {
                    assignStream(activeSlot.id, stream);
                    if (!selectedSlotId) {
                      ensureSelection();
                    }
                  }}
                >
                  この枠に割り当て
                </button>
              ) : (
                <div className={styles.assignDisabled}>枠がありません</div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>連携プラットフォーム</h2>
        </div>
        <ul className={styles.accountList}>
          <li>
            <span className={styles.accountPlatform}>YouTube</span>
            <button type="button">連携予定</button>
          </li>
          <li>
            <span className={styles.accountPlatform}>Twitch</span>
            <button type="button">連携予定</button>
          </li>
          <li>
            <span className={styles.accountPlatform}>ニコニコ</span>
            <button type="button">連携予定</button>
          </li>
        </ul>
      </section>
    </aside>
  );
};
