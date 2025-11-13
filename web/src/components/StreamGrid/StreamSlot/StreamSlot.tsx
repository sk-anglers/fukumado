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
import { useAnalytics } from '../../../hooks/useAnalytics';
import { trackStreamAction, trackButtonClick } from '../../../utils/gtm';
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
  isActive: boolean;
  isFocused?: boolean;
  showSelection: boolean;
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

const StreamSlotCardComponent = ({ slot, isActive, isFocused = false, showSelection, onSelect }: StreamSlotCardProps): JSX.Element => {
  const { trackStream } = useAnalytics();

  const { setVolume, toggleSlotMute, preset, setPreset, clearSlot, fullscreen, masterVolume, swapSlots, setModalOpen, userInteracted, masterSlotId, setSlotReady, setSlotPlaying } = useStoreWithEqualityFn(useLayoutStore, (state) => ({
    setVolume: state.setVolume,
    toggleSlotMute: state.toggleSlotMute,
    preset: state.preset,
    setPreset: state.setPreset,
    clearSlot: state.clearSlot,
    fullscreen: state.fullscreen,
    masterVolume: state.masterVolume,
    swapSlots: state.swapSlots,
    setModalOpen: state.setModalOpen,
    userInteracted: state.userInteracted,
    masterSlotId: state.masterSlotId,
    setSlotReady: state.setSlotReady,
    setSlotPlaying: state.setSlotPlaying
  }), shallow);

  const isMobile = useIsMobile();
  const assignedStream = slot.assignedStream;
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<YT.Player | TwitchPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const mobileControlsTimerRef = useRef<number | null>(null);

  // Twitchイベントリスナーとタイマーの参照を保持
  const twitchEventHandlersRef = useRef<{
    readyHandler: (() => void) | null;
    offlineHandler: (() => void) | null;
    errorHandler: ((event: any) => void) | null;
    playHandler: (() => void) | null;
    pauseHandler: (() => void) | null;
    qualityTimeoutId: number | undefined;
  }>({
    readyHandler: null,
    offlineHandler: null,
    errorHandler: null,
    playHandler: null,
    pauseHandler: null,
    qualityTimeoutId: undefined
  });

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
    setSlotReady(slot.id, false); // スロット準備状態をリセット
    setSlotPlaying(slot.id, false); // スロット再生状態をリセット
    let isMounted = true;
    let initTimeout: number | undefined;

    const setupPlayer = async (): Promise<void> => {
      if (!assignedStream || !playerContainerRef.current) {
        // プレイヤーがない場合は完全非表示にする（DOM削除しない）
        if (playerContainerRef.current) {
          playerContainerRef.current.style.display = 'none';
          playerContainerRef.current.style.visibility = 'hidden';
          playerContainerRef.current.style.opacity = '0';
          playerContainerRef.current.style.pointerEvents = 'none';
          playerContainerRef.current.style.position = 'absolute';
          playerContainerRef.current.style.zIndex = '-9999';
        }
        setPlayerReady(false);
        setSlotReady(slot.id, false); // スロット準備状態をリセット
        setSlotPlaying(slot.id, false); // スロット再生状態をリセット
        return;
      }

      // プレイヤーがある場合は表示（スタイルをリセット）
      if (playerContainerRef.current) {
        playerContainerRef.current.style.display = 'block';
        playerContainerRef.current.style.visibility = 'visible';
        playerContainerRef.current.style.opacity = '1';
        playerContainerRef.current.style.pointerEvents = 'auto';
        playerContainerRef.current.style.position = 'relative';
        playerContainerRef.current.style.zIndex = '0';
      }

      // 既存のプレイヤーをクリア
      if (playerInstanceRef.current) {
        try {
          const existingPlayer = playerInstanceRef.current;
          // YouTubeプレイヤーの場合のみdestroy()を呼ぶ
          if (typeof (existingPlayer as any).destroy === 'function' && assignedStream?.platform === 'youtube') {
            (existingPlayer as any).destroy();
          }
        } catch (e) {
          // エラーは無視
        }
      }

      // Twitchプレイヤーの場合は参照を保持、それ以外はクリア
      const wasTwitchPlayer = playerInstanceRef.current && 'setMuted' in playerInstanceRef.current;
      if (!wasTwitchPlayer) {
        playerInstanceRef.current = null;
      }

      // TwitchからTwitchへの切り替えの場合、DOM削除をスキップ
      const shouldClearDOM = !(wasTwitchPlayer && assignedStream.platform === 'twitch');

      if (shouldClearDOM && playerContainerRef.current) {
        playerContainerRef.current.innerHTML = '';
      }

      if (assignedStream.platform === 'twitch') {
        // Twitch: Twitch Embed API使用
        try {
          const TwitchAPI = await loadTwitchEmbedApi();
          if (!isMounted || !playerContainerRef.current) return;

          // embedUrlから "channel=チャンネル名" を抽出
          const channelMatch = assignedStream.embedUrl?.match(/channel=([^&]+)/);
          const channelName = channelMatch ? channelMatch[1] : assignedStream.id;

          // 既存のTwitchプレイヤーがある場合、setChannel()でチャンネル切り替え
          if (wasTwitchPlayer && playerInstanceRef.current) {
            const twitchPlayer = playerInstanceRef.current as TwitchPlayer;
            twitchPlayer.setChannel(channelName);

            // コンテナを再表示
            if (playerContainerRef.current) {
              playerContainerRef.current.style.display = 'block';
              playerContainerRef.current.style.visibility = 'visible';
              playerContainerRef.current.style.opacity = '1';
              playerContainerRef.current.style.pointerEvents = 'auto';
              playerContainerRef.current.style.position = 'relative';
              playerContainerRef.current.style.zIndex = '0';

              // iframeのpointerEventsもリセット
              const iframe = playerContainerRef.current.querySelector('iframe');
              if (iframe) {
                iframe.style.pointerEvents = 'auto';
              }
            }

            // playerReadyをtrueに（既にREADY状態）
            setPlayerReady(true);

            // 音量と画質を再適用
            if (!slot.muted) {
              const combinedVolume = (slot.volume * (masterVolume / 100)) / 100;
              twitchPlayer.setVolume(combinedVolume);
            }

            // 画質設定
            const timeoutId = window.setTimeout(() => {
              if (!isMounted) return;
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

            twitchEventHandlersRef.current.qualityTimeoutId = timeoutId;

            return; // 新規プレイヤー作成をスキップ
          }

          playerInstanceRef.current = new TwitchAPI.Player(playerContainerRef.current, {
            channel: channelName,
            width: '100%',
            height: '100%',
            parent: [window.location.hostname],
            autoplay: true,
            muted: true
          });

          const twitchPlayer = playerInstanceRef.current as TwitchPlayer;

          // イベントハンドラーを作成
          const readyHandler = () => {
            if (!isMounted) return;
            setPlayerReady(true);
            setSlotReady(slot.id, true); // プレイヤー準備完了を通知

            // 初期音量設定
            if (!slot.muted) {
              const combinedVolume = (slot.volume * (masterVolume / 100)) / 100;
              twitchPlayer.setVolume(combinedVolume);
            }

            // 画質設定（少し遅延させて確実に適用）
            const timeoutId = window.setTimeout(() => {
              if (!isMounted) return;
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

            twitchEventHandlersRef.current.qualityTimeoutId = timeoutId;
          };

          const offlineHandler = () => {
            console.error('[Twitch] チャンネルがオフラインです:', channelName);
          };

          const errorHandler = (errorEvent: any) => {
            console.error('[Twitch] プレイヤーエラー:', errorEvent);
          };

          const playHandler = () => {
            if (!isMounted) return;
            setSlotPlaying(slot.id, true); // 再生開始を通知

            // 再生開始時、スロットがミュートされていなければミュート解除
            if (playerInstanceRef.current && !slot.muted) {
              try {
                (playerInstanceRef.current as TwitchPlayer).setMuted(false);
              } catch (e) {
                console.error('[Twitch] Failed to unmute on play:', e);
              }
            }
          };

          const pauseHandler = () => {
            if (!isMounted) return;
            setSlotPlaying(slot.id, false); // 再生停止を通知

            // 一時停止時にプレイヤーをミュート
            if (playerInstanceRef.current) {
              try {
                (playerInstanceRef.current as TwitchPlayer).setMuted(true);
              } catch (e) {
                console.error('[Twitch] Failed to mute on pause:', e);
              }
            }
          };

          // イベントリスナーを登録
          twitchPlayer.addEventListener(TwitchAPI.Player.READY, readyHandler);
          twitchPlayer.addEventListener(TwitchAPI.Player.OFFLINE, offlineHandler);
          twitchPlayer.addEventListener(TwitchAPI.Player.ERROR, errorHandler);
          twitchPlayer.addEventListener(TwitchAPI.Player.PLAY, playHandler);
          twitchPlayer.addEventListener(TwitchAPI.Player.PAUSE, pauseHandler);

          // ハンドラーを保存（クリーンアップ時に使用）
          twitchEventHandlersRef.current.readyHandler = readyHandler;
          twitchEventHandlersRef.current.offlineHandler = offlineHandler;
          twitchEventHandlersRef.current.errorHandler = errorHandler;
          twitchEventHandlersRef.current.playHandler = playHandler;
          twitchEventHandlersRef.current.pauseHandler = pauseHandler;

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
              autoplay: 1,
              controls: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              mute: 1,
              ...(slot.quality !== 'auto' ? { vq: youtubeQuality } : {})
            } as any,
            events: {
              onReady: (event: any) => {
                if (!isMounted) return;
                setPlayerReady(true);
                setSlotReady(slot.id, true); // プレイヤー準備完了を通知

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
              onStateChange: (event: any) => {
                if (!isMounted) return;
                // YT.PlayerState.PLAYING = 1, YT.PlayerState.PAUSED = 2
                if (event.data === 1) {
                  setSlotPlaying(slot.id, true); // 再生開始

                  // 再生開始時、スロットがミュートされていなければミュート解除
                  if (playerInstanceRef.current && !slot.muted) {
                    try {
                      (playerInstanceRef.current as any).unMute();
                    } catch (e) {
                      console.error('[YouTube] Failed to unmute on play:', e);
                    }
                  }
                } else if (event.data === 2) {
                  setSlotPlaying(slot.id, false); // 一時停止

                  // 一時停止時にプレイヤーをミュート
                  if (playerInstanceRef.current) {
                    try {
                      (playerInstanceRef.current as any).mute();
                    } catch (e) {
                      console.error('[YouTube] Failed to mute on pause:', e);
                    }
                  }
                }
              },
              onError: (event: any) => {
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
            } as any
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

      // タイムアウトをクリア
      if (initTimeout !== undefined) {
        window.clearTimeout(initTimeout);
      }

      // プレイヤーをクリーンアップ
      if (playerInstanceRef.current) {
        try {
          const player = playerInstanceRef.current;

          // Twitchプレイヤーの場合: 音声停止と非表示のみ
          if (assignedStream?.platform === 'twitch' && 'setMuted' in player) {
            try {
              // タイムアウトをクリア
              const timeoutId = twitchEventHandlersRef.current.qualityTimeoutId;
              if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
                twitchEventHandlersRef.current.qualityTimeoutId = undefined;
              }

              // 音声を停止
              const twitchPlayer = player as TwitchPlayer;
              try {
                twitchPlayer.pause();
                twitchPlayer.setMuted(true);
              } catch (e) {
                // エラーは無視
              }

              // コンテナを完全非表示
              const iframe = playerContainerRef.current?.querySelector('iframe');
              if (iframe) {
                iframe.style.pointerEvents = 'none';
              }

              if (playerContainerRef.current) {
                playerContainerRef.current.style.display = 'none';
                playerContainerRef.current.style.visibility = 'hidden';
                playerContainerRef.current.style.opacity = '0';
                playerContainerRef.current.style.pointerEvents = 'none';
                playerContainerRef.current.style.position = 'absolute';
                playerContainerRef.current.style.zIndex = '-9999';
              }
            } catch (hideError) {
              console.warn('[Twitch] クリーンアップエラー:', hideError);
            }
          }

          // YouTubeプレイヤーの場合: destroy()を呼ぶ
          if (assignedStream?.platform === 'youtube' && typeof (player as any).destroy === 'function') {
            (player as any).destroy();
            if (playerContainerRef.current) {
              playerContainerRef.current.innerHTML = '';
            }
          }
        } catch (e) {
          console.error('[Cleanup] エラー:', e);
        }
      }

      // Twitchプレイヤーの場合は参照を保持、それ以外はクリア
      // ⚠️ assignedStreamではなく、playerInstanceRef自体の種類で判定する
      const isTwitchPlayer = playerInstanceRef.current && 'setMuted' in playerInstanceRef.current;

      if (!isTwitchPlayer) {
        playerInstanceRef.current = null;
      }
    };
  }, [assignedStream?.id, assignedStream?.platform, slot.quality]);

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
          const combinedVolume = Math.round(slot.volume * (masterVolume / 100));
          ytPlayer.unMute();
          ytPlayer.setVolume(combinedVolume);
        }
      }
      // Twitchプレイヤーの場合
      else if (assignedStream.platform === 'twitch' && 'setMuted' in player) {
        const twitchPlayer = player as TwitchPlayer;
        if (slot.muted) {
          twitchPlayer.setMuted(true);
        } else {
          const combinedVolume = (slot.volume * (masterVolume / 100)) / 100; // 0.0-1.0に変換
          twitchPlayer.setMuted(false);
          twitchPlayer.setVolume(combinedVolume);
        }
      }
    } catch (e) {
      // プレイヤーが無効な状態でも処理を継続
      console.warn('[StreamSlot] 音量設定エラー:', e);
    }
  }, [slot.id, slot.muted, slot.volume, playerReady, masterVolume, assignedStream?.platform]);

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
        isDragOver && styles.dragOver,
        isFocused && styles.focused
      )}
      style={{
        borderColor: 'transparent',
        cursor: 'pointer',
        order: isFocused ? -1 : 0
      }}
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
        {/* ⚠️ playerContainer を常にレンダリング（DOM削除防止） */}
        <div
          className={styles.playerContainer}
          ref={containerRef}
          style={{
            display: assignedStream ? 'block' : 'none',
            position: assignedStream ? 'relative' : 'absolute',
            visibility: assignedStream ? 'visible' : 'hidden',
            opacity: assignedStream ? 1 : 0,
            pointerEvents: assignedStream ? 'auto' : 'none',
            zIndex: assignedStream ? 0 : -9999
          }}
        >
          <div className={styles.playerFrame} ref={playerContainerRef} id={`player-${slot.id}`} />
          {assignedStream && (
            <>
              {/* モバイル用タップ検出レイヤー */}
              {isMobile && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: showMobileControls ? -1 : 10,
                    pointerEvents: showMobileControls ? 'none' : 'auto',
                    background: 'transparent'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                    setShowMobileControls(true);
                  }}
                />
              )}
              <div
                className={styles.selectableOverlay}
                style={{
                  pointerEvents: 'none'
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
              {/* モバイル用のコントロールボタン */}
              {isMobile && (
                <>
                  <button
                    className={styles.mobileCloseButton}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      clearSlot(slot.id);
                      // 配信削除をトラッキング
                      if (assignedStream) {
                        trackStream({
                          actionType: 'clear',
                          platform: assignedStream.platform,
                          slotId: slot.id
                        });
                        trackStreamAction('clear', assignedStream.platform, slot.id);
                      }
                    }}
                    aria-label="配信を削除"
                    style={{
                      opacity: showMobileControls ? 1 : 0,
                      pointerEvents: showMobileControls ? 'auto' : 'none'
                    }}
                  >
                    <XMarkIcon />
                  </button>
                  <button
                    className={styles.mobileMuteButton}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSlotMute(slot.id);
                      // ミュート/ミュート解除をトラッキング
                      if (assignedStream) {
                        trackStream({
                          actionType: slot.muted ? 'unmute' : 'mute',
                          platform: assignedStream.platform,
                          slotId: slot.id
                        });
                        trackStreamAction(slot.muted ? 'unmute' : 'mute', assignedStream.platform, slot.id);
                      }
                    }}
                    aria-label={slot.muted ? 'ミュート解除' : 'ミュート'}
                    style={{
                      opacity: showMobileControls ? 1 : 0,
                      pointerEvents: showMobileControls ? 'auto' : 'none'
                    }}
                  >
                    {slot.muted ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* placeholder は assignedStream が null の時のみ表示 */}
        {!assignedStream && (
          <div
            className={styles.placeholder}
            onClick={(e) => {
              e.stopPropagation();
              setShowSelectionModal(true);
              setModalOpen(true);
              trackButtonClick('stream_slot_add');
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
                    {/* フォーカスボタン（課金機能として将来復活予定のためコメントアウト）
                    <button
                      className={styles.focusButton}
                      type="button"
                      onClick={handleFocusPreset}
                    >
                      {preset === 'focus' ? '通常表示' : 'フォーカス'}
                    </button>
                    */}
                    <button
                      className={styles.fullscreenButton}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        clearSlot(slot.id);
                        // 配信削除をトラッキング
                        if (assignedStream) {
                          trackStream({
                            actionType: 'clear',
                            platform: assignedStream.platform,
                            slotId: slot.id
                          });
                          trackStreamAction('clear', assignedStream.platform, slot.id);
                        }
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
                        // ミュート/ミュート解除をトラッキング
                        if (assignedStream) {
                          trackStream({
                            actionType: slot.muted ? 'unmute' : 'mute',
                            platform: assignedStream.platform,
                            slotId: slot.id
                          });
                          trackStreamAction(slot.muted ? 'unmute' : 'mute', assignedStream.platform, slot.id);
                        }
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
                        onMouseUp={() => {
                          // 音量変更完了時にトラッキング
                          if (assignedStream) {
                            trackStream({
                              actionType: 'volume_change',
                              platform: assignedStream.platform,
                              slotId: slot.id,
                              value: slot.volume
                            });
                            trackButtonClick('stream_slot_volume', {
                              platform: assignedStream.platform,
                              slot_index: slot.id,
                              volume: slot.volume
                            });
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
};

// React.memo カスタム比較関数
const arePropsEqual = (
  prevProps: StreamSlotCardProps,
  nextProps: StreamSlotCardProps
): boolean => {
  return (
    prevProps.slot.id === nextProps.slot.id &&
    prevProps.slot.assignedStream?.id === nextProps.slot.assignedStream?.id &&
    prevProps.slot.quality === nextProps.slot.quality &&
    prevProps.slot.volume === nextProps.slot.volume &&
    prevProps.slot.muted === nextProps.slot.muted &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.showSelection === nextProps.showSelection
  );
};

// React.memo でラップして export
export const StreamSlotCard = memo(StreamSlotCardComponent, arePropsEqual);
