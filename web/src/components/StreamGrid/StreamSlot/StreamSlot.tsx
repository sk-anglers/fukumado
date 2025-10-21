import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useLayoutStore } from '../../../stores/layoutStore';
import type { StreamSlot, VideoQuality } from '../../../types';
import { loadYouTubeIframeApi } from '../../../hooks/useYouTubeIframeApi';
import { loadTwitchEmbedApi, type TwitchPlayer, type TwitchQuality } from '../../../hooks/useTwitchEmbed';
import { StreamSelectionModal } from '../../StreamSelectionModal/StreamSelectionModal';
import styles from './StreamSlot.module.css';

// VideoQualityからYouTube API画質名へのマッピング
const getYouTubeQuality = (quality: VideoQuality): string => {
  const qualityMap: Record<VideoQuality, string> = {
    '1080p': 'hd1080',
    '720p': 'hd720',
    '480p': 'large',
    '360p': 'medium',
    'auto': 'default'
  };
  return qualityMap[quality] || 'default';
};

// VideoQualityからTwitch画質への最適なマッチングを取得
const getBestTwitchQuality = (quality: VideoQuality, availableQualities: TwitchQuality[]): string | null => {
  if (!availableQualities || availableQualities.length === 0) return null;

  // autoの場合は最高画質（chunked）を選択
  if (quality === 'auto') {
    const chunked = availableQualities.find((q) => q.group === 'chunked');
    return chunked ? chunked.group : null;
  }

  // 優先度順に探す
  const priorityMap: Record<VideoQuality, string[]> = {
    '1080p': ['1080p60', '1080p', 'chunked'],
    '720p': ['720p60', '720p', '1080p60', '1080p'],
    '480p': ['480p', '720p60', '720p'],
    '360p': ['360p', '480p'],
    'auto': ['chunked']
  };

  const priorities = priorityMap[quality] || [];
  for (const prio of priorities) {
    const found = availableQualities.find((q) => q.group === prio);
    if (found) return found.group;
  }

  // 見つからない場合は最初の画質を返す
  return availableQualities[0]?.group || null;
};

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
  const { setVolume, toggleSlotMute, preset, setPreset, clearSlot, fullscreen, masterVolume, swapSlots, setModalOpen } = useLayoutStore((state) => ({
    setVolume: state.setVolume,
    toggleSlotMute: state.toggleSlotMute,
    preset: state.preset,
    setPreset: state.setPreset,
    clearSlot: state.clearSlot,
    fullscreen: state.fullscreen,
    masterVolume: state.masterVolume,
    swapSlots: state.swapSlots,
    setModalOpen: state.setModalOpen
  }));

  const assignedStream = slot.assignedStream;
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<YT.Player | TwitchPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);

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
      console.log('[StreamSlot] setupPlayer開始');
      console.log('[StreamSlot] assignedStream:', assignedStream);

      if (!assignedStream || !playerContainerRef.current) {
        console.log('[StreamSlot] 配信なしまたはコンテナなし');
        if (playerContainerRef.current) {
          playerContainerRef.current.innerHTML = '';
        }
        playerInstanceRef.current?.destroy();
        playerInstanceRef.current = null;
        setPlayerReady(false);
        return;
      }

      console.log('[StreamSlot] プラットフォーム:', assignedStream.platform);
      console.log('[StreamSlot] embedUrl:', assignedStream.embedUrl);
      console.log('[StreamSlot] ID:', assignedStream.id);

      // 既存のプレイヤーをクリア
      playerInstanceRef.current?.destroy();
      playerInstanceRef.current = null;
      playerContainerRef.current.innerHTML = '';

      if (assignedStream.platform === 'twitch') {
        // Twitch: Twitch Embed API使用
        console.log('[Twitch] Twitch Embed API初期化開始');
        console.log('[Twitch] 画質設定:', slot.quality);
        try {
          const TwitchAPI = await loadTwitchEmbedApi();
          if (!isMounted || !playerContainerRef.current) return;

          // embedUrlから "channel=チャンネル名" を抽出
          const channelMatch = assignedStream.embedUrl.match(/channel=([^&]+)/);
          const channelName = channelMatch ? channelMatch[1] : assignedStream.id;

          playerInstanceRef.current = new TwitchAPI.Player(playerContainerRef.current, {
            channel: channelName,
            width: '100%',
            height: '100%',
            parent: [window.location.hostname],
            autoplay: false,
            muted: slot.muted
          });

          // Twitchプレイヤーは即座に初期化されるので、少し待ってからreadyに
          setTimeout(() => {
            if (isMounted && playerInstanceRef.current) {
              console.log('[Twitch] プレイヤー準備完了');
              setPlayerReady(true);
              const twitchPlayer = playerInstanceRef.current as TwitchPlayer;

              // 音量設定
              if (slot.muted) {
                twitchPlayer.setMuted(true);
              } else {
                twitchPlayer.setMuted(false);
                const combinedVolume = (slot.volume * (masterVolume / 100)) / 100; // 0.0-1.0に変換
                twitchPlayer.setVolume(combinedVolume);
              }

              // 画質設定（少し遅延させて確実に適用）
              setTimeout(() => {
                try {
                  const availableQualities = twitchPlayer.getQualities();
                  console.log('[Twitch] 利用可能な画質:', availableQualities);

                  if (slot.quality !== 'auto' && availableQualities && availableQualities.length > 0) {
                    const targetQuality = getBestTwitchQuality(slot.quality, availableQualities);
                    if (targetQuality) {
                      console.log('[Twitch] 画質を設定:', targetQuality);
                      twitchPlayer.setQuality(targetQuality);
                    }
                  }
                } catch (err) {
                  console.error('[Twitch] 画質設定エラー:', err);
                }
              }, 500);
            }
          }, 1000);
        } catch (error) {
          console.error('[Twitch] プレイヤー初期化失敗', error);
          setPlayerReady(false);
        }
      } else if (assignedStream.platform === 'youtube') {
        // YouTube: YouTube Iframe API使用
        console.log('[YouTube] YouTube Iframe API初期化開始');
        console.log('[YouTube] 画質設定:', slot.quality);
        try {
          const YT = await loadYouTubeIframeApi();
          if (!isMounted || !playerContainerRef.current) return;

          const youtubeQuality = getYouTubeQuality(slot.quality);
          console.log('[YouTube] YouTube API画質:', youtubeQuality);

          playerInstanceRef.current = new YT.Player(playerContainerRef.current, {
            videoId: assignedStream.id,
            playerVars: {
              autoplay: 0,
              controls: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              vq: slot.quality !== 'auto' ? youtubeQuality : undefined
            },
            events: {
              onReady: (event) => {
                if (!isMounted) return;
                console.log('[YouTube] プレイヤー準備完了');
                setPlayerReady(true);

                // 画質設定を適用
                if (slot.quality !== 'auto') {
                  console.log('[YouTube] 画質を設定:', youtubeQuality);
                  event.target.setPlaybackQuality(youtubeQuality);
                }

                // 音量設定
                if (slot.muted) {
                  event.target.mute();
                } else {
                  event.target.unMute();
                  const combinedVolume = Math.round(slot.volume * (masterVolume / 100));
                  event.target.setVolume(combinedVolume);
                }
              }
            }
          });
        } catch (error) {
          console.error('[YouTube] プレイヤー初期化失敗', error);
          setPlayerReady(false);
        }
      } else {
        console.warn('[StreamSlot] 未対応のプラットフォーム:', assignedStream.platform);
      }
    };

    setupPlayer();

    return () => {
      isMounted = false;
      if (playerContainerRef.current) {
        playerContainerRef.current.innerHTML = '';
      }
      playerInstanceRef.current?.destroy();
      playerInstanceRef.current = null;
    };
  }, [assignedStream?.id, assignedStream?.platform, slot.quality]);

  useEffect(() => {
    const player = playerInstanceRef.current;
    if (!playerReady || !player || !assignedStream) return;

    // YouTubeプレイヤーの場合
    if (assignedStream.platform === 'youtube' && 'isMuted' in player) {
      const ytPlayer = player as YT.Player;
      if (slot.muted) {
        if (!ytPlayer.isMuted()) {
          ytPlayer.mute();
        }
      } else {
        ytPlayer.unMute();
        const combinedVolume = Math.round(slot.volume * (masterVolume / 100));
        ytPlayer.setVolume(combinedVolume);
      }
    }
    // Twitchプレイヤーの場合
    else if (assignedStream.platform === 'twitch' && 'setMuted' in player) {
      const twitchPlayer = player as TwitchPlayer;
      if (slot.muted) {
        twitchPlayer.setMuted(true);
      } else {
        twitchPlayer.setMuted(false);
        const combinedVolume = (slot.volume * (masterVolume / 100)) / 100; // 0.0-1.0に変換
        twitchPlayer.setVolume(combinedVolume);
      }
    }
  }, [slot.muted, slot.volume, playerReady, masterVolume, assignedStream?.platform]);

  // Twitch画質変更時の処理（プレイヤーを再生成せずに画質のみ変更）
  useEffect(() => {
    const player = playerInstanceRef.current;
    if (!playerReady || !player || !assignedStream || assignedStream.platform !== 'twitch') return;

    // Twitchプレイヤーの画質を動的に変更
    const twitchPlayer = player as TwitchPlayer;
    try {
      const availableQualities = twitchPlayer.getQualities();
      if (!availableQualities || availableQualities.length === 0) return;

      if (slot.quality === 'auto') {
        // autoの場合は最高画質を選択
        const chunked = availableQualities.find((q) => q.group === 'chunked');
        if (chunked) {
          console.log('[Twitch] 画質を自動（chunked）に変更');
          twitchPlayer.setQuality(chunked.group);
        }
      } else {
        const targetQuality = getBestTwitchQuality(slot.quality, availableQualities);
        if (targetQuality) {
          console.log('[Twitch] 画質を変更:', slot.quality, '->', targetQuality);
          twitchPlayer.setQuality(targetQuality);
        }
      }
    } catch (err) {
      console.error('[Twitch] 画質変更エラー:', err);
    }
  }, [slot.quality, playerReady, assignedStream?.platform, assignedStream?.id]);

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      const target = containerRef.current;
      setIsFullscreen(document.fullscreenElement === target);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = async (event: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    event.stopPropagation();
    const target = containerRef.current;
    if (!target) return;

    try {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Fullscreen toggle failed', error);
    }
  };

  const handleFocusPreset = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onSelect();
    // フォーカスモードならデフォルト（2×2）に戻す、それ以外ならフォーカスに切り替え
    setPreset(preset === 'focus' ? 'twoByTwo' : 'focus');
  };

  const handleDragStart = (event: React.DragEvent<HTMLElement>): void => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', slot.id);
    setIsDragging(true);
  };

  const handleDragEnd = (): void => {
    setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (): void => {
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setIsDragOver(false);

    const sourceSlotId = event.dataTransfer.getData('text/plain');
    if (sourceSlotId && sourceSlotId !== slot.id) {
      swapSlots(sourceSlotId, slot.id);
    }
  };

  return (
    <article
      className={clsx(
        styles.slot,
        isActive && styles.active,
        !assignedStream && styles.empty,
        fullscreen && styles.fullscreenMode,
        isDragging && styles.dragging,
        isDragOver && styles.dragOver
      )}
      style={{ borderColor: isActive ? accentColor : 'transparent', cursor: 'pointer' }}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        onSelect();
      }}
    >
      <div className={styles.surface}>
        {assignedStream ? (
          <div className={styles.playerContainer} ref={containerRef}>
            <div className={styles.playerFrame} ref={playerContainerRef} />
            <div
              className={styles.selectableOverlay}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
            />
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
          <div
            className={styles.placeholder}
            onClick={(e) => {
              e.stopPropagation();
              setShowSelectionModal(true);
              setModalOpen(true);
            }}
          >
            <span className={styles.placeholderIcon}>＋</span>
            <p>サイドバーから配信を割り当てましょう</p>
          </div>
        )}

        <div className={styles.overlayTop}>
          {assignedStream ? (
            <>
              <div className={styles.platformBadge} style={{ color: accentColor }}>
                {platformLabel[assignedStream.platform]}
              </div>
              <div className={styles.topButtons}>
                <button
                  className={styles.focusButton}
                  type="button"
                  onClick={handleFocusPreset}
                >
                  {preset === 'focus' ? '通常表示' : 'フォーカス'}
                </button>
                <button
                  className={styles.fullscreenButton}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearSlot(slot.id);
                  }}
                >
                  <XMarkIcon />
                  <span>削除</span>
                </button>
                <button
                  className={styles.fullscreenButton}
                  type="button"
                  onClick={handleToggleFullscreen}
                >
                  {isFullscreen ? <ArrowsPointingInIcon /> : <ArrowsPointingOutIcon />}
                  <span>{isFullscreen ? '全画面解除' : '全画面'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className={styles.platformBadgeMuted}>空き枠</div>
          )}
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
      {showSelectionModal && (
        <StreamSelectionModal
          slotId={slot.id}
          onClose={() => {
            setShowSelectionModal(false);
            setModalOpen(false);
          }}
        />
      )}
    </article>
  );
};
