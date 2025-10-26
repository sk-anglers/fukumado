import { useState, useEffect } from 'react';
import { AdjustmentsHorizontalIcon, CircleStackIcon, ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useSyncStore, SYNC_INTERVAL_OPTIONS } from '../../stores/syncStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useDataUsageStore } from '../../stores/dataUsageStore';
import { apiFetch, apiUrl } from '../../utils/api';
import { config } from '../../config';
import type { VideoQuality, QualityBandwidth } from '../../types';
import type { TwitchPlayer } from '../../hooks/useTwitchEmbed';
import styles from './AccountMenu.module.css';

// 画質別の推定帯域幅（Mbps）
const QUALITY_BANDWIDTH_MAP: QualityBandwidth[] = [
  { quality: 'auto', label: '自動', mbps: 0 },
  { quality: '1080p', label: '1080p（高画質）', mbps: 5.0 },
  { quality: '720p', label: '720p（標準）', mbps: 2.5 },
  { quality: '480p', label: '480p（低画質）', mbps: 1.2 },
  { quality: '360p', label: '360p（最低画質）', mbps: 0.7 }
];

const getBandwidthForQuality = (quality: VideoQuality): number => {
  return QUALITY_BANDWIDTH_MAP.find((q) => q.quality === quality)?.mbps ?? 0;
};

// 秒をHH:MM:SS形式に変換
const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// データ使用量を読みやすい形式に変換
const formatDataUsage = (mb: number, gb: number): string => {
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
};

// セッション時間を読みやすい形式に変換
const formatSessionDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  }
  return `${minutes}分`;
};

interface SyncStatus {
  slotId: string;
  displayName: string;
  currentTime: number;
  timeDiff: number;
};

interface AccountMenuProps {
  onClose: () => void;
}

interface ChannelResult {
  id: string;
  title?: string;
  displayName?: string;
}

export const AccountMenu = ({ onClose }: AccountMenuProps): JSX.Element => {
  const authenticated = useAuthStore((state) => state.authenticated);
  const authUser = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const setAuthStatus = useAuthStore((state) => state.setStatus);
  const setAuthLoading = useAuthStore((state) => state.setLoading);
  const setAuthError = useAuthStore((state) => state.setError);

  const twitchAuthenticated = useAuthStore((state) => state.twitchAuthenticated);
  const twitchUser = useAuthStore((state) => state.twitchUser);
  const twitchLoading = useAuthStore((state) => state.twitchLoading);
  const setTwitchStatus = useAuthStore((state) => state.setTwitchStatus);
  const setTwitchLoading = useAuthStore((state) => state.setTwitchLoading);
  const setTwitchError = useAuthStore((state) => state.setTwitchError);

  const addFollowedChannels = useUserStore((state) => state.addFollowedChannels);
  const setCurrentTwitchUser = useUserStore((state) => state.setCurrentTwitchUser);
  const setCurrentYoutubeUser = useUserStore((state) => state.setCurrentYoutubeUser);

  const syncSettings = useSyncStore((state) => state.settings);
  const syncing = useSyncStore((state) => state.syncing);
  const lastSyncTime = useSyncStore((state) => state.lastSyncTime);
  const updateSettings = useSyncStore((state) => state.updateSettings);
  const triggerManualSync = useSyncStore((state) => state.triggerManualSync);
  const canManualSync = useSyncStore((state) => state.canManualSync);
  const getRemainingCooldown = useSyncStore((state) => state.getRemainingCooldown);
  const recordFollowChannelSync = useSyncStore((state) => state.recordFollowChannelSync);
  const canFollowChannelSync = useSyncStore((state) => state.canFollowChannelSync);
  const getFollowChannelRemainingCooldown = useSyncStore((state) => state.getFollowChannelRemainingCooldown);

  const slots = useLayoutStore((state) => state.slots);
  const activeSlotsCount = useLayoutStore((state) => state.activeSlotsCount);
  const autoQualityEnabled = useLayoutStore((state) => state.autoQualityEnabled);
  const setSlotQuality = useLayoutStore((state) => state.setSlotQuality);
  const setAutoQualityEnabled = useLayoutStore((state) => state.setAutoQualityEnabled);
  const masterSlotId = useLayoutStore((state) => state.masterSlotId);

  const totalBytes = useDataUsageStore((state) => state.totalBytes);
  const sessionStartTime = useDataUsageStore((state) => state.sessionStartTime);
  const resetDataUsage = useDataUsageStore((state) => state.reset);

  // データ使用量を計算
  const getTotalMB = () => totalBytes / (1024 * 1024);
  const getTotalGB = () => totalBytes / (1024 * 1024 * 1024);
  const getSessionDuration = () => Math.floor((Date.now() - sessionStartTime) / 1000);

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);

  const [twitchSyncMessage, setTwitchSyncMessage] = useState<string | null>(null);
  const [twitchSyncError, setTwitchSyncError] = useState<string | null>(null);
  const [twitchSyncLoading, setTwitchSyncLoading] = useState(false);

  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [followChannelCooldownRemaining, setFollowChannelCooldownRemaining] = useState(0);

  // データ使用量とセッション時間の表示を1秒ごとに更新
  const [, setUpdateTrigger] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // クールダウンカウントダウンの更新
  useEffect(() => {
    const updateCooldown = () => {
      const remaining = getRemainingCooldown();
      setCooldownRemaining(remaining);
    };

    // 初回実行
    updateCooldown();

    // 1秒ごとに更新
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [getRemainingCooldown]);

  // フォローチャンネル同期のクールダウンカウントダウンの更新
  useEffect(() => {
    const updateCooldown = () => {
      const remaining = getFollowChannelRemainingCooldown();
      setFollowChannelCooldownRemaining(remaining);
    };

    // 初回実行
    updateCooldown();

    // 1秒ごとに更新
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [getFollowChannelRemainingCooldown]);

  // 最終同期時刻を相対表示に変換
  const getLastSyncText = (): string => {
    if (!lastSyncTime) return '未同期';
    const now = Date.now();
    const diff = now - lastSyncTime;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}秒前`;
    if (minutes < 60) return `${minutes}分前`;
    return `${hours}時間前`;
  };

  // 合計帯域幅を計算
  const getTotalBandwidth = (): number => {
    return slots
      .slice(0, activeSlotsCount)
      .filter((slot) => slot.assignedStream)
      .reduce((total, slot) => total + getBandwidthForQuality(slot.quality), 0);
  };

  const refreshAuthStatus = async (): Promise<void> => {
    setAuthLoading(true);
    setAuthError(undefined);
    try {
      const response = await apiFetch('/auth/status');
      if (!response.ok) {
        throw new Error(`ステータス取得に失敗しました (${response.status})`);
      }
      const data = await response.json();
      setAuthStatus({ authenticated: Boolean(data.authenticated), user: data.user, error: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setAuthError(message);
      setAuthStatus({ authenticated: false, user: undefined, error: message });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = (): void => {
    const authWindow = window.open(
      apiUrl('/auth/google'),
      'google-oauth',
      'width=500,height=650,menubar=no,toolbar=no'
    );
    if (!authWindow) {
      void refreshAuthStatus();
      return;
    }

    const timer = window.setInterval(async () => {
      if (authWindow.closed) {
        window.clearInterval(timer);
        await refreshAuthStatus();
        return;
      }
      await refreshAuthStatus();
      if (useAuthStore.getState().authenticated) {
        window.clearInterval(timer);
        authWindow.close();
      }
    }, 2000);
  };

  const handleLogout = async (): Promise<void> => {
    setAuthLoading(true);
    setSyncMessage(null);
    setSyncError(null);
    try {
      const response = await apiFetch('/auth/logout', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`ログアウトに失敗しました (${response.status})`);
      }
      setAuthStatus({ authenticated: false, user: undefined, error: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubscriptionsSync = async (): Promise<void> => {
    // クールダウンチェック
    if (!recordFollowChannelSync()) {
      return;
    }

    setSyncLoading(true);
    setSyncMessage(null);
    setSyncError(null);
    try {
      const beforeCount = useUserStore.getState().followedChannels.length;
      const response = await apiFetch('/api/youtube/subscriptions');
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Googleアカウントへの接続が必要です');
        }
        throw new Error(`購読チャンネルの取得に失敗しました (${response.status})`);
      }
      const data = await response.json();
      if (Array.isArray(data.items)) {
        const channels = data.items.map((item: ChannelResult) => ({
          platform: 'youtube' as const,
          channelId: item.id,
          label: item.title
        }));
        addFollowedChannels(channels);
        const afterCount = useUserStore.getState().followedChannels.length;
        const added = afterCount - beforeCount;
        setSyncMessage(`購読チャンネルを同期しました（新規 ${added} 件）`);
      } else {
        setSyncMessage('購読チャンネルは見つかりませんでした。');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setSyncError(message);
    } finally {
      setSyncLoading(false);
    }
  };

  const refreshTwitchAuthStatus = async (): Promise<void> => {
    setTwitchLoading(true);
    setTwitchError(undefined);
    try {
      const response = await apiFetch('/auth/twitch/status');
      if (!response.ok) {
        throw new Error(`Twitchステータス取得に失敗しました (${response.status})`);
      }
      const data = await response.json();
      setTwitchStatus({ authenticated: Boolean(data.authenticated), user: data.user, error: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setTwitchError(message);
      setTwitchStatus({ authenticated: false, user: undefined, error: message });
    } finally {
      setTwitchLoading(false);
    }
  };

  const handleTwitchLogin = (): void => {
    const authWindow = window.open(
      apiUrl('/auth/twitch'),
      'twitch-oauth',
      'width=500,height=650,menubar=no,toolbar=no'
    );
    if (!authWindow) {
      void refreshTwitchAuthStatus();
      return;
    }

    const timer = window.setInterval(async () => {
      if (authWindow.closed) {
        window.clearInterval(timer);
        await refreshTwitchAuthStatus();
        return;
      }
      await refreshTwitchAuthStatus();
      if (useAuthStore.getState().twitchAuthenticated) {
        window.clearInterval(timer);
        authWindow.close();
      }
    }, 2000);
  };

  const handleTwitchLogout = async (): Promise<void> => {
    setTwitchLoading(true);
    setTwitchSyncMessage(null);
    setTwitchSyncError(null);
    try {
      const response = await apiFetch('/auth/twitch/logout', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Twitchログアウトに失敗しました (${response.status})`);
      }
      setTwitchStatus({ authenticated: false, user: undefined, error: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setTwitchError(message);
    } finally {
      setTwitchLoading(false);
    }
  };

  const handleTwitchFollowedChannelsSync = async (): Promise<void> => {
    // クールダウンチェック
    if (!recordFollowChannelSync()) {
      return;
    }

    setTwitchSyncLoading(true);
    setTwitchSyncMessage(null);
    setTwitchSyncError(null);
    try {
      const beforeCount = useUserStore.getState().followedChannels.length;
      const response = await apiFetch('/api/twitch/subscriptions');
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Twitchアカウントへの接続が必要です');
        }
        throw new Error(`フォローチャンネルの取得に失敗しました (${response.status})`);
      }
      const data = await response.json();
      if (Array.isArray(data.items)) {
        // フォロー情報を追加する前に、現在のユーザーIDを設定
        if (twitchUser?.id) {
          setCurrentTwitchUser(twitchUser.id);
        }

        const channels = data.items.map((item: { id: string; displayName: string }) => ({
          platform: 'twitch' as const,
          channelId: item.id,
          label: item.displayName
        }));
        addFollowedChannels(channels);
        const afterCount = useUserStore.getState().followedChannels.length;
        const added = afterCount - beforeCount;
        setTwitchSyncMessage(`フォローチャンネルを同期しました（新規 ${added} 件）`);
      } else {
        setTwitchSyncMessage('フォローチャンネルは見つかりませんでした。');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setTwitchSyncError(message);
    } finally {
      setTwitchSyncLoading(false);
    }
  };

  // 同期モニター：1秒ごとに再生位置を取得
  useEffect(() => {
    const updateSyncStatuses = () => {
      const twitchSlots = slots
        .slice(0, activeSlotsCount)
        .filter((slot) => slot.assignedStream?.platform === 'twitch');

      if (twitchSlots.length === 0) {
        setSyncStatuses([]);
        return;
      }

      // マスタープレイヤーの時刻を取得
      let masterTime = 0;
      if (masterSlotId) {
        const masterPlayer = (window as any)[`twitchPlayer_${masterSlotId}`] as TwitchPlayer | undefined;
        if (masterPlayer) {
          try {
            masterTime = masterPlayer.getCurrentTime();
          } catch (error) {
            console.warn('[SyncMonitor] マスター時刻取得エラー:', error);
          }
        }
      }

      const statuses: SyncStatus[] = [];
      for (const slot of twitchSlots) {
        const player = (window as any)[`twitchPlayer_${slot.id}`] as TwitchPlayer | undefined;
        if (!player || !slot.assignedStream) continue;

        try {
          const currentTime = player.getCurrentTime();
          const timeDiff = masterSlotId ? currentTime - masterTime : 0;

          statuses.push({
            slotId: slot.id,
            displayName: slot.assignedStream.displayName,
            currentTime,
            timeDiff
          });
        } catch (error) {
          console.warn(`[SyncMonitor] ${slot.id} 時刻取得エラー:`, error);
        }
      }

      setSyncStatuses(statuses);
    };

    // 初回実行
    updateSyncStatuses();

    // 1秒ごとに更新
    const interval = setInterval(updateSyncStatuses, 1000);

    return () => clearInterval(interval);
  }, [slots, activeSlotsCount, masterSlotId]);

  const setMasterSlot = useLayoutStore((state) => state.setMasterSlot);
  const clearMasterSlot = useLayoutStore((state) => state.clearMasterSlot);

  // 同期実行
  const handleSyncToMaster = (targetSlotId: string) => {
    if (!masterSlotId) {
      console.warn('[Sync] マスター配信が設定されていません');
      return;
    }

    const masterPlayer = (window as any)[`twitchPlayer_${masterSlotId}`] as TwitchPlayer | undefined;
    const targetPlayer = (window as any)[`twitchPlayer_${targetSlotId}`] as TwitchPlayer | undefined;

    if (!masterPlayer) {
      console.error('[Sync] マスタープレイヤーが見つかりません');
      return;
    }

    if (!targetPlayer) {
      console.error('[Sync] ターゲットプレイヤーが見つかりません');
      return;
    }

    try {
      const masterTime = masterPlayer.getCurrentTime();
      const targetTimeBefore = targetPlayer.getCurrentTime();
      console.log('[Sync] マスター時刻:', masterTime);
      console.log('[Sync] ターゲット時刻（変更前）:', targetTimeBefore);
      console.log('[Sync] 時差:', targetTimeBefore - masterTime, '秒');

      targetPlayer.seek(masterTime);

      try {
        targetPlayer.play();
      } catch (playError) {
        console.log('[Sync] play()がブロックされましたが、seek()は実行されました');
      }

      // seek()の効果を確認するため少し待つ
      setTimeout(() => {
        try {
          const targetTimeAfter = targetPlayer.getCurrentTime();
          console.log('[Sync] ターゲット時刻（変更後）:', targetTimeAfter);
          console.log('[Sync] seek()は成功しましたか?', Math.abs(targetTimeAfter - masterTime) < 5 ? 'はい' : 'いいえ');
        } catch (err) {
          console.error('[Sync] 変更後の時刻取得エラー:', err);
        }
      }, 500);

      console.log('[Sync] 同期実行:', targetSlotId, 'を', masterTime, '秒に移動');
    } catch (error) {
      console.error('[Sync] 同期エラー:', error);
    }
  };

  return (
    <div className={styles.menu}>
      {config.enableYoutube && (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>YouTube連携</h3>
        <div className={styles.authStatus}>
          {authLoading ? (
            <span>ステータス確認中…</span>
          ) : authenticated ? (
            <>
              <span>接続中: {authUser?.name ?? 'YouTube'}</span>
              {authUser?.email && <span className={styles.authSubtext}>{authUser.email}</span>}
            </>
          ) : (
            <span>未接続</span>
          )}
        </div>
        <div className={styles.actions}>
          {!authenticated ? (
            <button type="button" onClick={handleLogin} disabled={authLoading}>
              Googleでサインイン
            </button>
          ) : (
            <button type="button" onClick={handleLogout} disabled={authLoading}>
              ログアウト
            </button>
          )}
          <button type="button" onClick={handleSubscriptionsSync} disabled={!authenticated || syncLoading || !canFollowChannelSync()}>
            {followChannelCooldownRemaining > 0 ? `あと${followChannelCooldownRemaining}秒` : '購読チャンネルを同期'}
          </button>
        </div>
        {syncMessage && <div className={styles.syncMessage}>{syncMessage}</div>}
        {syncError && <div className={styles.syncError}>{syncError}</div>}
      </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Twitch連携</h3>
        <div className={styles.authStatus}>
          {twitchLoading ? (
            <span>ステータス確認中…</span>
          ) : twitchAuthenticated ? (
            <>
              <span>接続中: {twitchUser?.displayName ?? 'Twitch'}</span>
              {twitchUser?.login && <span className={styles.authSubtext}>@{twitchUser.login}</span>}
            </>
          ) : (
            <span>未接続</span>
          )}
        </div>
        <div className={styles.actions}>
          {!twitchAuthenticated ? (
            <button type="button" onClick={handleTwitchLogin} disabled={twitchLoading}>
              Twitchでサインイン
            </button>
          ) : (
            <button type="button" onClick={handleTwitchLogout} disabled={twitchLoading}>
              ログアウト
            </button>
          )}
          <button
            type="button"
            onClick={handleTwitchFollowedChannelsSync}
            disabled={!twitchAuthenticated || twitchSyncLoading || !canFollowChannelSync()}
          >
            {followChannelCooldownRemaining > 0 ? `あと${followChannelCooldownRemaining}秒` : 'フォローチャンネルを同期'}
          </button>
        </div>
        {twitchSyncMessage && <div className={styles.syncMessage}>{twitchSyncMessage}</div>}
        {twitchSyncError && <div className={styles.syncError}>{twitchSyncError}</div>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <ClockIcon />
          <h3 className={styles.sectionTitle}>配信同期モニター</h3>
        </div>
        <p className={styles.description}>
          Twitch配信の再生位置をリアルタイムで監視します。
        </p>

        {syncStatuses.length === 0 ? (
          <div className={styles.syncMonitorEmpty}>
            Twitch配信が視聴中ではありません
          </div>
        ) : (
          <div className={styles.syncMonitorList}>
            {syncStatuses.map((status) => {
              const isMaster = status.slotId === masterSlotId;
              const absDiff = Math.abs(status.timeDiff);
              let diffColor = styles.syncDiffGreen;
              let diffIcon = '✅';

              if (absDiff >= 5) {
                diffColor = styles.syncDiffRed;
                diffIcon = '🔴';
              } else if (absDiff >= 2) {
                diffColor = styles.syncDiffYellow;
                diffIcon = '🟡';
              }

              return (
                <div key={status.slotId} className={styles.syncMonitorItem}>
                  <div className={styles.syncMonitorHeader}>
                    {isMaster && <span className={styles.syncMasterBadge}>🎯 マスター</span>}
                    <span className={styles.syncMonitorName}>{status.displayName}</span>
                  </div>
                  <div className={styles.syncMonitorDetails}>
                    <span className={styles.syncMonitorTime}>{formatTime(status.currentTime)}</span>
                    {masterSlotId && !isMaster && (
                      <span className={`${styles.syncMonitorDiff} ${diffColor}`}>
                        {diffIcon} {status.timeDiff >= 0 ? '+' : ''}{status.timeDiff.toFixed(1)}秒
                      </span>
                    )}
                  </div>
                  <div className={styles.syncMonitorActions}>
                    {isMaster ? (
                      <button
                        type="button"
                        className={styles.syncActionButton}
                        onClick={() => clearMasterSlot()}
                      >
                        マスター解除
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.syncActionButton}
                          onClick={() => setMasterSlot(status.slotId)}
                        >
                          マスターに設定
                        </button>
                        {masterSlotId && (
                          <button
                            type="button"
                            className={styles.syncButtonAction}
                            onClick={() => handleSyncToMaster(status.slotId)}
                          >
                            同期
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!masterSlotId && syncStatuses.length > 0 && (
          <div className={styles.syncMonitorNote}>
            ※ マスター配信を設定すると時差が表示されます
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <AdjustmentsHorizontalIcon />
          <h3 className={styles.sectionTitle}>アカウント同期設定</h3>
        </div>
        <p className={styles.description}>
          配信情報の自動更新間隔を設定できます。
        </p>

        {/* 同期設定 */}
        <div className={styles.syncSettings}>
          <label className={styles.settingItem}>
            <input
              type="checkbox"
              checked={syncSettings.enabled}
              onChange={(e) => updateSettings({ enabled: e.target.checked })}
            />
            <span>自動同期を有効にする</span>
          </label>

          <div className={styles.syncIntervalControl}>
            <label className={styles.syncIntervalLabel}>同期間隔</label>
            <select
              className={styles.syncIntervalSelect}
              value={syncSettings.interval}
              onChange={(e) => updateSettings({ interval: Number(e.target.value) as any })}
              disabled={!syncSettings.enabled}
            >
              {SYNC_INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.syncStatus}>
            <span className={styles.syncStatusLabel}>
              最終更新: {getLastSyncText()}
            </span>
            {syncing && <span className={styles.syncingIndicator}>同期中...</span>}
          </div>

          <button
            type="button"
            className={styles.syncManualButton}
            onClick={triggerManualSync}
            disabled={syncing || !canManualSync()}
          >
            <ArrowPathIcon />
            <span>
              {cooldownRemaining > 0 ? `あと${cooldownRemaining}秒` : '今すぐ更新'}
            </span>
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <CircleStackIcon />
          <h3 className={styles.sectionTitle}>データ使用量</h3>
        </div>
        <p className={styles.description}>
          各視聴枠の画質設定と推定帯域使用量を管理できます。
        </p>

        {/* 自動画質調整 */}
        <div className={styles.dataUsageSettings}>
          <label className={styles.settingItem}>
            <input
              type="checkbox"
              checked={autoQualityEnabled}
              onChange={(e) => setAutoQualityEnabled(e.target.checked)}
            />
            <span>自動画質調整を有効にする</span>
          </label>

          {/* 実際のデータ使用量 */}
          <div className={styles.actualDataUsage}>
            <div className={styles.actualDataUsageHeader}>
              <span className={styles.actualDataUsageLabel}>セッション使用量:</span>
              <span className={styles.actualDataUsageValue}>
                {formatDataUsage(getTotalMB(), getTotalGB())}
              </span>
            </div>
            <div className={styles.actualDataUsageInfo}>
              <span className={styles.sessionDuration}>
                セッション時間: {formatSessionDuration(getSessionDuration())}
              </span>
              <button
                type="button"
                className={styles.resetDataUsageButton}
                onClick={resetDataUsage}
                title="データ使用量をリセット"
              >
                リセット
              </button>
            </div>
            <p className={styles.dataUsageNote}>
              ※ ブラウザが読み込んだリソースのサイズを測定しています。配信ストリーミングの一部は含まれません。
            </p>
          </div>

          {/* 合計帯域幅 */}
          <div className={styles.totalBandwidth}>
            <span className={styles.totalBandwidthLabel}>合計推定帯域:</span>
            <span className={styles.totalBandwidthValue}>
              {autoQualityEnabled ? '自動調整中' : `約 ${getTotalBandwidth().toFixed(1)} Mbps`}
            </span>
          </div>

          {/* 各視聴枠の画質設定 */}
          <div className={styles.slotQualityList}>
            {slots.slice(0, activeSlotsCount).map((slot, index) => (
              <div key={slot.id} className={styles.slotQualityItem}>
                <div className={styles.slotQualityHeader}>
                  <span className={styles.slotQualityLabel}>
                    枠 {index + 1}
                    {slot.assignedStream && ` - ${slot.assignedStream.displayName}`}
                  </span>
                  {!autoQualityEnabled && slot.quality !== 'auto' && (
                    <span className={styles.slotBandwidth}>
                      約 {getBandwidthForQuality(slot.quality).toFixed(1)} Mbps
                    </span>
                  )}
                </div>
                <select
                  className={styles.qualitySelect}
                  value={slot.quality}
                  onChange={(e) => setSlotQuality(slot.id, e.target.value as VideoQuality)}
                  disabled={autoQualityEnabled}
                >
                  {QUALITY_BANDWIDTH_MAP.map((q) => (
                    <option key={q.quality} value={q.quality}>
                      {q.label}
                      {q.quality !== 'auto' ? ` (${q.mbps} Mbps)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* 画質別の説明 */}
          <div className={styles.qualityInfo}>
            <p className={styles.qualityInfoTitle}>画質別の推定帯域:</p>
            <ul className={styles.qualityInfoList}>
              {QUALITY_BANDWIDTH_MAP.filter((q) => q.quality !== 'auto').map((q) => (
                <li key={q.quality}>
                  {q.label}: 約 {q.mbps} Mbps
                </li>
              ))}
            </ul>
            <p className={styles.qualityInfoNote}>
              ※ 実際の帯域使用量は配信内容や視聴環境により変動します。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
