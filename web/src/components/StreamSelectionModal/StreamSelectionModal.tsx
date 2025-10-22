import { XMarkIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLayoutStore } from '../../stores/layoutStore';
import type { Platform, Streamer } from '../../types';
import { config } from '../../config';
import styles from './StreamSelectionModal.module.css';

interface StreamSelectionModalProps {
  slotId: string;
  onClose: () => void;
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

export const StreamSelectionModal = ({ slotId, onClose }: StreamSelectionModalProps): JSX.Element => {
  const { availableStreams, assignStream } = useLayoutStore((state) => ({
    availableStreams: state.availableStreams,
    assignStream: state.assignStream
  }));

  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all');

  const filteredStreams = useMemo(() => {
    if (selectedPlatform === 'all') {
      return availableStreams;
    }
    return availableStreams.filter((stream) => stream.platform === selectedPlatform);
  }, [availableStreams, selectedPlatform]);

  const handleSelectStream = (stream: Streamer): void => {
    assignStream(slotId, stream);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModalClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  return createPortal(
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContent} onClick={handleModalClick}>
        <div className={styles.modalHeader}>
          <h2>配信を選択</h2>
          <button className={styles.closeButton} onClick={onClose} type="button">
            <XMarkIcon />
          </button>
        </div>

        <div className={styles.platformFilter}>
          <button
            className={selectedPlatform === 'all' ? styles.platformButtonActive : styles.platformButton}
            onClick={() => setSelectedPlatform('all')}
            type="button"
          >
            すべて
          </button>
          {config.enableYoutube && (
            <button
              className={selectedPlatform === 'youtube' ? styles.platformButtonActive : styles.platformButton}
              onClick={() => setSelectedPlatform('youtube')}
              type="button"
              style={{ '--platform-color': platformColor.youtube } as React.CSSProperties}
            >
              YouTube
            </button>
          )}
          <button
            className={selectedPlatform === 'twitch' ? styles.platformButtonActive : styles.platformButton}
            onClick={() => setSelectedPlatform('twitch')}
            type="button"
            style={{ '--platform-color': platformColor.twitch } as React.CSSProperties}
          >
            Twitch
          </button>
          {config.enableNiconico && (
            <button
              className={selectedPlatform === 'niconico' ? styles.platformButtonActive : styles.platformButton}
              onClick={() => setSelectedPlatform('niconico')}
              type="button"
              style={{ '--platform-color': platformColor.niconico } as React.CSSProperties}
            >
              ニコニコ
            </button>
          )}
        </div>

        <div className={styles.streamList}>
          {filteredStreams.length === 0 ? (
            <div className={styles.emptyState}>
              <p>現在配信中のチャンネルはありません</p>
            </div>
          ) : (
            filteredStreams.map((stream) => (
              <button
                key={`${stream.platform}-${stream.id}`}
                className={styles.streamCard}
                onClick={() => handleSelectStream(stream)}
                type="button"
              >
                <div className={styles.streamThumbnail}>
                  {stream.thumbnailUrl ? (
                    <img src={stream.thumbnailUrl} alt={stream.title} />
                  ) : (
                    <div className={styles.thumbnailPlaceholder}>
                      {stream.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div
                    className={styles.platformBadge}
                    style={{ backgroundColor: platformColor[stream.platform] }}
                  >
                    {platformLabel[stream.platform]}
                  </div>
                </div>
                <div className={styles.streamInfo}>
                  <h3 className={styles.streamTitle}>{stream.title}</h3>
                  <div className={styles.streamMeta}>
                    <span className={styles.channelName}>{stream.displayName}</span>
                    {stream.viewerCount != null && (
                      <span className={styles.viewerCount}>
                        {stream.viewerCount.toLocaleString()} 人視聴中
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
