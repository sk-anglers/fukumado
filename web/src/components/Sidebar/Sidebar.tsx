import { FormEvent, useMemo, useState } from 'react';
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  SquaresPlusIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { type Streamer } from '../../types';
import { useLayoutStore } from '../../stores/layoutStore';
import { useUserStore } from '../../stores/userStore';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onOpenPresetModal: () => void;
}

const platformLabel: Record<Streamer['platform'], string> = {
  youtube: 'YouTube Live',
  twitch: 'Twitch',
  niconico: 'ニコニコ生放送'
};

const platformAccent: Record<Streamer['platform'], string> = {
  youtube: '#ef4444',
  twitch: '#a855f7',
  niconico: '#facc15'
};

const formatViewerCount = (viewerCount?: number): string => {
  if (viewerCount == null) return '視聴者数 -';
  return `視聴 ${viewerCount.toLocaleString()} 人`;
};

const formatMeta = (stream: Streamer): string => {
  if (stream.gameTitle) return stream.gameTitle;
  if (stream.liveSince) {
    const date = new Date(stream.liveSince);
    if (!Number.isNaN(date.getTime())) {
      return `${date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 配信開始`;
    }
  }
  return stream.channelTitle ?? '配信中';
};

interface ChannelResult {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  customUrl?: string;
}

const useYoutubeChannelSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChannelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const search = async (keyword: string): Promise<void> => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setResults([]);
      setError(undefined);
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/youtube/channels?q=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        throw new Error(`検索に失敗しました (${response.status})`);
      }
      const data = (await response.json()) as { items: ChannelResult[] };
      setResults(data.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setError(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    search
  };
};

export const Sidebar = ({ onOpenPresetModal }: SidebarProps): JSX.Element => {
  const {
    slots,
    selectedSlotId,
    selectSlot,
    availableStreams,
    streamsLoading,
    streamsError,
    assignStream,
    clearSlot,
    ensureSelection,
    activeSlotsCount,
    toggleSlotMute,
    setVolume
  } = useLayoutStore((state) => ({
    slots: state.slots,
    selectedSlotId: state.selectedSlotId,
    selectSlot: state.selectSlot,
    availableStreams: state.availableStreams,
    streamsLoading: state.streamsLoading,
    streamsError: state.streamsError,
    assignStream: state.assignStream,
    clearSlot: state.clearSlot,
    ensureSelection: state.ensureSelection,
    activeSlotsCount: state.activeSlotsCount,
    toggleSlotMute: state.toggleSlotMute,
    setVolume: state.setVolume
  }));
  const { followedChannels, addFollowedChannel, removeFollowedChannel } = useUserStore((state) => ({
    followedChannels: state.followedChannels,
    addFollowedChannel: state.addFollowedChannel,
    removeFollowedChannel: state.removeFollowedChannel
  }));

  const [channelIdInput, setChannelIdInput] = useState('');
  const [channelLabelInput, setChannelLabelInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { query: searchQuery, setQuery: setSearchQuery, results: searchResults, loading: searchLoading, error: searchError, search: executeSearch } =
    useYoutubeChannelSearch();

  const activeSlots = slots.slice(0, activeSlotsCount);
  const activeSlot = activeSlots.find((slot) => slot.id === selectedSlotId) ?? activeSlots[0];
  const activeSlotIndex = activeSlot ? activeSlots.indexOf(activeSlot) : -1;
  const activeSlotLabel = activeSlotIndex >= 0 ? activeSlotIndex + 1 : '―';

  const followIdsSet = useMemo(() => new Set(followedChannels.map((channel) => channel.channelId)), [followedChannels]);

  const handleFollowSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmedId = channelIdInput.trim();
    if (!trimmedId) return;
    addFollowedChannel({
      platform: 'youtube',
      channelId: trimmedId,
      label: channelLabelInput.trim() || undefined
    });
    setChannelIdInput('');
    setChannelLabelInput('');
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    executeSearch(searchQuery);
  };

  return (
    <aside className={styles.sidebar}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>フォロー設定</h2>
          <button
            type="button"
            className={styles.searchToggle}
            onClick={() => setShowSearch((prev) => !prev)}
          >
            <MagnifyingGlassIcon />
            {showSearch ? '閉じる' : 'チャンネル検索'}
          </button>
        </div>
        {showSearch ? (
          <div className={styles.searchPanel}>
            <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
              <input
                type="search"
                placeholder="チャンネル名で検索"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <button type="submit" disabled={!searchQuery.trim()}>
                <MagnifyingGlassIcon />
                検索
              </button>
            </form>
            <div className={styles.searchResults}>
              {searchLoading ? (
                <div className={styles.searchMessage}>検索中…</div>
              ) : searchError ? (
                <div className={clsx(styles.searchMessage, styles.searchMessageError)}>{searchError}</div>
              ) : searchResults.length === 0 ? (
                <div className={styles.searchMessage}>検索結果がありません。</div>
              ) : (
                searchResults.map((channel) => {
                  const alreadyFollowed = followIdsSet.has(channel.id);
                  return (
                    <div key={channel.id} className={styles.searchResultItem}>
                      <div className={styles.searchResultMeta}>
                        {channel.thumbnailUrl && (
                          <img src={channel.thumbnailUrl} alt={channel.title} loading="lazy" />
                        )}
                        <div>
                          <p className={styles.searchResultTitle}>{channel.title}</p>
                          {channel.customUrl && <p className={styles.searchResultUrl}>@{channel.customUrl}</p>}
                          <p className={styles.searchResultDescription}>{channel.description}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          addFollowedChannel({
                            platform: 'youtube',
                            channelId: channel.id,
                            label: channel.title
                          })
                        }
                        disabled={alreadyFollowed}
                      >
                        {alreadyFollowed ? 'フォロー済み' : 'フォローに追加'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <>
            <form className={styles.followForm} onSubmit={handleFollowSubmit}>
              <input
                type="text"
                placeholder="チャンネルID (例: UC...)"
                value={channelIdInput}
                onChange={(event) => setChannelIdInput(event.target.value)}
              />
              <input
                type="text"
                placeholder="任意のメモ"
                value={channelLabelInput}
                onChange={(event) => setChannelLabelInput(event.target.value)}
              />
              <button type="submit" disabled={!channelIdInput.trim()}>
                <PlusIcon />
                追加
              </button>
            </form>
            {followedChannels.length > 0 ? (
              <ul className={styles.followList}>
                {followedChannels.map((channel) => (
                  <li key={channel.channelId}>
                    <div>
                      <span className={styles.followId}>{channel.channelId}</span>
                      {channel.label && <span className={styles.followLabel}>{channel.label}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeFollowedChannel(channel.channelId);
                      }}
                      title="フォロー削除"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.followHint}>チャンネルIDを追加すると、その配信のみが表示されます。</div>
            )}
          </>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>視聴枠</h2>
          <button className={styles.sectionAction} type="button" onClick={onOpenPresetModal}>
            <SquaresPlusIcon />
            <span>プリセット</span>
          </button>
        </div>
        <div className={styles.slotList}>
          {activeSlots.map((slot, index) => {
            const isActive = selectedSlotId === slot.id;
            const assigned = slot.assignedStream;
            const volumeLabel = `${slot.volume}%`;

            const handleSelect = (): void => {
              selectSlot(slot.id);
              ensureSelection();
            };

            const handleVolumeChange = (value: number): void => {
              setVolume(slot.id, value);
              if (slot.muted && value > 0) {
                toggleSlotMute(slot.id);
              }
            };

            return (
              <div
                key={slot.id}
                role="button"
                tabIndex={0}
                className={clsx(styles.slotButton, isActive && styles.slotButtonActive)}
                onClick={handleSelect}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelect();
                  }
                }}
              >
                <div className={styles.slotHeader}>
                  <div className={styles.slotIndex}>枠 {index + 1}</div>
                  {assigned && (
                    <button
                      type="button"
                      className={styles.slotRemove}
                      onClick={(event) => {
                        event.stopPropagation();
                        clearSlot(slot.id);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className={styles.slotContent}>
                  {assigned ? (
                    <>
                      <span
                        className={styles.streamerName}
                        style={{ color: platformAccent[assigned.platform] }}
                      >
                        {assigned.displayName}
                      </span>
                      <span className={styles.streamTitle}>{assigned.title}</span>
                    </>
                  ) : (
                    <span className={styles.slotEmpty}>未割り当て</span>
                  )}
                </div>
                {assigned ? (
                  <div
                    className={styles.slotControls}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={styles.muteButton}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSlotMute(slot.id);
                      }}
                      aria-pressed={slot.muted}
                    >
                      {slot.muted ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
                    </button>
                    <label className={styles.volumeSlider}>
                      <span className="sr-only">音量</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={slot.volume}
                        onChange={(event) => handleVolumeChange(Number(event.target.value))}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                      />
                    </label>
                    <span className={styles.volumeValue}>{volumeLabel}</span>
                  </div>
                ) : (
                  <div className={styles.slotHint}>配信を割り当てて操作できます</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>フォロー中の配信</h2>
          <span className={styles.sectionHint}>選択中の枠: 枠 {activeSlotLabel}</span>
        </div>
        <div className={styles.streamList}>
          {streamsLoading ? (
            <div className={styles.streamListMessage}>配信情報を取得しています…</div>
          ) : streamsError ? (
            <div className={clsx(styles.streamListMessage, styles.streamListMessageError)}>
              配信情報の取得に失敗しました：{streamsError}
            </div>
          ) : availableStreams.length === 0 ? (
            <div className={styles.streamListMessage}>
              現在表示できる配信が見つかりません。キーワード検索結果が表示されます。
            </div>
          ) : (
            availableStreams.map((stream) => (
              <div key={stream.id} className={styles.streamListItem}>
                <div className={styles.streamHeader}>
                  <span className={styles.streamerLabel}>{stream.displayName}</span>
                  <span
                    className={styles.platformTag}
                    style={{ color: platformAccent[stream.platform] }}
                  >
                    {platformLabel[stream.platform]}
                  </span>
                </div>
                <p className={styles.streamTitle}>{stream.title}</p>
                <div className={styles.streamMeta}>
                  <span>{formatMeta(stream)}</span>
                  <span>{formatViewerCount(stream.viewerCount)}</span>
                </div>
                {activeSlot ? (
                  <button
                    type="button"
                    className={styles.assignButton}
                    onClick={() => {
                      assignStream(activeSlot.id, stream);
                      if (!selectedSlotId) {
                        ensureSelection();
                      }
                    }}
                  >
                    この枠に割り当て
                  </button>
                ) : (
                  <div className={styles.assignDisabled}>枠がありません</div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>連携プラットフォーム</h2>
        </div>
        <ul className={styles.accountList}>
          <li>
            <span className={styles.accountPlatform}>YouTube</span>
            <button type="button">連携予定</button>
          </li>
          <li>
            <span className={styles.accountPlatform}>Twitch</span>
            <button type="button">連携予定</button>
          </li>
          <li>
            <span className={styles.accountPlatform}>ニコニコ</span>
            <button type="button">連携予定</button>
          </li>
        </ul>
      </section>
    </aside>
  );
};
