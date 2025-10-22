import clsx from 'clsx';
import { useMemo, useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { config } from '../../config';
import type { Platform } from '../../types';
import styles from './ChatPanel.module.css';

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
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);

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
      setSelectedChannelId(watchingStreams[0].channelId);
    } else if (selectedChannelId && !watchingStreams.find((s) => s.channelId === selectedChannelId)) {
      // 選択中のチャンネルが視聴中配信に含まれない場合、最初の配信を選択
      setSelectedChannelId(watchingStreams.length > 0 ? watchingStreams[0].channelId : null);
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

      const response = await fetch(`/api/${selectedStream.platform}/chat/send`, {
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

  return (
    <div className={styles.chatPanel}>
      <header className={styles.header}>
        <h2>チャット</h2>
        <span className={styles.highlightBadge}>ハイライト {highlightedCount}</span>
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
      <div className={styles.messageList}>
        {filteredMessages.map((message) => (
          <article
            key={message.id}
            className={clsx(styles.message, message.highlight && styles.messageHighlight)}
          >
            <div className={styles.avatar} style={{ backgroundColor: message.avatarColor }}>
              {message.author.slice(0, 2)}
            </div>
            <div className={styles.messageBody}>
              <div className={styles.messageHeader}>
                <span className={styles.author}>{message.author}</span>
                {message.channelName && (
                  <span className={styles.channelName}>@ {message.channelName}</span>
                )}
                <span className={styles.timestamp}>{message.timestamp}</span>
              </div>
              <p>{message.message}</p>
            </div>
          </article>
        ))}
      </div>
      <footer className={styles.footer}>
        {watchingStreams.length > 0 && (
          <select
            className={styles.channelSelect}
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
      </footer>
    </div>
  );
};
