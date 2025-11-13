import { FaceSmileIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLayoutStore } from '../../stores/layoutStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAnalytics } from '../../hooks/useAnalytics';
import { apiFetch } from '../../utils/api';
import { trackButtonClick } from '../../utils/gtm';
import styles from './EmotePicker.module.css';

interface Emote {
  id: string;
  name: string;
  imageUrl: string;
  emoteType?: string;
}

interface EmotePickerProps {
  onSelectEmote: (emoteName: string) => void;
}

type EmoteCategory = 'global' | 'channel';

export const EmotePicker = ({ onSelectEmote }: EmotePickerProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const [globalEmotes, setGlobalEmotes] = useState<Emote[]>([]);
  const [channelEmotes, setChannelEmotes] = useState<Emote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<EmoteCategory>('global');
  const [isLoading, setIsLoading] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const slots = useLayoutStore((state) => state.slots);
  const isMobile = useIsMobile();
  const { trackFeature } = useAnalytics();

  // 視聴中の配信を取得
  const watchingStreams = useMemo(() => {
    return slots
      .filter((slot) => slot.assignedStream && slot.assignedStream.platform === 'twitch')
      .map((slot) => slot.assignedStream!);
  }, [slots]);

  // グローバルエモートを取得
  const fetchGlobalEmotes = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/api/twitch/emotes/global');

      if (!response.ok) {
        throw new Error('Failed to fetch global emotes');
      }

      const data = await response.json();
      setGlobalEmotes(data.items || []);
    } catch (error) {
      console.error('[EmotePicker] Error fetching global emotes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // チャンネルエモートを取得（複数チャンネル対応）
  const fetchChannelEmotes = async (broadcasterIds: string[]) => {
    if (broadcasterIds.length === 0) {
      setChannelEmotes([]);
      return;
    }

    try {
      setIsLoading(true);

      // 全てのチャンネルのエモートを並列で取得
      const requests = broadcasterIds.map(async (broadcasterId) => {
        try {
          const response = await apiFetch(`/api/twitch/emotes/channel?broadcasterId=${broadcasterId}`);

          if (!response.ok) {
            console.error(`[EmotePicker] Failed to fetch emotes for channel ${broadcasterId}`);
            return [];
          }

          const data = await response.json();
          return data.items || [];
        } catch (error) {
          console.error(`[EmotePicker] Error fetching emotes for channel ${broadcasterId}:`, error);
          return [];
        }
      });

      const results = await Promise.all(requests);

      // 全ての結果をマージして重複を排除
      const allEmotes = results.flat();
      const uniqueEmotes = Array.from(
        new Map(allEmotes.map(emote => [emote.id, emote])).values()
      );

      setChannelEmotes(uniqueEmotes);
      console.log(`[EmotePicker] Fetched ${uniqueEmotes.length} unique emotes from ${broadcasterIds.length} channels`);
    } catch (error) {
      console.error('[EmotePicker] Error fetching channel emotes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ピッカーを開いたときにエモートを取得
  useEffect(() => {
    if (isOpen && globalEmotes.length === 0) {
      fetchGlobalEmotes();
    }
  }, [isOpen]);

  // カテゴリ変更時にチャンネルエモートを取得
  useEffect(() => {
    if (category === 'channel' && watchingStreams.length > 0 && channelEmotes.length === 0) {
      const broadcasterIds = watchingStreams.map(stream => stream.channelId).filter((id): id is string => !!id);
      fetchChannelEmotes(broadcasterIds);
    }
  }, [category, watchingStreams]);

  // 表示するエモート一覧
  const displayEmotes = useMemo(() => {
    const emotes = category === 'global' ? globalEmotes : channelEmotes;

    if (!searchQuery) {
      return emotes;
    }

    const query = searchQuery.toLowerCase();
    return emotes.filter((emote) => emote.name.toLowerCase().includes(query));
  }, [category, globalEmotes, channelEmotes, searchQuery]);

  const handleEmoteClick = (emoteName: string) => {
    // エモート選択をトラッキング（エラーがあっても継続）
    try {
      trackFeature('emote', 'twitch');
    } catch (err) {
      console.error('[EmotePicker] Analytics tracking error:', err);
    }

    // GTMトラッキング
    trackButtonClick('emote_select', {
      emote_name: emoteName,
      category: category
    });

    onSelectEmote(emoteName);
    setIsOpen(false);
    setSearchQuery('');
  };

  const togglePicker = () => {
    // GTMトラッキング
    trackButtonClick('emote_picker_toggle', {
      action: isOpen ? 'close' : 'open'
    });

    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery('');
    }
  };

  // ボタン位置を計算してピッカーの位置を設定
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();

      // モバイルとデスクトップで異なるサイズを使用
      const pickerWidth = isMobile ? Math.min(window.innerWidth - 16, 380) : 420;
      const pickerHeight = isMobile ? Math.min(window.innerHeight * 0.6, 400) : 480;
      const margin = isMobile ? 8 : 8;

      // 左右の位置を計算（画面からはみ出さないように）
      let left = rect.left;

      // モバイルの場合は中央寄せを優先
      if (isMobile) {
        left = (window.innerWidth - pickerWidth) / 2;
      } else {
        const rightEdge = left + pickerWidth;
        if (rightEdge > window.innerWidth) {
          // 右側にはみ出す場合は、右端に合わせる
          left = window.innerWidth - pickerWidth - margin;
        }
      }

      if (left < margin) {
        // 左側にはみ出す場合は、左端に合わせる
        left = margin;
      }

      // 上下の位置を計算
      let top = rect.top - pickerHeight - margin;

      // モバイルの場合は画面下部に固定
      if (isMobile) {
        top = window.innerHeight - pickerHeight - margin - 60; // 60pxはフッターなどのマージン
      } else {
        if (top < margin) {
          // 上側にはみ出す場合は、ボタンの下に表示
          top = rect.bottom + margin;
        }
        // 下側にはみ出す場合も調整
        if (top + pickerHeight > window.innerHeight - margin) {
          top = window.innerHeight - pickerHeight - margin;
        }
      }

      setPickerPosition({ top, left });
    }
  }, [isOpen, isMobile]);

  // 外側クリックでピッカーを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={clsx(styles.triggerButton, isOpen && styles.triggerButtonActive)}
        onClick={togglePicker}
        title="エモートを選択"
      >
        <FaceSmileIcon />
        <span>エモート</span>
      </button>

      {isOpen && createPortal(
        <div
          ref={pickerRef}
          className={styles.picker}
          style={{
            position: 'fixed',
            top: `${pickerPosition.top}px`,
            left: `${pickerPosition.left}px`,
            width: isMobile ? `${Math.min(window.innerWidth - 16, 380)}px` : '420px',
            maxHeight: isMobile ? `${Math.min(window.innerHeight * 0.6, 400)}px` : '480px'
          }}
        >
          <div className={styles.header}>
            <div className={styles.tabs}>
              <button
                type="button"
                className={clsx(styles.tabButton, category === 'global' && styles.tabButtonActive)}
                onClick={() => {
                  trackButtonClick('emote_category_change', {
                    category: 'global'
                  });
                  setCategory('global');
                }}
              >
                グローバル
              </button>
              {watchingStreams.length > 0 && (
                <button
                  type="button"
                  className={clsx(styles.tabButton, category === 'channel' && styles.tabButtonActive)}
                  onClick={() => {
                    trackButtonClick('emote_category_change', {
                      category: 'channel'
                    });
                    setCategory('channel');
                  }}
                >
                  チャンネル
                </button>
              )}
            </div>
            <div className={styles.searchBox}>
              <MagnifyingGlassIcon className={styles.searchIcon} />
              <input
                type="text"
                placeholder="エモートを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          <div className={styles.emoteList}>
            {isLoading ? (
              <div className={styles.loading}>読み込み中...</div>
            ) : displayEmotes.length === 0 ? (
              <div className={styles.empty}>
                {searchQuery ? '検索結果が見つかりません' : 'エモートがありません'}
              </div>
            ) : (
              displayEmotes.map((emote) => (
                <button
                  key={emote.id}
                  type="button"
                  className={styles.emoteButton}
                  onClick={() => handleEmoteClick(emote.name)}
                  title={emote.name}
                >
                  <img src={emote.imageUrl} alt={emote.name} loading="lazy" />
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
