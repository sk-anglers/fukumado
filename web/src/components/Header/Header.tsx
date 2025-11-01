import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MagnifyingGlassIcon,
  Squares2X2Icon,
  SpeakerXMarkIcon,
  SpeakerWaveIcon,
  UserCircleIcon,
  PlusIcon,
  TrashIcon,
  StarIcon,
  BellAlertIcon,
  Bars3Icon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { MAX_ACTIVE_SLOTS, useLayoutStore } from '../../stores/layoutStore';
import { useUserStore } from '../../stores/userStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useMobileMenuStore } from '../../stores/mobileMenuStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAnalytics } from '../../hooks/useAnalytics';
import { apiFetch } from '../../utils/api';
import type { ChannelSearchResult, LayoutPreset } from '../../types';
import { config } from '../../config';
import { AccountMenu } from './AccountMenu';
import { NotificationMenu } from './NotificationMenu';
import styles from './Header.module.css';

const presetLabels: Record<LayoutPreset, string> = {
  twoByTwo: '2×2',
  oneByTwo: '1×2 + サブ',
  focus: 'フォーカス'
};

interface HeaderProps {
  onOpenPresetModal: () => void;
}

interface YouTubeChannelResult {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  customUrl?: string;
}

interface TwitchChannelResult {
  id: string;
  login: string;
  displayName: string;
  description: string;
  thumbnailUrl: string;
}

export const Header = ({ onOpenPresetModal }: HeaderProps): JSX.Element => {
  const { trackButton } = useAnalytics();

  const mutedAll = useLayoutStore((state) => state.mutedAll);
  const toggleMuteAll = useLayoutStore((state) => state.toggleMuteAll);
  const masterVolume = useLayoutStore((state) => state.masterVolume);
  const setMasterVolume = useLayoutStore((state) => state.setMasterVolume);
  const slots = useLayoutStore((state) => state.slots);
  const activeSlotsCount = useLayoutStore((state) => state.activeSlotsCount);
  const setVolume = useLayoutStore((state) => state.setVolume);
  const toggleSlotMute = useLayoutStore((state) => state.toggleSlotMute);
  const searchQuery = useLayoutStore((state) => state.searchQuery);
  const setSearchQuery = useLayoutStore((state) => state.setSearchQuery);
  const channelSearchResults = useLayoutStore((state) => state.channelSearchResults);
  const channelSearchLoading = useLayoutStore((state) => state.channelSearchLoading);
  const channelSearchError = useLayoutStore((state) => state.channelSearchError);
  const setChannelSearchResults = useLayoutStore((state) => state.setChannelSearchResults);
  const setChannelSearchLoading = useLayoutStore((state) => state.setChannelSearchLoading);
  const setChannelSearchError = useLayoutStore((state) => state.setChannelSearchError);
  const clearChannelSearch = useLayoutStore((state) => state.clearChannelSearch);
  const setActiveSlotsCount = useLayoutStore((state) => state.setActiveSlotsCount);
  const preset = useLayoutStore((state) => state.preset);
  const setPreset = useLayoutStore((state) => state.setPreset);
  const fullscreen = useLayoutStore((state) => state.fullscreen);
  const setFullscreen = useLayoutStore((state) => state.setFullscreen);
  const getMaxSlots = useLayoutStore((state) => state.getMaxSlots);

  const { followedChannels, addFollowedChannel, removeFollowedChannel } = useUserStore((state) => ({
    followedChannels: state.followedChannels,
    addFollowedChannel: state.addFollowedChannel,
    removeFollowedChannel: state.removeFollowedChannel
  }));

  const availableStreams = useLayoutStore((state) => state.availableStreams);

  const isMobile = useIsMobile();
  const { sidebarOpen, chatOpen, toggleSidebar, toggleChat } = useMobileMenuStore();

  // 配信中のチャンネルIDのSetを作成
  const liveChannelIds = useMemo(() => {
    return new Set(availableStreams.map(stream => stream.channelId));
  }, [availableStreams]);

  // 有効なプラットフォームのフォローチャンネル数を計算
  const activeFollowedChannelsCount = useMemo(() => {
    return followedChannels.filter((ch) => {
      if (ch.platform === 'youtube' && !config.enableYoutube) return false;
      if (ch.platform === 'niconico' && !config.enableNiconico) return false;
      return true;
    }).length;
  }, [followedChannels]);

  const unreadCount = useNotificationStore((state) => state.getUnreadCount());

  // 音量レベルに応じた色を計算
  const getAudioLevelColor = (level: number): string => {
    if (level <= 60) {
      return 'rgba(34, 197, 94, 0.9)'; // 緑
    } else if (level <= 80) {
      return 'rgba(251, 191, 36, 0.9)'; // 黄
    } else {
      return 'rgba(239, 68, 68, 0.9)'; // 赤
    }
  };

  // はみ出し部分の色を計算（スライダー位置を100%とした割合ベース）
  const getOverflowColor = (ratio: number): string => {
    if (ratio <= 160) {
      return 'rgba(34, 197, 94, 0.9)'; // 緑（100-160%）
    } else if (ratio <= 180) {
      return 'rgba(251, 191, 36, 0.9)'; // 黄（160-180%）
    } else {
      return 'rgba(239, 68, 68, 0.9)'; // 赤（180%以上）
    }
  };

  const [showDropdown, setShowDropdown] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showFollowListMenu, setShowFollowListMenu] = useState(false);
  const [showVolumeMenu, setShowVolumeMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>({});
  const [maxSlots, setMaxSlots] = useState(getMaxSlots());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const followListMenuRef = useRef<HTMLDivElement>(null);
  const volumeMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  const handleEnterFullscreen = async (): Promise<void> => {
    try {
      const element = document.querySelector('main');
      if (!element) return;
      await element.requestFullscreen();
      setFullscreen(true);
      // フルスクリーン開始をトラッキング
      trackButton('fullscreen', 'header');
    } catch (error) {
      console.error('Failed to enter fullscreen', error);
    }
  };

  const handleExitFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setFullscreen(false);
      // フルスクリーン終了をトラッキング
      trackButton('fullscreen', 'header');
    } catch (error) {
      console.error('Failed to exit fullscreen', error);
    }
  };

  const handleSearch = async (): Promise<void> => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      clearChannelSearch();
      setShowDropdown(false);
      return;
    }

    setShowDropdown(true);
    setChannelSearchLoading(true);
    setChannelSearchError(undefined);

    try {
      console.log('[検索開始] キーワード:', trimmed);

      const promises: Promise<Response>[] = [];

      // YouTube APIは有効な場合のみ呼び出す
      if (config.enableYoutube) {
        promises.push(apiFetch(`/api/youtube/channels?q=${encodeURIComponent(trimmed)}`));
      }

      promises.push(apiFetch(`/api/twitch/channels?q=${encodeURIComponent(trimmed)}`));

      const responses = await Promise.allSettled(promises);

      // レスポンスの割り当て（YouTube無効時はTwitchのみ）
      const youtubeResponse = config.enableYoutube ? responses[0] : null;
      const twitchResponse = config.enableYoutube ? responses[1] : responses[0];

      console.log('[YouTube レスポンス]', youtubeResponse);
      console.log('[Twitch レスポンス]', twitchResponse);

      const allResults: ChannelSearchResult[] = [];

      if (youtubeResponse && youtubeResponse.status === 'fulfilled' && youtubeResponse.value.ok) {
        const youtubeData = await youtubeResponse.value.json();
        console.log('[YouTube データ]', youtubeData);
        if (Array.isArray(youtubeData.items)) {
          const youtubeResults = youtubeData.items.map((item: YouTubeChannelResult) => ({
            id: item.id,
            platform: 'youtube' as const,
            title: item.title,
            description: item.description,
            thumbnailUrl: item.thumbnailUrl,
            customUrl: item.customUrl
          }));
          console.log('[YouTube 結果数]', youtubeResults.length);
          allResults.push(...youtubeResults);
        }
      } else if (youtubeResponse && youtubeResponse.status === 'fulfilled') {
        console.error('[YouTube エラー] ステータスコード:', youtubeResponse.value.status);
        const errorText = await youtubeResponse.value.text();
        console.error('[YouTube エラー内容]', errorText);
      } else if (youtubeResponse && youtubeResponse.status === 'rejected') {
        console.error('[YouTube 失敗]', youtubeResponse.reason);
      }

      if (twitchResponse.status === 'fulfilled' && twitchResponse.value.ok) {
        const twitchData = await twitchResponse.value.json();
        console.log('[Twitch データ]', twitchData);
        if (Array.isArray(twitchData.items)) {
          const twitchResults = twitchData.items.map((item: TwitchChannelResult) => ({
            id: item.id,
            platform: 'twitch' as const,
            title: item.displayName,
            description: item.description,
            thumbnailUrl: item.thumbnailUrl,
            login: item.login
          }));
          console.log('[Twitch 結果数]', twitchResults.length);
          allResults.push(...twitchResults);
        }
      } else if (twitchResponse.status === 'fulfilled') {
        console.error('[Twitch エラー] ステータスコード:', twitchResponse.value.status);
        const errorText = await twitchResponse.value.text();
        console.error('[Twitch エラー内容]', errorText);
      } else if (twitchResponse.status === 'rejected') {
        console.error('[Twitch 失敗]', twitchResponse.reason);
      }

      console.log('[最終結果数]', allResults.length);
      setChannelSearchResults(allResults);
      if (allResults.length === 0) {
        setChannelSearchError('検索結果が見つかりませんでした。');
      }
    } catch (err) {
      console.error('[検索エラー]', err);
      const message = err instanceof Error ? err.message : '検索に失敗しました';
      setChannelSearchError(message);
      setChannelSearchResults([]);
    } finally {
      setChannelSearchLoading(false);
    }
  };

  // 画面向きの変更を監視してスロット数を調整
  useEffect(() => {
    const handleOrientationChange = () => {
      const newMaxSlots = getMaxSlots();
      setMaxSlots(newMaxSlots);

      // 現在のスロット数が新しい最大値を超えている場合、自動調整
      if (activeSlotsCount > newMaxSlots) {
        setActiveSlotsCount(newMaxSlots);
      }
    };

    // 画面向きの変更を監視
    const orientationQuery = window.matchMedia('(orientation: portrait)');
    orientationQuery.addEventListener('change', handleOrientationChange);

    return () => {
      orientationQuery.removeEventListener('change', handleOrientationChange);
    };
  }, [getMaxSlots, activeSlotsCount, setActiveSlotsCount]);

  // 音量レベルのアニメーション（疑似的な音量メーター）
  useEffect(() => {
    if (!showVolumeMenu) return;

    const updateAudioLevels = () => {
      const newLevels: Record<string, number> = {};

      slots.slice(0, activeSlotsCount).forEach((slot) => {
        if (slot.assignedStream && !slot.muted) {
          // 疑似的な音量レベルを生成（20-85%の範囲でランダムに変動）
          const baseLevel = audioLevels[slot.id] || 50;
          const variation = (Math.random() - 0.5) * 30;
          const newLevel = Math.max(20, Math.min(85, baseLevel + variation));
          newLevels[slot.id] = newLevel;
        } else {
          newLevels[slot.id] = 0;
        }
      });

      setAudioLevels(newLevels);
    };

    // 初回実行
    updateAudioLevels();

    // 100msごとに更新して滑らかなアニメーションを実現
    const interval = setInterval(updateAudioLevels, 100);

    return () => clearInterval(interval);
  }, [showVolumeMenu, slots, activeSlotsCount]);

  // ドロップダウンの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(event.target as Node)) {
        setShowLayoutMenu(false);
      }
      if (followListMenuRef.current && !followListMenuRef.current.contains(event.target as Node)) {
        setShowFollowListMenu(false);
      }
      if (volumeMenuRef.current && !volumeMenuRef.current.contains(event.target as Node)) {
        setShowVolumeMenu(false);
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setShowNotificationMenu(false);
      }
    };

    if (showDropdown || showAccountMenu || showLayoutMenu || showFollowListMenu || showVolumeMenu || showNotificationMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, showAccountMenu, showLayoutMenu, showFollowListMenu, showVolumeMenu, showNotificationMenu]);

  return (
    <header className={styles.header}>
      {isMobile && (
        <div className={styles.mobileMenuButtons}>
          <button
            type="button"
            className={clsx(styles.mobileMenuButton, sidebarOpen && styles.mobileMenuButtonActive)}
            onClick={toggleSidebar}
            title="サイドバー"
          >
            <Bars3Icon />
          </button>
          <button
            type="button"
            className={clsx(styles.mobileMenuButton, chatOpen && styles.mobileMenuButtonActive)}
            onClick={toggleChat}
            title="チャット"
          >
            <ChatBubbleLeftRightIcon />
          </button>
          <button
            type="button"
            className={clsx(styles.mobileMenuButton, !mutedAll && styles.mobileMenuButtonActive)}
            onClick={() => {
              toggleMuteAll();
              trackButton('mute_all', 'header_mobile');
            }}
            title={mutedAll ? '一括ミュート解除' : '一括ミュート'}
          >
            {mutedAll ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
          </button>
        </div>
      )}
      <div className={styles.brand}>
        <div className={styles.logo}>ふ</div>
        <div className={styles.meta}>
          <h1 className={styles.title}>ふくまど！</h1>
          <span className={styles.subtitle}>お気に入りの配信を一度にチェック</span>
        </div>
      </div>
      <div className={styles.actions}>
        <div className={styles.searchGroup} ref={dropdownRef}>
          <label className={styles.search}>
            <MagnifyingGlassIcon className={styles.searchIcon} />
            <input
              type="search"
              placeholder="配信者・タイトル・チャンネルを検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
          </label>
          <button
            type="button"
            className={styles.searchButton}
            onClick={handleSearch}
            title="検索"
          >
            <MagnifyingGlassIcon />
            <span>検索</span>
          </button>

          {showDropdown && (
            <div className={styles.searchDropdown}>
              {channelSearchLoading ? (
                <div className={styles.dropdownMessage}>検索中…</div>
              ) : channelSearchError ? (
                <div className={styles.dropdownError}>{channelSearchError}</div>
              ) : channelSearchResults.length > 0 ? (
                <div className={styles.dropdownResults}>
                  {channelSearchResults
                    .filter((channel) => {
                      // プラットフォームが無効な場合は除外
                      if (channel.platform === 'youtube' && !config.enableYoutube) return false;
                      // niconicoはChannelSearchResultでサポートされていないため、チェック不要
                      return true;
                    })
                    .map((channel) => {
                    const alreadyFollowed = followedChannels.some((ch) => ch.channelId === channel.id);
                    return (
                      <div key={`${channel.platform}-${channel.id}`} className={styles.dropdownItem}>
                        <div className={styles.dropdownItemContent}>
                          {channel.thumbnailUrl && (
                            <img
                              src={channel.thumbnailUrl}
                              alt={channel.title}
                              className={styles.dropdownThumbnail}
                              loading="lazy"
                            />
                          )}
                          <div className={styles.dropdownInfo}>
                            <div className={styles.dropdownHeader}>
                              <p className={styles.dropdownTitle}>{channel.title}</p>
                              <span
                                className={styles.dropdownBadge}
                                style={{ color: channel.platform === 'youtube' ? '#ef4444' : '#a855f7' }}
                              >
                                {channel.platform === 'youtube' ? 'YouTube' : 'Twitch'}
                              </span>
                            </div>
                            {(channel.customUrl || channel.login) && (
                              <p className={styles.dropdownUrl}>
                                @{channel.customUrl || channel.login}
                              </p>
                            )}
                            {channel.description && (
                              <p className={styles.dropdownDescription}>{channel.description}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            addFollowedChannel({
                              platform: channel.platform,
                              channelId: channel.id,
                              label: channel.title
                            });
                          }}
                          disabled={alreadyFollowed}
                          className={styles.dropdownButton}
                        >
                          <PlusIcon />
                          <span>{alreadyFollowed ? 'フォロー済み' : 'フォロー'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>
        {!fullscreen && (
          <button
            className={styles.fullscreenButton}
            type="button"
            onClick={handleEnterFullscreen}
            title="分割レイアウトを全画面表示"
          >
            分割レイアウトを全画面表示
          </button>
        )}
        <div className={styles.menuGroup} ref={volumeMenuRef}>
          <button
            className={styles.controlButton}
            type="button"
            onClick={() => setShowVolumeMenu(!showVolumeMenu)}
          >
            {mutedAll ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
            <span>音量</span>
          </button>
          {showVolumeMenu && (
            <div className={styles.volumeMenu}>
              <div className={styles.slotMenuTitle}>音量コントロール</div>

              {/* マスター音量 */}
              <div className={styles.volumeSection}>
                <div className={styles.volumeSectionHeader}>
                  <span className={styles.volumeLabel}>マスター音量</span>
                  <span className={styles.volumeValue}>{masterVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={masterVolume}
                  onChange={(e) => setMasterVolume(Number(e.target.value))}
                  onMouseUp={() => {
                    // マスター音量変更をトラッキング
                    trackButton('mute_all', 'header');
                  }}
                  className={styles.volumeSlider}
                />
              </div>

              {/* 全体ミュート */}
              <button
                type="button"
                className={styles.volumeMuteAllButton}
                onClick={() => {
                  toggleMuteAll();
                  // 全体ミュートをトラッキング
                  trackButton('mute_all', 'header');
                }}
              >
                {mutedAll ? <SpeakerWaveIcon /> : <SpeakerXMarkIcon />}
                <span>{mutedAll ? '全体ミュート解除' : '全体ミュート'}</span>
              </button>

              <div className={styles.volumeDivider} />

              {/* 各視聴枠の音量 */}
              <div className={styles.volumeSectionHeader}>
                <span className={styles.volumeLabel}>視聴枠別</span>
              </div>
              <div className={styles.volumeSlotList}>
                {slots.slice(0, activeSlotsCount).map((slot, index) => (
                  <div key={slot.id} className={styles.volumeSlotItem}>
                    <div className={styles.volumeSlotHeader}>
                      <span className={styles.volumeSlotLabel}>
                        枠 {index + 1}
                        {slot.assignedStream && ` - ${slot.assignedStream.displayName}`}
                      </span>
                      <button
                        type="button"
                        className={clsx(styles.volumeSlotMute, slot.muted && styles.volumeSlotMuteMuted)}
                        onClick={() => toggleSlotMute(slot.id)}
                        title={slot.muted ? 'ミュート解除' : 'ミュート'}
                      >
                        {slot.muted ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
                      </button>
                    </div>
                    <div className={styles.volumeSlotControl}>
                      <div className={styles.volumeSliderWrapper}>
                        {!slot.muted && (() => {
                          const actualLevel = audioLevels[slot.id] || 0;
                          const sliderPos = slot.volume;
                          const ratio = sliderPos > 0 ? (actualLevel / sliderPos) * 100 : 0;

                          // バーの幅（実際の音量レベル、100%超えも許可）
                          const barWidth = actualLevel;

                          // グラデーションの色位置を計算（スライダー位置を基準とした割合）
                          let gradient = '';
                          let boxShadowColor = '';

                          if (ratio <= 60) {
                            // 0-60%: 緑のみ
                            gradient = 'rgba(34, 197, 94, 0.9)';
                            boxShadowColor = 'rgba(34, 197, 94, 0.9)';
                          } else if (ratio <= 80) {
                            // 60-80%: 緑から黄へグラデーション
                            const greenEnd = (60 / ratio) * 100;
                            gradient = `linear-gradient(to right, rgba(34, 197, 94, 0.9) 0%, rgba(34, 197, 94, 0.9) ${greenEnd}%, rgba(251, 191, 36, 0.9) 100%)`;
                            boxShadowColor = 'rgba(251, 191, 36, 0.9)';
                          } else {
                            // 80%以上: 緑→黄→赤へグラデーション
                            const greenEnd = (60 / ratio) * 100;
                            const yellowEnd = (80 / ratio) * 100;
                            gradient = `linear-gradient(to right, rgba(34, 197, 94, 0.9) 0%, rgba(34, 197, 94, 0.9) ${greenEnd}%, rgba(251, 191, 36, 0.9) ${greenEnd}%, rgba(251, 191, 36, 0.9) ${yellowEnd}%, rgba(239, 68, 68, 0.9) 100%)`;
                            boxShadowColor = 'rgba(239, 68, 68, 0.9)';
                          }

                          return (
                            <div
                              className={styles.volumeLevelBar}
                              style={{
                                width: `${Math.min(barWidth, 100)}%`,
                                background: gradient,
                                boxShadow: `0 0 8px ${boxShadowColor}`
                              }}
                            />
                          );
                        })()}

                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={slot.volume}
                          onChange={(e) => {
                            const nextVolume = Number(e.target.value);
                            setVolume(slot.id, nextVolume);
                            if (slot.muted && nextVolume > 0) {
                              toggleSlotMute(slot.id);
                            }
                          }}
                          className={styles.volumeSlider}
                          disabled={slot.muted}
                        />
                      </div>
                      <span className={styles.volumeValue}>{slot.volume}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className={styles.menuGroup} ref={layoutMenuRef}>
          <button
            className={styles.controlButton}
            type="button"
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
          >
            <Squares2X2Icon />
            <span>レイアウト ({activeSlotsCount}画面)</span>
          </button>
          {showLayoutMenu && (
            <div className={styles.layoutMenu}>
              <div className={styles.slotMenuTitle}>視聴枠数</div>
              <div className={styles.slotMenuButtons}>
                {Array.from({ length: maxSlots }, (_, i) => maxSlots - i).map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={clsx(
                      styles.slotMenuButton,
                      activeSlotsCount === count && styles.slotMenuButtonActive
                    )}
                    onClick={() => {
                      setActiveSlotsCount(count);
                    }}
                  >
                    {count}画面
                  </button>
                ))}
              </div>
              <div className={styles.layoutMenuDivider} />
              <div className={styles.slotMenuTitle}>プリセット</div>
              <div className={styles.layoutMenuButtons}>
                {(Object.keys(presetLabels) as LayoutPreset[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={clsx(
                      styles.layoutMenuButton,
                      preset === key && styles.layoutMenuButtonActive
                    )}
                    onClick={() => {
                      // 同じプリセットがクリックされた場合は2×2に戻す、それ以外はそのプリセットに設定
                      setPreset(preset === key ? 'twoByTwo' : key);
                    }}
                  >
                    {presetLabels[key]}
                  </button>
                ))}
              </div>
              <div className={styles.layoutMenuDivider} />
              <button
                type="button"
                className={styles.layoutMenuAction}
                onClick={() => {
                  setShowLayoutMenu(false);
                  onOpenPresetModal();
                }}
              >
                プリセットを編集
              </button>
            </div>
          )}
        </div>
        <div className={styles.menuGroup} ref={followListMenuRef}>
          <button
            className={styles.controlButton}
            type="button"
            onClick={() => setShowFollowListMenu(!showFollowListMenu)}
          >
            <StarIcon />
            <span>フォロー ({activeFollowedChannelsCount})</span>
          </button>
          {showFollowListMenu && (
            <div className={styles.followListMenu}>
              <div className={styles.slotMenuTitle}>フォロー中のチャンネル</div>
              {followedChannels.length === 0 ? (
                <div className={styles.followListEmpty}>
                  フォロー中のチャンネルはありません
                </div>
              ) : (
                <>
                  {(() => {
                    const youtubeChannels = config.enableYoutube
                      ? followedChannels.filter((ch) => ch.platform === 'youtube')
                      : [];
                    const twitchChannels = followedChannels.filter((ch) => ch.platform === 'twitch');

                    return (
                      <>
                        {config.enableYoutube && youtubeChannels.length > 0 && (
                          <div>
                            <div className={styles.followListPlatform} style={{ color: '#ef4444' }}>
                              YouTube ({youtubeChannels.length})
                            </div>
                            <ul className={styles.followList}>
                              {youtubeChannels.map((channel) => (
                                <li key={channel.channelId} className={styles.followListItem}>
                                  <span className={styles.followListLabel}>
                                    {channel.label ?? channel.channelId}
                                    {liveChannelIds.has(channel.channelId) && (
                                      <span className={styles.liveBadge}>配信中</span>
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.followListDelete}
                                    onClick={() => removeFollowedChannel(channel.channelId)}
                                    title="フォロー削除"
                                  >
                                    <TrashIcon />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {twitchChannels.length > 0 && (
                          <div style={{ marginTop: youtubeChannels.length > 0 ? '0.75rem' : '0' }}>
                            <div className={styles.followListPlatform} style={{ color: '#a855f7' }}>
                              Twitch ({twitchChannels.length})
                            </div>
                            <ul className={styles.followList}>
                              {twitchChannels.map((channel) => (
                                <li key={channel.channelId} className={styles.followListItem}>
                                  <span className={styles.followListLabel}>
                                    {channel.label ?? channel.channelId}
                                    {liveChannelIds.has(channel.channelId) && (
                                      <span className={styles.liveBadge}>配信中</span>
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.followListDelete}
                                    onClick={() => removeFollowedChannel(channel.channelId)}
                                    title="フォロー削除"
                                  >
                                    <TrashIcon />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>
        <div className={styles.menuGroup} ref={notificationMenuRef}>
          <button
            className={styles.controlButton}
            type="button"
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
          >
            <BellAlertIcon />
            <span>通知</span>
            {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
          </button>
          {showNotificationMenu && <NotificationMenu onClose={() => setShowNotificationMenu(false)} />}
        </div>
        <div className={styles.menuGroup} ref={accountMenuRef}>
          <button
            className={styles.accountButton}
            type="button"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
          >
            <UserCircleIcon />
            <span>アカウント</span>
          </button>
          {showAccountMenu && <AccountMenu onClose={() => setShowAccountMenu(false)} />}
        </div>
      </div>
    </header>
  );
};
