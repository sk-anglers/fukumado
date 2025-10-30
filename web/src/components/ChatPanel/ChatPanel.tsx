import clsx from 'clsx';
import { useMemo, useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useChatStore } from '../../stores/chatStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useMobileMenuStore } from '../../stores/mobileMenuStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { config } from '../../config';
import { apiFetch } from '../../utils/api';
import type { Platform, ChatMessage, TwitchEmote } from '../../types';
import { EmotePicker } from '../EmotePicker/EmotePicker';
import styles from './ChatPanel.module.css';

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
        <span key={`${message.id}-text-${idx}`}>
          {message.message.substring(lastIndex, emote.start)}
        </span>
      );
    }

    // エモート画像
    const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`;
    parts.push(
      <img
        key={`${message.id}-emote-${emote.id}-${idx}`}
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
      <span key={`${message.id}-text-end`}>{message.message.substring(lastIndex)}</span>
    );
  }

  return <>{parts}</>;
};

type ChatFilter = 'all' | Platform;

const filterLabels: Record<ChatFilter, string> = {
  all: 'ALL',
  youtube: 'YouTube',
  twitch: 'Twitch',
  niconico: 'ニコニコ'
};

export const ChatPanel = (): JSX.Element => {
  const { filter, messages, setFilter, highlightedCount, selectedChannelId, setSelectedChannelId } = useChatStore((state) => ({
    filter: state.filter,
    messages: state.messages,
    setFilter: state.setFilter,
    highlightedCount: state.highlightedCount,
    selectedChannelId: state.selectedChannelId,
    setSelectedChannelId: state.setSelectedChannelId
  }));

  const slots = useLayoutStore((state) => state.slots);
  const isMobile = useIsMobile();
  const setChatOpen = useMobileMenuStore((state) => state.setChatOpen);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  const filteredMessages = useMemo(
    () => (filter === 'all' ? messages : messages.filter((message) => message.platform === filter)),
    [filter, messages]
  );

  // 有効なプラットフォームのフィルタのみを表示
  const availableFilters = useMemo(() => {
    const filters: ChatFilter[] = ['all', 'twitch'];
    if (config.enableYoutube) filters.push('youtube');
    if (config.enableNiconico) filters.push('niconico');
    return filters;
  }, []);

  // 視聴中の配信（スロットに割り当てられている配信）を取得
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
      // 選択中のチャンネルが視聴中配信に含まれない場合、最初の配信を選択
      setSelectedChannelId(watchingStreams.length > 0 ? watchingStreams[0].channelId || null : null);
    }
  }, [watchingStreams, selectedChannelId, setSelectedChannelId]);

  // チャット送信処理
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChannelId || isSending) {
      return;
    }

    const selectedStream = watchingStreams.find((s) => s.channelId === selectedChannelId);
    if (!selectedStream) {
      return;
    }

    setIsSending(true);
    try {
      // Twitchの場合、channelLoginが必要
      const payload: {
        channelId: string;
        channelLogin?: string;
        message: string;
      } = {
        channelId: selectedChannelId,
        message: messageInput.trim()
      };

      if (selectedStream.platform === 'twitch') {
        // channelLoginフィールドを使用
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

      // 送信成功：入力欄をクリア
      setMessageInput('');
    } catch (error) {
      console.error('[ChatPanel] メッセージ送信エラー:', error);
      alert(error instanceof Error ? error.message : 'メッセージの送信に失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  // 新しいメッセージが追加されたら自動的に最下部にスクロール
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [filteredMessages]);

  // エモート選択時の処理
  const handleSelectEmote = (emoteName: string) => {
    setMessageInput((prev) => {
      // カーソル位置にエモート名を挿入（前後にスペースを追加）
      const spaceBefore = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
      return `${prev}${spaceBefore}${emoteName} `;
    });
  };

  return (
    <div className={styles.chatPanel}>
      <header className={styles.header}>
        <h2>チャット</h2>
        <div className={styles.headerRight}>
          <span className={styles.highlightBadge}>ハイライト {highlightedCount}</span>
          {isMobile && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setChatOpen(false)}
              aria-label="チャットを閉じる"
            >
              <XMarkIcon />
            </button>
          )}
        </div>
      </header>
      {/* 有効なプラットフォームが2つ以上ある場合のみタブを表示 */}
      {availableFilters.length > 2 && (
      <div className={styles.tabs}>
        {availableFilters.map((key) => (
          <button
            key={key}
            type="button"
            className={clsx(styles.tabButton, filter === key && styles.tabButtonActive)}
            onClick={() => setFilter(key)}
          >
            {filterLabels[key]}
          </button>
        ))}
      </div>
      )}
      <div className={styles.messageList} ref={messageListRef}>
        {filteredMessages.slice().reverse().map((message, index) => {
          if (!message.id) {
            console.warn('[ChatPanel] Message without ID:', { index, message });
          }
          return (
          <article
            key={message.id || `fallback-${index}`}
            className={clsx(
              styles.message,
              message.highlight && styles.messageHighlight,
              message.bits && styles.messageBits
            )}
          >
            <div className={styles.avatar} style={{ backgroundColor: message.avatarColor }}>
              {message.author?.slice(0, 2) || '??'}
            </div>
            <div className={styles.messageBody}>
              <div className={styles.messageHeader}>
                {message.badges && message.badges.length > 0 && (
                  <div className={styles.badges}>
                    {message.badges.filter(badge => badge.imageUrl).map((badge) => (
                      <img
                        key={`${badge.setId}-${badge.version}`}
                        src={badge.imageUrl!}
                        alt={badge.setId}
                        className={styles.badge}
                        title={badge.setId}
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
                <span className={styles.author}>{message.author || 'Unknown'}</span>
                {message.channelName && (
                  <span className={styles.channelName}>@ {message.channelName}</span>
                )}
                {message.bits && (
                  <span className={styles.bitsAmount}>{message.bits} Bits</span>
                )}
                <span className={styles.timestamp}>{message.timestamp}</span>
              </div>
              <p>{renderMessageWithEmotes(message)}</p>
            </div>
          </article>
          );
        })}
      </div>
      <footer className={styles.footer}>
        {watchingStreams.length > 0 && (
          <div className={styles.sendTargetSection}>
            <label htmlFor="channel-select" className={styles.sendTargetLabel}>
              チャット送信先
            </label>
            <select
              id="channel-select"
              className={styles.channelSelect}
              value={selectedChannelId || ''}
              onChange={(e) => setSelectedChannelId(e.target.value)}
            >
              {watchingStreams.map((stream) => (
                <option key={stream.channelId} value={stream.channelId}>
                  {stream.displayName}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className={styles.inputRow}>
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
            className={clsx(messageInput.trim().length > 0 && !isSending && styles.sendButtonActive)}
            onClick={handleSendMessage}
            disabled={watchingStreams.length === 0 || !messageInput.trim() || isSending}
          >
            {isSending ? '送信中...' : '送信'}
          </button>
        </div>
        <div className={styles.emotePickerRow}>
          <EmotePicker onSelectEmote={handleSelectEmote} />
        </div>
      </footer>
    </div>
  );
};
