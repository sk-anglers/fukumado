import { ArrowsPointingOutIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { type CSSProperties, useMemo } from 'react';
import { useLayoutStore } from '../../../stores/layoutStore';
import type { StreamSlot } from '../../../types';
import styles from './StreamSlot.module.css';

interface StreamSlotCardProps {
  slot: StreamSlot;
  isActive: boolean;
  onSelect: () => void;
}

const platformColor = {
  youtube: '#ef4444',
  twitch: '#a855f7',
  niconico: '#facc15'
} as const;

const platformLabel = {
  youtube: 'YouTube',
  twitch: 'Twitch',
  niconico: 'ニコニコ'
} as const;

export const StreamSlotCard = ({ slot, isActive, onSelect }: StreamSlotCardProps): JSX.Element => {
  const { setVolume, toggleSlotMute, setPreset } = useLayoutStore((state) => ({
    setVolume: state.setVolume,
    toggleSlotMute: state.toggleSlotMute,
    setPreset: state.setPreset
  }));

  const assignedStream = slot.assignedStream;

  const accentColor = useMemo(() => {
    if (!assignedStream) {
      return 'rgba(148, 163, 184, 0.4)';
    }
    return platformColor[assignedStream.platform];
  }, [assignedStream]);

  const initials = assignedStream
    ? assignedStream.displayName
        .split('')
        .filter((char) => /[A-Za-z0-9\u3040-\u30ff\u4e00-\u9faf]/.test(char))
        .slice(0, 2)
        .join('')
    : '＋';

  return (
    <article
      className={clsx(styles.slot, isActive && styles.active, !assignedStream && styles.empty)}
      style={{ borderColor: isActive ? accentColor : 'transparent' }}
      onClick={() => {
        onSelect();
      }}
    >
      <div className={styles.surface}>
        {assignedStream ? (
          <div className={styles.preview} style={{ '--accent-color': accentColor } as CSSProperties}>
            <div className={styles.previewBackdrop}>
              <div className={styles.noise} />
            </div>
            <div className={styles.previewContent}>
              <span className={styles.previewInitials}>{initials}</span>
              <span className={styles.previewStatus}>LIVE</span>
            </div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>＋</span>
            <p>サイドバーから配信を割り当てましょう</p>
          </div>
        )}

        <div className={styles.overlayTop}>
          {assignedStream ? (
            <div className={styles.platformBadge} style={{ color: accentColor }}>
              {platformLabel[assignedStream.platform]}
            </div>
          ) : (
            <div className={styles.platformBadgeMuted}>空き枠</div>
          )}
          <button
            className={styles.focusButton}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
              setPreset('focus');
            }}
            disabled={!assignedStream}
          >
            <ArrowsPointingOutIcon />
            <span>フォーカス</span>
          </button>
        </div>

        <div className={styles.overlayBottom}>
          {assignedStream ? (
            <>
              <div className={styles.streamInfo}>
                <h3>{assignedStream.title}</h3>
                <div className={styles.streamMeta}>
                  <span>{assignedStream.displayName}</span>
                  <span>{assignedStream.viewerCount.toLocaleString()} 人視聴中</span>
                </div>
              </div>
              <div className={styles.controls}>
                <button
                  className={styles.controlButton}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSlotMute(slot.id);
                  }}
                >
                  {slot.muted ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
                </button>
                <label className={styles.volumeControl}>
                  <span className="sr-only">音量</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={slot.volume}
                    onChange={(event) => {
                      const nextVolume = Number(event.target.value);
                      setVolume(slot.id, nextVolume);
                      if (slot.muted && nextVolume > 0) {
                        toggleSlotMute(slot.id);
                      }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                </label>
              </div>
            </>
          ) : (
            <div className={styles.emptyHint}>枠を選択して配信を追加</div>
          )}
        </div>
      </div>
    </article>
  );
};
