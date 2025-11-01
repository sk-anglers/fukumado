import clsx from 'clsx';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { useLayoutStore } from '../../stores/layoutStore';
import { useChatStore } from '../../stores/chatStore';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '../../utils/api';
import type { ChatMessage } from '../../types';
import styles from './StreamGrid.module.css';
import { StreamSlotCard } from './StreamSlot/StreamSlot';
import { useIsMobile, useIsLandscape } from '../../hooks/useMediaQuery';

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
  const { slots, preset, selectedSlotId, showSelection, selectSlot, setShowSelection, activeSlotsCount, fullscreen, setFullscreen, clearSelection, isModalOpen, setActiveSlotsCount, toggleMuteAll, mutedAll, slotReadyStates, autoUnmutedApplied } = useStoreWithEqualityFn(useLayoutStore, (state) => ({
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
    mutedAll: state.mutedAll,
    slotReadyStates: state.slotReadyStates,
    autoUnmutedApplied: state.autoUnmutedApplied
  }), shallow);

  const isMobile = useIsMobile();
  const isLandscape = useIsLandscape();

  const autoHideTimerRef = useRef<number | null>(null);
  const initialMuteAppliedRef = useRef(false);
  const [showChat, setShowChat] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const messages = useChatStore((state) => state.messages);

  // モバイルで初回ロード時に全ミュート（autoplay対応）
  useEffect(() => {
    if (isMobile && !initialMuteAppliedRef.current) {
      initialMuteAppliedRef.current = true;
      // 全スロットがミュートされていない場合のみ全ミュートを実行
      if (!mutedAll) {
        toggleMuteAll();
      }
      // 自動ミュート解除フラグをリセット
      useLayoutStore.getState().resetAutoUnmuted();
    }
  }, [isMobile, mutedAll, toggleMuteAll]);

  // モバイルで画面の向きに応じてスロット数と全画面表示を変更
  useEffect(() => {
    if (isMobile) {
      if (isLandscape) {
        // 横向き：2枠表示 + 全画面モード
        setActiveSlotsCount(2);
        setFullscreen(true);
      } else {
        // 縦向き：4枠表示 + 全画面解除
        setActiveSlotsCount(4);
        setFullscreen(false);
      }
    }
  }, [isMobile, isLandscape, setActiveSlotsCount, setFullscreen]);

  // モバイルで全スロット再生確認後の自動ミュート解除
  useEffect(() => {
    if (!isMobile || !mutedAll || autoUnmutedApplied) return;

    // 配信が割り当てられているスロットを取得
    const assignedSlots = slots.slice(0, activeSlotsCount).filter((slot) => slot.assignedStream);

    // 配信がない場合は何もしない
    if (assignedSlots.length === 0) return;

    // 全ての配信が割り当てられたスロットが再生準備完了しているかチェック
    const allReady = assignedSlots.every((slot) => slotReadyStates[slot.id] === true);

    if (allReady) {
      console.log('[StreamGrid] 全スロット再生準備完了 - 自動ミュート解除を実行');
      toggleMuteAll(); // 全ミュート解除
      useLayoutStore.setState({ autoUnmutedApplied: true }); // フラグを立てる
    }
  }, [isMobile, mutedAll, autoUnmutedApplied, slots, activeSlotsCount, slotReadyStates, toggleMuteAll]);

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
      className={clsx(styles.gridContainer, fullscreen && styles.gridContainerFullscreen, fullscreen && showChat && styles.gridContainerWithChat)}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
    >
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
