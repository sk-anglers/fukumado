import clsx from 'clsx';
import { useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
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
  const { filter, messages, setFilter, highlightedCount } = useChatStore((state) => ({
    filter: state.filter,
    messages: state.messages,
    setFilter: state.setFilter,
    highlightedCount: state.highlightedCount
  }));

  const filteredMessages = useMemo(
    () => (filter === 'all' ? messages : messages.filter((message) => message.platform === filter)),
    [filter, messages]
  );

  return (
    <div className={styles.chatPanel}>
      <header className={styles.header}>
        <h2>チャット</h2>
        <span className={styles.highlightBadge}>ハイライト {highlightedCount}</span>
      </header>
      <div className={styles.tabs}>
        {(Object.keys(filterLabels) as ChatFilter[]).map((key) => (
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
                <span className={styles.timestamp}>{message.timestamp}</span>
              </div>
              <p>{message.message}</p>
            </div>
          </article>
        ))}
      </div>
      <footer className={styles.footer}>
        <input type="text" placeholder="チャットを送信（MVPでは読み取り専用）" disabled />
        <button type="button" disabled>
          送信
        </button>
      </footer>
    </div>
  );
};
