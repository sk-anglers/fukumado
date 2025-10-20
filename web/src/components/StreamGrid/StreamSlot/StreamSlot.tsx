import { ArrowsPointingOutIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useLayoutStore } from '../../../stores/layoutStore';
import type { StreamSlot } from '../../../types';
import { loadYouTubeIframeApi } from '../../../hooks/useYouTubeIframeApi';
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

const formatViewerLabel = (viewerCount?: number): string =>
  viewerCount != null ? `${viewerCount.toLocaleString()} 人視聴中` : '視聴者数 -';

export const StreamSlotCard = ({ slot, isActive, onSelect }: StreamSlotCardProps): JSX.Element => {
  const { setVolume, toggleSlotMute, setPreset } = useLayoutStore((state) => ({
    setVolume: state.setVolume,
    toggleSlotMute: state.toggleSlotMute,
    setPreset: state.setPreset
  }));

  const assignedStream = slot.assignedStream;
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<YT.Player | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

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

  const viewerLabel =
    assignedStream && assignedStream.viewerCount != null
      ? `${assignedStream.viewerCount.toLocaleString()} 人視聴中`
      : '視聴者数 -';

  useEffect(() => {
    setPlayerReady(false);
    let isMounted = true;

    const setupPlayer = async (): Promise<void> => {
      if (!assignedStream || !playerContainerRef.current) {
        playerInstanceRef.current?.destroy();
        playerInstanceRef.current = null;
        setPlayerReady(false);
        return;
      }

      try {
        const YT = await loadYouTubeIframeApi();
        if (!isMounted || !playerContainerRef.current) return;

        playerInstanceRef.current?.destroy();
        playerInstanceRef.current = new YT.Player(playerContainerRef.current, {
          videoId: assignedStream.id,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1
          },
          events: {
            onReady: (event) => {
              if (!isMounted) return;
              setPlayerReady(true);
              if (slot.muted) {
                event.target.mute();
              } else {
                event.target.unMute();
                event.target.setVolume(slot.volume);
              }
            }
          }
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialise YouTube player', error);
        setPlayerReady(false);
      }
    };

    setupPlayer();

    return () => {
      isMounted = false;
      playerInstanceRef.current?.destroy();
      playerInstanceRef.current = null;
    };
  }, [assignedStream?.id]);

  useEffect(() => {
    const player = playerInstanceRef.current;
    if (!playerReady || !player) return;

    if (slot.muted) {
      if (!player.isMuted()) {
        player.mute();
      }
    } else {
      player.unMute();
      player.setVolume(slot.volume);
    }
  }, [slot.muted, slot.volume, playerReady]);

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
          <div className={styles.playerContainer}>
            <div className={styles.playerFrame} ref={playerContainerRef} />
            {!playerReady && (
              <div className={styles.preview} style={{ '--accent-color': accentColor } as CSSProperties}>
                <div className={styles.previewBackdrop}>
                  <div className={styles.noise} />
                </div>
                <div className={styles.previewContent}>
                  <span className={styles.previewInitials}>{initials}</span>
                  <span className={styles.previewStatus}>LOADING</span>
                </div>
              </div>
            )}
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
                  <span>{viewerLabel}</span>
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
