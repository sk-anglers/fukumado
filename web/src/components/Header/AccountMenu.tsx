import { useState, useEffect, useMemo } from 'react';
import { AdjustmentsHorizontalIcon, CircleStackIcon, ArrowPathIcon, ClockIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useUserStore } from '../../stores/userStore';
import { useSyncStore, SYNC_INTERVAL_OPTIONS } from '../../stores/syncStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useDataUsageStore } from '../../stores/dataUsageStore';
import { useHelpStore } from '../../stores/helpStore';
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
  const { trackAuth, trackFeature, trackButton } = useAnalytics();
  const openHelpModal = useHelpStore((state) => state.openModal);

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

  const handleManualSync = (): void => {
    // 手動同期をトラッキング（エラーがあっても継続）
    try {
      trackFeature('sync');
    } catch (err) {
      console.error('[AccountMenu] Analytics tracking error:', err);
    }

    // 手動同期を実行
    triggerManualSync();
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

    console.log('[Google Auth] OAuth popup opened, starting polling');

    // ポーリング: 500msごとに認証状態を確認
    const timer = window.setInterval(async () => {
      // ウィンドウが閉じられた場合
      if (authWindow.closed) {
        console.log('[Google Auth] Popup closed, retrying authentication check');
        window.clearInterval(timer);

        // リトライロジック: 最大5回（2.5秒間）認証状態をチェック
        let retryCount = 0;
        const maxRetries = 5;
        const retryInterval = 500;

        const retryTimer = window.setInterval(async () => {
          retryCount++;
          console.log(`[Google Auth] Retry ${retryCount}/${maxRetries}`);

          await refreshAuthStatus();

          if (useAuthStore.getState().authenticated) {
            console.log('[Google Auth] Authentication successful after retry');
            window.clearInterval(retryTimer);
          } else if (retryCount >= maxRetries) {
            console.log('[Google Auth] Max retries reached, authentication may have failed');
            window.clearInterval(retryTimer);
          }
        }, retryInterval);

        return;
      }

      // 認証状態を定期的に確認
      await refreshAuthStatus();

      // 認証成功したらポップアップを閉じる
      if (useAuthStore.getState().authenticated) {
        console.log('[Google Auth] Authentication successful, closing popup');
        window.clearInterval(timer);
        authWindow.close();
        // YouTubeログイン成功をトラッキング
        trackAuth('youtube', 'login', true);
      }
    }, 500);
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
      // ユーザーIDをクリアしてフォローチャンネルを非表示に
      setCurrentYoutubeUser(null);
      // スロット情報をクリア（最新の状態を取得）
      const layoutState = useLayoutStore.getState();
      layoutState.slots.slice(0, layoutState.activeSlotsCount).forEach((slot) => {
        layoutState.clearSlot(slot.id);
      });
      // YouTube配信リストをクリア
      layoutState.setAvailableStreamsForPlatform('youtube', []);
      // SessionIDをクリア（再ログイン時に新しいsessionIdを取得）
      useAuthStore.getState().clearSessionId();

      // ログアウトをトラッキング
      trackAuth('youtube', 'logout', true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setAuthError(message);
      // ログアウト失敗もトラッキング
      trackAuth('youtube', 'logout', false);
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

    console.log('[Twitch Auth] OAuth popup opened, starting polling');

    // ポーリング: 500msごとに認証状態を確認
    const timer = window.setInterval(async () => {
      // ウィンドウが閉じられた場合
      if (authWindow.closed) {
        console.log('[Twitch Auth] Popup closed, retrying authentication check');
        window.clearInterval(timer);

        // リトライロジック: 最大5回（2.5秒間）認証状態をチェック
        let retryCount = 0;
        const maxRetries = 5;
        const retryInterval = 500;

        const retryTimer = window.setInterval(async () => {
          retryCount++;
          console.log(`[Twitch Auth] Retry ${retryCount}/${maxRetries}`);

          await refreshTwitchAuthStatus();

          if (useAuthStore.getState().twitchAuthenticated) {
            console.log('[Twitch Auth] Authentication successful after retry');
            window.clearInterval(retryTimer);
          } else if (retryCount >= maxRetries) {
            console.log('[Twitch Auth] Max retries reached, authentication may have failed');
            window.clearInterval(retryTimer);
          }
        }, retryInterval);

        return;
      }

      // 認証状態を定期的に確認
      await refreshTwitchAuthStatus();

      // 認証成功したらポップアップを閉じる
      if (useAuthStore.getState().twitchAuthenticated) {
        console.log('[Twitch Auth] Authentication successful, closing popup');
        window.clearInterval(timer);
        authWindow.close();
        // Twitchログイン成功をトラッキング
        trackAuth('twitch', 'login', true);
      }
    }, 500);
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
      // ユーザーIDをクリアしてフォローチャンネルを非表示に
      setCurrentTwitchUser(null);
      // スロット情報をクリア（最新の状態を取得）
      const layoutState = useLayoutStore.getState();
      layoutState.slots.slice(0, layoutState.activeSlotsCount).forEach((slot) => {
        layoutState.clearSlot(slot.id);
      });
      // Twitch配信リストをクリア
      layoutState.setAvailableStreamsForPlatform('twitch', []);
      // SessionIDをクリア（再ログイン時に新しいsessionIdを取得）
      useAuthStore.getState().clearSessionId();

      // Twitchログアウト成功をトラッキング
      trackAuth('twitch', 'logout', true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      setTwitchError(message);
      // Twitchログアウト失敗をトラッキング
      trackAuth('twitch', 'logout', false);
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
      // refresh=true を付けてキャッシュを無効化し、最新のフォローチャンネルを取得
      const response = await apiFetch('/api/twitch/subscriptions?refresh=true');
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

  // 最適化: Twitch スロットの変更のみを検出
  const twitchSlotKey = useMemo(() => {
    return slots
      .slice(0, activeSlotsCount)
      .filter((slot) => slot.assignedStream?.platform === 'twitch')
      .map((slot) => `${slot.id}:${slot.assignedStream?.id || 'none'}`)
      .join(',');
  }, [slots, activeSlotsCount]);

  // 同期モニター：1秒ごとに再生位置を取得
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log('[SyncMonitor]', timestamp, 'インターバル作成 - twitchSlotKey:', twitchSlotKey, 'masterSlotId:', masterSlotId);

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
        console.log('[SyncMonitor] マスタープレイヤー参照試行:', masterSlotId, 'exists:', !!masterPlayer);
        if (masterPlayer) {
          try {
            masterTime = masterPlayer.getCurrentTime();
            console.log('[SyncMonitor] マスター getCurrentTime():', masterSlotId, 'time:', masterTime);
          } catch (error) {
            console.warn('[SyncMonitor] マスター時刻取得エラー:', error);
          }
        }
      }

      const statuses: SyncStatus[] = [];
      for (const slot of twitchSlots) {
        const player = (window as any)[`twitchPlayer_${slot.id}`] as TwitchPlayer | undefined;
        console.log('[SyncMonitor] プレイヤー参照試行:', slot.id, 'exists:', !!player, 'hasStream:', !!slot.assignedStream);
        if (!player || !slot.assignedStream) continue;

        try {
          const currentTime = player.getCurrentTime();
          console.log('[SyncMonitor] getCurrentTime():', slot.id, 'time:', currentTime);
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

    return () => {
      const cleanupTimestamp = new Date().toISOString();
      console.log('[SyncMonitor]', cleanupTimestamp, 'インターバルクリーンアップ - twitchSlotKey:', twitchSlotKey);
      clearInterval(interval);
    };
  }, [twitchSlotKey, masterSlotId, slots, activeSlotsCount]);

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
            onClick={handleManualSync}
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
          <QuestionMarkCircleIcon />
          <h3 className={styles.sectionTitle}>ヘルプ</h3>
        </div>
        <p className={styles.description}>
          使い方やよくある質問を確認できます。
        </p>
        <button
          type="button"
          className={styles.helpButton}
          onClick={() => {
            openHelpModal();
            trackButton('help', 'account_menu');
            onClose();
          }}
        >
          <QuestionMarkCircleIcon />
          <span>ヘルプを開く</span>
        </button>
      </section>
    </div>
  );
};
