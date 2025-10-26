import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { type CSSProperties, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { useLayoutStore } from '../../../stores/layoutStore';
import type { StreamSlot, VideoQuality } from '../../../types';
import { loadYouTubeIframeApi } from '../../../hooks/useYouTubeIframeApi';
import { loadTwitchEmbedApi, type TwitchPlayer, type TwitchQuality } from '../../../hooks/useTwitchEmbed';
import { StreamSelectionModal } from '../../StreamSelectionModal/StreamSelectionModal';
import { useIsMobile } from '../../../hooks/useMediaQuery';
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
  selectedSlotId: string | null;
  preset: string;
  showSelection: boolean;
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

export const StreamSlotCard = memo(({ slot, selectedSlotId, preset, showSelection }: StreamSlotCardProps): JSX.Element => {
  const { setVolume, toggleSlotMute, setPreset, clearSlot, fullscreen, masterVolume, swapSlots, setModalOpen, masterSlotId, selectSlot } = useStoreWithEqualityFn(useLayoutStore, (state) => ({
    setVolume: state.setVolume,
    toggleSlotMute: state.toggleSlotMute,
    setPreset: state.setPreset,
    clearSlot: state.clearSlot,
    fullscreen: state.fullscreen,
    masterVolume: state.masterVolume,
    swapSlots: state.swapSlots,
    setModalOpen: state.setModalOpen,
    masterSlotId: state.masterSlotId,
    selectSlot: state.selectSlot
  }), shallow);

  const isMobile = useIsMobile();
  const assignedStream = slot.assignedStream;
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<YT.Player | TwitchPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const mobileControlsTimerRef = useRef<number | null>(null);

  // propsから計算
  const isActive = showSelection && selectedSlotId === slot.id;
  const isFocused = preset === 'focus' && selectedSlotId === slot.id;
  const isMaster = masterSlotId === slot.id;

  // デスクトップでのみオーバーレイ表示を制御
  const shouldShowOverlay = showSelection;

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
    let initTimeout: number | undefined;
    let isDestroyed = false;

    const setupPlayer = async (): Promise<void> => {
      if (!assignedStream || !playerContainerRef.current) {
        // 配信が削除された場合は、クリーンアップのみ実行（setState は呼ばない）
        playerInstanceRef.current = null;
        return;
      }

      // 既存のプレイヤーはクリーンアップ関数で処理済み

      if (assignedStream.platform === 'twitch') {
        // Twitch: Twitch Embed API使用
        try {
          // リクエストを分散させるためにスロットIDベースで少し遅延
          const slotNumber = parseInt(slot.id.replace('slot-', '')) || 1;
          const delay = (slotNumber - 1) * 150; // 各スロット150ms間隔

          await new Promise(resolve => {
            initTimeout = window.setTimeout(resolve, delay);
          });

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
            layout: 'video',
            autoplay: false,
            muted: slot.muted
          });

          const twitchPlayer = playerInstanceRef.current as TwitchPlayer;

          // エラーイベントをリッスン
          twitchPlayer.addEventListener(TwitchAPI.Player.READY, () => {
            if (!isMounted) return;
            setPlayerReady(true);

            // 初期音量設定
            if (!slot.muted) {
              const combinedVolume = (slot.volume * (masterVolume / 100)) / 100;
              twitchPlayer.setVolume(combinedVolume);
            }

            // 画質設定（少し遅延させて確実に適用）
            setTimeout(() => {
              try {
                const availableQualities = twitchPlayer.getQualities();

                if (slot.quality !== 'auto' && availableQualities && availableQualities.length > 0) {
                  const targetQuality = getBestTwitchQuality(slot.quality, availableQualities);
                  if (targetQuality) {
                    twitchPlayer.setQuality(targetQuality);
                  }
                }
              } catch (err) {
                console.error('[Twitch] 画質設定エラー:', err);
              }
            }, 500);
          });

          twitchPlayer.addEventListener(TwitchAPI.Player.OFFLINE, () => {
            console.error('[Twitch] チャンネルがオフラインです:', channelName);
          });

          twitchPlayer.addEventListener(TwitchAPI.Player.ERROR, (errorEvent: any) => {
            console.error('[Twitch] プレイヤーエラー:', errorEvent);
          });

          // グローバルに登録（同期機能のため）
          (window as any)[`twitchPlayer_${slot.id}`] = playerInstanceRef.current;
        } catch (error) {
          console.error('[Twitch] プレイヤー初期化失敗:', error);
          setPlayerReady(false);
        }
      } else if (assignedStream.platform === 'youtube') {
        // YouTube: YouTube Iframe API使用
        try {
          const YT = await loadYouTubeIframeApi();
          if (!isMounted || !playerContainerRef.current) return;

          const youtubeQuality = getYouTubeQuality(slot.quality);

          playerInstanceRef.current = new YT.Player(playerContainerRef.current, {
            videoId: assignedStream.id,
            playerVars: {
              autoplay: 0,
              controls: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              mute: slot.muted ? 1 : 0,
              vq: slot.quality !== 'auto' ? youtubeQuality : undefined
            },
            events: {
              onReady: (event) => {
                if (!isMounted) return;
                setPlayerReady(true);

                // 初期音量設定
                if (!slot.muted) {
                  event.target.unMute();
                  const combinedVolume = Math.round(slot.volume * (masterVolume / 100));
                  event.target.setVolume(combinedVolume);
                }

                // 画質設定を適用
                if (slot.quality !== 'auto') {
                  event.target.setPlaybackQuality(youtubeQuality);
                }
              },
              onError: (event) => {
                console.error('[YouTube] プレイヤーエラー:', {
                  code: event.data,
                  message: event.data === 2 ? '無効なパラメータ'
                    : event.data === 5 ? 'HTML5プレイヤーエラー'
                    : event.data === 100 ? '動画が見つからない'
                    : event.data === 101 || event.data === 150 ? '埋め込み再生が許可されていない'
                    : '不明なエラー'
                });
                setPlayerReady(false);
              }
            }
          });
        } catch (error) {
          console.error('[YouTube] プレイヤー初期化失敗:', error);
          setPlayerReady(false);
        }
      } else {
        console.warn('[StreamSlot] 未対応のプラットフォーム:', assignedStream.platform);
      }
    };

    setupPlayer();

    return () => {
      isMounted = false;
      isDestroyed = true;

      console.log(`[StreamSlot ${slot.id}] クリーンアップ開始`, { platform: assignedStream?.platform });

      // タイムアウトをクリア
      if (initTimeout !== undefined) {
        window.clearTimeout(initTimeout);
      }

      // 1. DOMコンテナを先にクリア（これによりプレイヤーのDOM操作を停止）
      if (playerContainerRef.current) {
        console.log(`[StreamSlot ${slot.id}] DOMコンテナをクリア`);
        playerContainerRef.current.innerHTML = '';
      }

      // 2. プレイヤーインスタンスを破棄
      const player = playerInstanceRef.current;
      if (player && assignedStream) {
        try {
          if (assignedStream.platform === 'twitch' && 'pause' in player) {
            // Twitchプレイヤー: setMuted(true) → pause() → destroy()
            const twitchPlayer = player as TwitchPlayer;
            console.log(`[StreamSlot ${slot.id}] Twitchプレイヤーを破棄開始`);

            try {
              // 音声を完全に停止
              twitchPlayer.setMuted(true);
              twitchPlayer.setVolume(0);
            } catch (e) {
              console.warn(`[StreamSlot ${slot.id}] ミュート失敗:`, e);
            }

            try {
              twitchPlayer.pause();
              console.log(`[StreamSlot ${slot.id}] pause完了`);
            } catch (e) {
              console.warn(`[StreamSlot ${slot.id}] pause失敗:`, e);
            }

            // destroy()を即座に実行（setTimeout削除）
            try {
              if (typeof (twitchPlayer as any).destroy === 'function') {
                (twitchPlayer as any).destroy();
                console.log(`[StreamSlot ${slot.id}] destroy完了`);
              } else {
                console.warn(`[StreamSlot ${slot.id}] destroy関数が存在しません`);
              }
            } catch (e) {
              console.error(`[StreamSlot ${slot.id}] destroy失敗:`, e);
            }
          } else if (assignedStream.platform === 'youtube' && 'destroy' in player) {
            // YouTubeプレイヤー
            const ytPlayer = player as YT.Player;
            console.log(`[StreamSlot ${slot.id}] YouTubeプレイヤーを破棄開始`);
            try {
              ytPlayer.destroy();
              console.log(`[StreamSlot ${slot.id}] YouTube destroy完了`);
            } catch (e) {
              console.error(`[StreamSlot ${slot.id}] YouTube destroy失敗:`, e);
            }
          }
        } catch (e) {
          console.error(`[StreamSlot ${slot.id}] プレイヤー破棄エラー:`, e);
        }
      }

      // 3. グローバル参照を削除
      delete (window as any)[`twitchPlayer_${slot.id}`];
      console.log(`[StreamSlot ${slot.id}] グローバル参照を削除`);

      // 4. ref をクリア
      playerInstanceRef.current = null;

      console.log(`[StreamSlot ${slot.id}] クリーンアップ完了`);
    };
  }, [assignedStream?.id, assignedStream?.platform, slot.id]);

  // プレイヤーの音声設定（ミュート・音量）
  useEffect(() => {
    const player = playerInstanceRef.current;
    if (!playerReady || !player || !assignedStream) return;

    try {
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
    } catch (e) {
      // プレイヤーが無効な状態でも処理を継続
      console.warn('[StreamSlot] 音量設定エラー:', e);
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
          twitchPlayer.setQuality(chunked.group);
        }
      } else {
        const targetQuality = getBestTwitchQuality(slot.quality, availableQualities);
        if (targetQuality) {
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

  // モバイルコントロールの自動非表示タイマー
  useEffect(() => {
    if (showMobileControls) {
      // 既存のタイマーをクリア
      if (mobileControlsTimerRef.current !== null) {
        window.clearTimeout(mobileControlsTimerRef.current);
      }
      // 3秒後に自動非表示
      mobileControlsTimerRef.current = window.setTimeout(() => {
        setShowMobileControls(false);
      }, 3000);
    }
    return () => {
      if (mobileControlsTimerRef.current !== null) {
        window.clearTimeout(mobileControlsTimerRef.current);
      }
    };
  }, [showMobileControls]);

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
    selectSlot(slot.id);
    // フォーカスモードならデフォルト（2×2）に戻す、それ以外ならフォーカスに切り替え
    setPreset(preset === 'focus' ? 'twoByTwo' : 'focus');
  };

  return (
    <article
      className={clsx(
        styles.slot,
        !assignedStream && styles.empty,
        fullscreen && styles.fullscreenMode,
        isFocused && styles.focused
      )}
      style={{
        cursor: 'pointer',
        order: isFocused ? -1 : 0
      }}
      onClick={(e) => {
        // iframeのクリックは無視（プレイヤーコントロールを優先）
        if (e.target !== e.currentTarget) {
          return;
        }
        selectSlot(slot.id);
        // 空の枠の場合は配信選択モーダルを開く
        if (!assignedStream) {
          setShowSelectionModal(true);
          setModalOpen(true);
        }
      }}
    >
      <div className={styles.surface}>
        {assignedStream ? (
          <div
            className={styles.playerContainer}
            ref={containerRef}
            onClick={(e) => {
              // モバイルでプレイヤーコンテナの余白部分をタップした時のみコントロールを表示
              if (isMobile && e.target === e.currentTarget) {
                e.stopPropagation();
                setShowMobileControls(true);
              }
            }}
          >
            <div className={styles.playerFrame} ref={playerContainerRef} />
            <div
              className={styles.selectableOverlay}
              onClick={(e) => {
                if (isMobile) {
                  e.stopPropagation();
                  setShowMobileControls(true);
                }
              }}
              style={{
                pointerEvents: isMobile && !showMobileControls ? 'auto' : 'none'
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
            {/* モバイル用の小さな×ボタン */}
            {isMobile && (
              <button
                className={styles.mobileCloseButton}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  clearSlot(slot.id);
                }}
                aria-label="配信を削除"
                style={{
                  opacity: showMobileControls ? 1 : 0,
                  pointerEvents: showMobileControls ? 'auto' : 'none'
                }}
              >
                <XMarkIcon />
              </button>
            )}
          </div>
        ) : (
          <div
            className={styles.placeholder}
            onClick={(e) => {
              e.stopPropagation();
              selectSlot(slot.id);
              setShowSelectionModal(true);
              setModalOpen(true);
            }}
          >
            <span className={styles.placeholderIcon}>＋</span>
            <p>サイドバーから配信を割り当てましょう</p>
          </div>
        )}

        {/* デスクトップ用オーバーレイ */}
        {!isMobile && (
          <>
            <div className={styles.overlayTop} style={{ opacity: !shouldShowOverlay ? 0 : 1 }}>
              {assignedStream ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className={styles.platformBadge} style={{ color: accentColor }}>
                      {platformLabel[assignedStream.platform]}
                    </div>
                    {isMaster && assignedStream.platform === 'twitch' && (
                      <div className={styles.masterBadge}>🎯 マスター</div>
                    )}
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

            <div className={styles.overlayBottom} style={{ opacity: !shouldShowOverlay ? 0 : 1 }}>
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
          </>
        )}
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
});

StreamSlotCard.displayName = 'StreamSlotCard';
