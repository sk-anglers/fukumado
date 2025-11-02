import clsx from 'clsx';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { useLayoutStore } from '../../stores/layoutStore';
import { useChatStore } from '../../stores/chatStore';
import { ChatBubbleLeftRightIcon, SpeakerWaveIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '../../utils/api';
import type { ChatMessage } from '../../types';
import styles from './StreamGrid.module.css';
import { StreamSlotCard } from './StreamSlot/StreamSlot';
import { useIsMobile } from '../../hooks/useMediaQuery';

// メッセージテキストをエモート画像付きでレンダリング
const renderMessageWithEmotes = (message: ChatMessage) => {
  if (!message.emotes || message.emotes.length === 0) {
    return <span>{message.message}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // エモートの位置でソート
  const sortedEmotes = message.emotes.flatMap((emote) =>
    emote.positions.map((pos) => ({
      ...pos,
      id: emote.id
    }))
  ).sort((a, b) => a.start - b.start);

  sortedEmotes.forEach((emote, idx) => {
    // エモートの前のテキスト
    if (emote.start > lastIndex) {
      parts.push(
        <span key={`text-${idx}`}>
          {message.message.substring(lastIndex, emote.start)}
        </span>
      );
    }

    // エモート画像
    const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`;
    parts.push(
      <img
        key={`emote-${idx}`}
        src={emoteUrl}
        alt="emote"
        className={styles.emote}
        loading="lazy"
      />
    );

    lastIndex = emote.end + 1;
  });

  // 残りのテキスト
  if (lastIndex < message.message.length) {
    parts.push(
      <span key="text-end">{message.message.substring(lastIndex)}</span>
    );
  }

  return <>{parts}</>;
};

export const StreamGrid = (): JSX.Element => {
  const { slots, preset, selectedSlotId, showSelection, selectSlot, setShowSelection, activeSlotsCount, fullscreen, setFullscreen, clearSelection, isModalOpen, setActiveSlotsCount, toggleMuteAll, toggleSlotMute, mutedAll, slotReadyStates, slotPlayingStates, autoUnmutedApplied } = useStoreWithEqualityFn(useLayoutStore, (state) => ({
    slots: state.slots,
    preset: state.preset,
    selectedSlotId: state.selectedSlotId,
    showSelection: state.showSelection,
    selectSlot: state.selectSlot,
    setShowSelection: state.setShowSelection,
    activeSlotsCount: state.activeSlotsCount,
    fullscreen: state.fullscreen,
    setFullscreen: state.setFullscreen,
    clearSelection: state.clearSelection,
    isModalOpen: state.isModalOpen,
    setActiveSlotsCount: state.setActiveSlotsCount,
    toggleMuteAll: state.toggleMuteAll,
    toggleSlotMute: state.toggleSlotMute,
    mutedAll: state.mutedAll,
    slotReadyStates: state.slotReadyStates,
    slotPlayingStates: state.slotPlayingStates,
    autoUnmutedApplied: state.autoUnmutedApplied
  }), shallow);

  const isMobile = useIsMobile();

  const autoHideTimerRef = useRef<number | null>(null);
  const initialMuteAppliedRef = useRef(false);
  const [showChat, setShowChat] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showReadyNotification, setShowReadyNotification] = useState(false);
  const [showLoadingPopup, setShowLoadingPopup] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showReloadPopup, setShowReloadPopup] = useState(false);
  const hasPlayedStatesRef = useRef<Record<string, boolean>>({});

  const messages = useChatStore((state) => state.messages);

  // モバイルで初回ロード時に全ミュート（autoplay対応）
  useEffect(() => {
    if (isMobile && !initialMuteAppliedRef.current) {
      initialMuteAppliedRef.current = true;
      // 自動ミュート解除フラグをリセット
      useLayoutStore.getState().resetAutoUnmuted();
      // 現在のミュート状態を取得して、ミュートされていない場合のみ全ミュートを実行
      const currentMutedAll = useLayoutStore.getState().mutedAll;
      if (!currentMutedAll) {
        toggleMuteAll();
      }
    }
  }, [isMobile, toggleMuteAll]);

  // モバイルで初回アクセス時にスロット数を設定（横向き/縦向き関係なく常に3枠）
  useEffect(() => {
    if (isMobile && activeSlotsCount !== 3) {
      setActiveSlotsCount(3);
    }
  }, [isMobile, activeSlotsCount, setActiveSlotsCount]);

  // モバイルで準備中ポップアップと再生開始通知を管理
  useEffect(() => {
    if (!isMobile || !mutedAll) {
      setShowLoadingPopup(false);
      return;
    }

    // 配信が割り当てられているスロットを取得
    const assignedSlots = slots.slice(0, activeSlotsCount).filter((slot) => slot.assignedStream);
    const remainingSlots = activeSlotsCount - assignedSlots.length;

    // 全スロットに配信が割り当てられていない場合
    if (remainingSlots > 0) {
      setShowLoadingPopup(true);
      setLoadingMessage(`残り${remainingSlots}枠をセットしてください`);
      setShowReadyNotification(false);
      return;
    }

    // 全スロットに配信が割り当てられている場合
    // 全ての配信が割り当てられたスロットの準備が完了しているかチェック（ツイッチ情報が消えた状態）
    const allReady = assignedSlots.every((slot) => slotReadyStates[slot.id] === true);

    if (allReady && !autoUnmutedApplied) {
      // 全スロット準備完了 - 通知を表示し、準備中ポップアップを非表示
      setShowReadyNotification(true);
      setShowLoadingPopup(false);
      useLayoutStore.setState({ autoUnmutedApplied: true }); // フラグを立てる（通知は一度だけ）
    } else if (!allReady) {
      // まだ全スロット準備完了していない - 準備中ポップアップを表示
      setShowLoadingPopup(true);
      setLoadingMessage('配信を読み込んでいます...');
      setShowReadyNotification(false);
    }
  }, [isMobile, mutedAll, autoUnmutedApplied, slots, activeSlotsCount, slotReadyStates]);

  // ミュート解除されたら通知を非表示
  useEffect(() => {
    if (!mutedAll && showReadyNotification) {
      setShowReadyNotification(false);
    }
  }, [mutedAll, showReadyNotification]);

  // モバイルで再生停止を検知してリロードを促す
  useEffect(() => {
    if (!isMobile) return;

    // 配信が割り当てられているスロットを取得
    const assignedSlots = slots.slice(0, activeSlotsCount).filter((slot) => slot.assignedStream);

    assignedSlots.forEach((slot) => {
      const isPlaying = slotPlayingStates[slot.id] === true;
      const hasPlayed = hasPlayedStatesRef.current[slot.id] === true;

      // 一度でも再生開始したことを記録
      if (isPlaying && !hasPlayed) {
        hasPlayedStatesRef.current[slot.id] = true;
      }

      // 一度再生開始後に停止した場合、リロードポップアップを表示
      if (hasPlayed && !isPlaying && !showReloadPopup) {
        setShowReloadPopup(true);
      }
    });
  }, [isMobile, slots, activeSlotsCount, slotPlayingStates, showReloadPopup]);

  // activeSlotsをメモ化（slots配列またはactiveSlotsCountが変わったときのみ再計算）
  const activeSlots = useMemo(() => slots.slice(0, activeSlotsCount), [slots, activeSlotsCount]);

  // 最新の50件のメッセージのみ表示
  const displayMessages = useMemo(() => messages.slice(0, 50), [messages]);

  // 視聴中の配信を取得
  const watchingStreams = useMemo(() => {
    return slots
      .filter((slot) => slot.assignedStream)
      .map((slot) => slot.assignedStream!);
  }, [slots]);

  // 送信先が未選択または無効な場合、最初の視聴中配信を選択
  useEffect(() => {
    if (!selectedChannelId && watchingStreams.length > 0) {
      setSelectedChannelId(watchingStreams[0].channelId || null);
    } else if (selectedChannelId && !watchingStreams.find((s) => s.channelId === selectedChannelId)) {
      setSelectedChannelId(watchingStreams.length > 0 ? watchingStreams[0].channelId || null : null);
    }
  }, [watchingStreams, selectedChannelId]);

  // ビジュアルオーバーレイの自動非表示（3秒後）
  useEffect(() => {
    if (!selectedSlotId || isModalOpen) return;

    // 既存のタイマーをクリア
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }

    // 3秒後にビジュアルオーバーレイを非表示
    autoHideTimerRef.current = setTimeout(() => {
      setShowSelection(false);
    }, 3000);

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [selectedSlotId, setShowSelection, isModalOpen]);

  // オーバーレイを再表示してタイマーをリセット（マウス・タッチ共通処理）
  const showOverlayWithTimer = (): void => {
    if (!selectedSlotId || isModalOpen) return;

    // オーバーレイを再表示
    setShowSelection(true);

    // タイマーをリセット
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }

    autoHideTimerRef.current = setTimeout(() => {
      setShowSelection(false);
    }, 3000);
  };

  // マウス移動時にオーバーレイを再表示してタイマーをリセット
  const handleMouseMove = (): void => {
    showOverlayWithTimer();
  };

  // タッチ開始時にオーバーレイを再表示してタイマーをリセット
  const handleTouchStart = (): void => {
    showOverlayWithTimer();
  };

  const handleExitFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setFullscreen(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to exit fullscreen', error);
    }
  };

  // チャット送信処理
  const handleSendMessage = async (): Promise<void> => {
    if (!messageInput.trim() || !selectedChannelId || isSending) {
      return;
    }

    const selectedStream = watchingStreams.find((s) => s.channelId === selectedChannelId);
    if (!selectedStream) {
      return;
    }

    setIsSending(true);
    try {
      const payload: {
        channelId: string;
        channelLogin?: string;
        message: string;
      } = {
        channelId: selectedChannelId,
        message: messageInput.trim()
      };

      if (selectedStream.platform === 'twitch') {
        if (selectedStream.channelLogin) {
          payload.channelLogin = selectedStream.channelLogin;
        }
      }

      const response = await apiFetch(`/api/${selectedStream.platform}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'メッセージの送信に失敗しました');
      }

      setMessageInput('');
    } catch (error) {
      console.error('[StreamGrid] メッセージ送信エラー:', error);
      alert(error instanceof Error ? error.message : 'メッセージの送信に失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className={clsx(styles.gridContainer, fullscreen && styles.gridContainerFullscreen, fullscreen && showChat && styles.gridContainerWithChat, isMobile && (showLoadingPopup || showReadyNotification || showReloadPopup) && styles.gridContainerWithPopup)}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
    >
      {/* モバイル用準備中ポップアップ */}
      {isMobile && showLoadingPopup && (
        <div className={styles.loadingPopup}>
          <div className={styles.loadingPopupContent}>
            {loadingMessage === '配信を読み込んでいます...' && (
              <div className={styles.loadingSpinner}></div>
            )}
            <p className={styles.loadingPopupText}>{loadingMessage}</p>
          </div>
        </div>
      )}
      {/* モバイル用準備完了通知 */}
      {isMobile && showReadyNotification && (
        <div className={styles.readyNotification}>
          <div className={styles.readyNotificationContent}>
            <SpeakerWaveIcon className={styles.readyNotificationIcon} />
            <p className={styles.readyNotificationText}>
              全配信の準備が完了しました！<br />
              ヘッダーのスピーカーアイコンをタップして音声をONにしてください
            </p>
          </div>
        </div>
      )}
      {/* モバイル用リロード通知 */}
      {isMobile && showReloadPopup && (
        <div className={styles.reloadNotification}>
          <div className={styles.reloadNotificationContent}>
            <p className={styles.reloadNotificationText}>
              配信が停止しました
            </p>
            <button
              type="button"
              className={styles.reloadButton}
              onClick={() => window.location.reload()}
            >
              <ArrowPathIcon className={styles.reloadButtonIcon} />
              <span>リロード</span>
            </button>
          </div>
        </div>
      )}
      <div className={styles.gridWrapper}>
        <div className={clsx(
          styles.grid,
          styles[preset],
          styles[`count${activeSlotsCount}`],
          fullscreen && styles.gridFullscreen
        )}>
        {activeSlots.map((slot) => (
          <StreamSlotCard
            key={slot.id}
            slot={slot}
            isActive={showSelection && selectedSlotId === slot.id}
            isFocused={preset === 'focus' && selectedSlotId === slot.id}
            showSelection={showSelection}
            onSelect={() => selectSlot(slot.id)}
          />
        ))}
        </div>
        {fullscreen && (
          <div className={styles.fullscreenToggle}>
            <button type="button" onClick={() => setShowChat(!showChat)} className={clsx(showChat && styles.chatButtonActive)}>
              <ChatBubbleLeftRightIcon />
              <span>{showChat ? 'コメント非表示' : 'コメント表示'}</span>
            </button>
            <button type="button" onClick={handleExitFullscreen}>
              全画面を終了
            </button>
          </div>
        )}
      </div>
      {fullscreen && showChat && (
        <div className={styles.fullscreenChat}>
          <div className={styles.fullscreenChatHeader}>
            <h3>チャット</h3>
          </div>
          <div className={styles.fullscreenChatMessages}>
            {displayMessages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  styles.fullscreenChatMessage,
                  message.highlight && styles.fullscreenChatMessageHighlight,
                  message.bits && styles.fullscreenChatMessageBits
                )}
              >
                <div className={styles.fullscreenChatAvatar} style={{ backgroundColor: message.avatarColor }}>
                  {message.author?.slice(0, 2) || '??'}
                </div>
                <div className={styles.fullscreenChatBody}>
                  <div className={styles.fullscreenChatMessageHeader}>
                    {message.badges && message.badges.length > 0 && (
                      <div className={styles.fullscreenChatBadges}>
                        {message.badges.filter(badge => badge.imageUrl).map((badge) => (
                          <img
                            key={`${badge.setId}-${badge.version}`}
                            src={badge.imageUrl!}
                            alt={badge.setId}
                            className={styles.fullscreenChatBadge}
                            title={badge.setId}
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}
                    <span className={styles.fullscreenChatAuthor}>{message.author || 'Unknown'}</span>
                    {message.channelName && (
                      <span className={styles.fullscreenChatChannel}>@ {message.channelName}</span>
                    )}
                    {message.bits && (
                      <span className={styles.fullscreenChatBitsAmount}>{message.bits} Bits</span>
                    )}
                  </div>
                  <p className={styles.fullscreenChatText}>{renderMessageWithEmotes(message)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.fullscreenChatFooter}>
            {watchingStreams.length > 0 && (
              <select
                className={styles.fullscreenChatSelect}
                value={selectedChannelId || ''}
                onChange={(e) => setSelectedChannelId(e.target.value)}
              >
                {watchingStreams.map((stream) => (
                  <option key={stream.channelId} value={stream.channelId}>
                    {stream.displayName} ({stream.platform.toUpperCase()})
                  </option>
                ))}
              </select>
            )}
            <div className={styles.fullscreenChatInputRow}>
              <input
                type="text"
                placeholder={watchingStreams.length === 0 ? '配信を視聴するとチャットを送信できます' : 'チャットを送信'}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={watchingStreams.length === 0 || isSending}
              />
              <button
                type="button"
                className={clsx(styles.fullscreenChatSendButton, messageInput.trim().length > 0 && !isSending && styles.fullscreenChatSendButtonActive)}
                onClick={handleSendMessage}
                disabled={watchingStreams.length === 0 || !messageInput.trim() || isSending}
              >
                {isSending ? '送信中...' : '送信'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
