import { XMarkIcon } from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';
import { useLayoutStore } from '../../stores/layoutStore';
import type { Platform, Streamer } from '../../types';
import { trackStreamSelected } from '../../services/analyticsService';
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

  const handleSelectStream = (stream: Streamer): void => {
    // 配信選択を追跡（ファネル分析用）
    console.log('[Analytics] Tracking stream selection:', stream.title);
    trackStreamSelected({
      platform: stream.platform,
      streamId: stream.id,
      streamTitle: stream.title,
      channelName: stream.displayName,
      channelId: stream.channelId || stream.id,
      slotId,
      viewerCount: stream.viewerCount
    });

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
          <button
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            <XMarkIcon />
          </button>
        </div>

        <div className={styles.streamList}>
          {availableStreams.length === 0 ? (
            <div className={styles.emptyState}>
              <p>現在配信中のチャンネルはありません</p>
            </div>
          ) : (
            availableStreams.map((stream) => (
              <button
                key={`${stream.platform}-${stream.id}`}
                className={styles.streamCard}
                onClick={() => handleSelectStream(stream)}
                type="button"
              >
                <div className={styles.streamThumbnail}>
                  {stream.thumbnailUrl ? (
                    <img
                      src={stream.thumbnailUrl.replace('{width}', '640').replace('{height}', '360')}
                      alt={stream.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.thumbnailPlaceholder}>
                      {stream.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div
                    className={styles.platformBadge}
                    style={{ backgroundColor: platformColor[stream.platform] }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = stream.platform === 'twitch'
                        ? `https://www.twitch.tv/${stream.channelLogin || stream.id}`
                        : stream.platform === 'youtube'
                        ? `https://www.youtube.com/watch?v=${stream.id}`
                        : stream.embedUrl;
                      if (url) window.open(url, '_blank');
                    }}
                    title={`${platformLabel[stream.platform]}で開く`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        const url = stream.platform === 'twitch'
                          ? `https://www.twitch.tv/${stream.channelLogin || stream.id}`
                          : stream.platform === 'youtube'
                          ? `https://www.youtube.com/watch?v=${stream.id}`
                          : stream.embedUrl;
                        if (url) window.open(url, '_blank');
                      }
                    }}
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
