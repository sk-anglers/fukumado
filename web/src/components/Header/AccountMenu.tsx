import { useState } from 'react';
import { AdjustmentsHorizontalIcon, CircleStackIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useSyncStore, SYNC_INTERVAL_OPTIONS } from '../../stores/syncStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { apiFetch, apiUrl } from '../../utils/api';
import type { VideoQuality, QualityBandwidth } from '../../types';
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

  const syncSettings = useSyncStore((state) => state.settings);
  const syncing = useSyncStore((state) => state.syncing);
  const lastSyncTime = useSyncStore((state) => state.lastSyncTime);
  const updateSettings = useSyncStore((state) => state.updateSettings);
  const triggerManualSync = useSyncStore((state) => state.triggerManualSync);

  const slots = useLayoutStore((state) => state.slots);
  const activeSlotsCount = useLayoutStore((state) => state.activeSlotsCount);
  const autoQualityEnabled = useLayoutStore((state) => state.autoQualityEnabled);
  const setSlotQuality = useLayoutStore((state) => state.setSlotQuality);
  const setAutoQualityEnabled = useLayoutStore((state) => state.setAutoQualityEnabled);

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const [twitchSyncMessage, setTwitchSyncMessage] = useState<string | null>(null);
  const [twitchSyncError, setTwitchSyncError] = useState<string | null>(null);
  const [twitchSyncLoading, setTwitchSyncLoading] = useState(false);

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

  return (
    <div className={styles.menu}>
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
          <button type="button" onClick={handleSubscriptionsSync} disabled={!authenticated || syncLoading}>
            購読チャンネルを同期
          </button>
        </div>
        {syncMessage && <div className={styles.syncMessage}>{syncMessage}</div>}
        {syncError && <div className={styles.syncError}>{syncError}</div>}
      </section>

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
            disabled={!twitchAuthenticated || twitchSyncLoading}
          >
            フォローチャンネルを同期
          </button>
        </div>
        {twitchSyncMessage && <div className={styles.syncMessage}>{twitchSyncMessage}</div>}
        {twitchSyncError && <div className={styles.syncError}>{twitchSyncError}</div>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <AdjustmentsHorizontalIcon />
          <h3 className={styles.sectionTitle}>同期コントロール</h3>
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
            disabled={syncing}
          >
            <ArrowPathIcon />
            <span>今すぐ更新</span>
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
