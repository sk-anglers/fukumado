import { useEffect, useRef, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell/AppShell";
import { ConsentManager } from "./components/ConsentManager";
import { MaintenancePage } from "./components/MaintenancePage/MaintenancePage";
import { MobileRestriction } from "./components/MobileRestriction/MobileRestriction";
import { UnsupportedBrowser } from "./components/UnsupportedBrowser/UnsupportedBrowser";
import { ErrorBoundary } from "./components/ErrorBoundary/ErrorBoundary";
import { ErrorScreen } from "./components/ErrorScreen/ErrorScreen";
import { useStreamUpdates } from "./hooks/useStreamUpdates";
import { useTwitchChat } from "./hooks/useTwitchChat";
import { useLayoutStore } from "./stores/layoutStore";
import { useUserStore } from "./stores/userStore";
import { useAuthStatus } from "./hooks/useAuthStatus";
import { useTwitchAuthStatus } from "./hooks/useTwitchAuthStatus";
import { useAuthStore } from "./stores/authStore";
import { useSyncStore } from "./stores/syncStore";
import { useMaintenanceStore } from "./stores/maintenanceStore";
import { useIsMobile } from "./hooks/useMediaQuery";
import { useLayoutTracking } from "./hooks/useAnalytics";
import { apiFetch } from "./utils/api";
import { isSafari } from "./utils/browserDetection";
import { config } from "./config";

function App(): JSX.Element {
  const ensureSelection = useLayoutStore((state) => state.ensureSelection);
  const slots = useLayoutStore((state) => state.slots);
  const preset = useLayoutStore((state) => state.preset);
  const activeSlotsCount = useLayoutStore((state) => state.activeSlotsCount);
  const followedChannels = useUserStore((state) => state.followedChannels);
  const addFollowedChannels = useUserStore((state) => state.addFollowedChannels);
  const setCurrentYoutubeUser = useUserStore((state) => state.setCurrentYoutubeUser);
  const setCurrentTwitchUser = useUserStore((state) => state.setCurrentTwitchUser);
  const authenticated = useAuthStore((state) => state.authenticated);
  const authUser = useAuthStore((state) => state.user);
  const twitchAuthenticated = useAuthStore((state) => state.twitchAuthenticated);
  const twitchUser = useAuthStore((state) => state.twitchUser);
  const setSessionId = useAuthStore((state) => state.setSessionId);
  const triggerManualSync = useSyncStore((state) => state.triggerManualSync);
  const maintenanceEnabled = useMaintenanceStore((state) => state.enabled);
  const loadFromServer = useLayoutStore((state) => state.loadFromServer);
  const saveToServer = useLayoutStore((state) => state.saveToServer);
  const autoQualityEnabled = useLayoutStore((state) => state.autoQualityEnabled);
  const mutedAll = useLayoutStore((state) => state.mutedAll);
  const masterVolume = useLayoutStore((state) => state.masterVolume);

  // エラーテストモード用のステート
  const [shouldThrowError, setShouldThrowError] = useState(false);

  // メモ化してuseEffectの不要な再実行を防ぐ
  const followedChannelIds = useMemo(
    () => followedChannels.filter((item) => item.platform === "youtube").map((item) => item.channelId),
    [followedChannels]
  );

  const twitchFollowedChannelIds = useMemo(
    () => followedChannels.filter((item) => item.platform === "twitch").map((item) => item.channelId),
    [followedChannels]
  );

  // 現在視聴中のTwitchチャンネルの情報を取得
  const activeTwitchChannels = useMemo(() => {
    const channels: Array<{ login: string; displayName: string; channelId?: string }> = [];
    for (const slot of slots) {
      if (slot.assignedStream?.platform === 'twitch' && slot.assignedStream.embedUrl) {
        // embedUrlから channel パラメータを抽出
        const match = slot.assignedStream.embedUrl.match(/[?&]channel=([^&]+)/);
        if (match && match[1]) {
          channels.push({
            login: match[1],
            displayName: slot.assignedStream.displayName,
            channelId: slot.assignedStream.channelId
          });
        }
      }
    }
    return channels;
  }, [slots]);

  useAuthStatus();
  useTwitchAuthStatus();

  const isMobile = useIsMobile();

  // レイアウト変更を自動追跡
  useLayoutTracking(activeSlotsCount, preset);

  // 初回ロード時にメンテナンス状態を取得
  useEffect(() => {
    const fetchMaintenanceStatus = async () => {
      try {
        const response = await apiFetch('/api/admin/maintenance/status');
        if (response.ok) {
          const data = await response.json();
          if (data.enabled) {
            useMaintenanceStore.getState().setMaintenance({
              enabled: true,
              message: data.message || 'サービスは現在メンテナンス中です。',
              enabledAt: data.enabledAt,
              duration: data.duration,
              scheduledEndAt: data.scheduledEndAt
            });
          }
        }
      } catch (error) {
        console.error('[App] Failed to fetch maintenance status:', error);
      }
    };

    fetchMaintenanceStatus();
  }, []);

  // エラーテストモードをチェック
  useEffect(() => {
    const checkErrorTestMode = async () => {
      try {
        console.log('[App] Checking error test mode...');
        const response = await apiFetch('/api/error-test/status');
        console.log('[App] Error test mode response:', response.status, response.ok);

        if (response.ok) {
          const data = await response.json();
          console.log('[App] Error test mode data:', data);

          if (data.data?.enabled) {
            console.log('[App] Error test mode is enabled, will throw error on next render');
            setShouldThrowError(true);
          } else {
            console.log('[App] Error test mode is disabled');
          }
        } else {
          console.warn('[App] Error test mode endpoint returned non-OK status:', response.status);
        }
      } catch (error) {
        console.error('[App] Failed to check error test mode:', error);
      }
    };

    checkErrorTestMode();
  }, []);

  // グローバルエラーハンドラー（デバッグ用）
  useEffect(() => {
    const handleError = (event: ErrorEvent): void => {
      console.error('[Global Error]', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
      console.error('[Unhandled Promise Rejection]', {
        reason: event.reason,
        promise: event.promise
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // バックエンド主導の配信更新（WebSocketプッシュ）
  useStreamUpdates(
    config.enableYoutube ? followedChannelIds : [],
    twitchFollowedChannelIds
  );

  useTwitchChat(activeTwitchChannels);

  useEffect(() => {
    ensureSelection();
  }, [ensureSelection]);

  // YouTube認証状態が変わったらユーザーIDを設定
  useEffect(() => {
    if (authenticated && authUser?.id) {
      setCurrentYoutubeUser(authUser.id);
    } else {
      setCurrentYoutubeUser(null);
    }
  }, [authenticated, authUser, setCurrentYoutubeUser]);

  // Twitch認証状態が変わったらユーザーIDを設定
  useEffect(() => {
    if (twitchAuthenticated && twitchUser?.id) {
      setCurrentTwitchUser(twitchUser.id);
    } else {
      setCurrentTwitchUser(null);
    }
  }, [twitchAuthenticated, twitchUser, setCurrentTwitchUser]);

  const hasSyncedSubscriptions = useRef(false);
  const hasSyncedTwitchSubscriptions = useRef(false);
  const prevTwitchAuthenticated = useRef(false);

  // リロード時にsyncフラグをリセット（最優先で実行）
  useEffect(() => {
    // マウント時（リロード時）に一度だけリセット
    hasSyncedTwitchSubscriptions.current = false;
    hasSyncedSubscriptions.current = false;
    console.log('[App] Reset sync flags on mount (reload)');
  }, []); // 空の依存配列 = マウント時のみ実行

  // デバッグ: リロード時のfollowedChannels復元を確認
  useEffect(() => {
    if (followedChannels.length > 0) {
      console.log('[App] Followed channels loaded:', {
        total: followedChannels.length,
        youtube: followedChannelIds.length,
        twitch: twitchFollowedChannelIds.length
      });
    }
  }, [followedChannels.length, followedChannelIds.length, twitchFollowedChannelIds.length]);

  // YouTube機能が有効な場合のみ購読チャンネルを同期
  useEffect(() => {
    if (!config.enableYoutube) return;

    const syncSubscriptions = async (): Promise<void> => {
      if (!authenticated || hasSyncedSubscriptions.current) {
        console.log('[App] Skipping YouTube subscriptions sync:', {
          authenticated: authenticated,
          alreadySynced: hasSyncedSubscriptions.current
        });
        return;
      }
      console.log('[App] Fetching YouTube subscriptions...');
      try {
        const response = await apiFetch("/api/youtube/subscriptions");
        if (!response.ok) {
          throw new Error(`購読チャンネルの取得に失敗しました (${response.status})`);
        }
        const data = await response.json();

        if (Array.isArray(data.items)) {
          // フォロー情報を追加する前に、現在のユーザーIDを設定
          const currentYoutubeUser = useAuthStore.getState().user;
          if (currentYoutubeUser?.id) {
            setCurrentYoutubeUser(currentYoutubeUser.id);
          }

          const channels = data.items.map((item: { id: string; title: string }) => ({
            platform: "youtube" as const,
            channelId: item.id,
            label: item.title
          }));
          console.log('[App] Adding YouTube subscribed channels:', channels.length);
          addFollowedChannels(channels);
          hasSyncedSubscriptions.current = true;

          // フォローチャンネル設定後にSessionIDを保存（useStreamUpdatesをトリガー）
          if (data.sessionId) {
            console.log('[App] Setting YouTube sessionId:', data.sessionId);
            setSessionId(data.sessionId);
          } else {
            console.warn('[App] No sessionId in YouTube subscriptions response');
          }

          // 購読チャンネル同期完了後、配信取得を強制的に実行
          console.log('[App] Triggering manual sync after YouTube subscriptions');
          triggerManualSync();
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    };
    syncSubscriptions();
  }, [authenticated, addFollowedChannels, triggerManualSync, setCurrentYoutubeUser, setSessionId]);

  useEffect(() => {
    if (!authenticated) {
      hasSyncedSubscriptions.current = false;
    }
  }, [authenticated]);

  // Twitch認証状態の変化を検知（Safari対策）
  useEffect(() => {
    // false → true に変わった時（新規ログイン時）
    if (twitchAuthenticated && !prevTwitchAuthenticated.current) {
      console.log('[App] Twitch authentication status changed to true, resetting sync flag');
      hasSyncedTwitchSubscriptions.current = false;
    }
    prevTwitchAuthenticated.current = twitchAuthenticated;
  }, [twitchAuthenticated]);

  useEffect(() => {
    const syncTwitchSubscriptions = async (): Promise<void> => {
      if (!twitchAuthenticated || hasSyncedTwitchSubscriptions.current) {
        console.log('[App] Skipping Twitch subscriptions sync:', {
          authenticated: twitchAuthenticated,
          alreadySynced: hasSyncedTwitchSubscriptions.current
        });
        return;
      }
      console.log('[App] Fetching Twitch subscriptions...');
      try {
        const response = await apiFetch("/api/twitch/subscriptions");
        if (!response.ok) {
          throw new Error(`Twitchフォローチャンネルの取得に失敗しました (${response.status})`);
        }
        const data = await response.json();

        if (Array.isArray(data.items)) {
          // フォロー情報を追加する前に、現在のユーザーIDを設定
          const currentTwitchUser = useAuthStore.getState().twitchUser;
          if (currentTwitchUser?.id) {
            setCurrentTwitchUser(currentTwitchUser.id);
          }

          const channels = data.items.map((item: { id: string; displayName: string }) => ({
            platform: "twitch" as const,
            channelId: item.id,
            label: item.displayName
          }));
          console.log('[App] Adding Twitch followed channels:', channels.length);
          addFollowedChannels(channels);
          hasSyncedTwitchSubscriptions.current = true;

          // フォローチャンネル設定後にSessionIDを保存（useStreamUpdatesをトリガー）
          if (data.sessionId) {
            console.log('[App] Setting Twitch sessionId:', data.sessionId);
            setSessionId(data.sessionId);
          } else {
            console.warn('[App] No sessionId in Twitch subscriptions response');
          }

          // フォローチャンネル同期完了後、配信取得を強制的に実行
          console.log('[App] Triggering manual sync after Twitch subscriptions');
          triggerManualSync();
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    };
    syncTwitchSubscriptions();
  }, [twitchAuthenticated, addFollowedChannels, triggerManualSync, setCurrentTwitchUser, setSessionId]);

  useEffect(() => {
    if (!twitchAuthenticated) {
      hasSyncedTwitchSubscriptions.current = false;
    }
  }, [twitchAuthenticated]);

  // 認証完了時にユーザー設定をサーバーからロード
  useEffect(() => {
    const hasAuthentication = authenticated || twitchAuthenticated;
    if (hasAuthentication) {
      console.log('[App] Loading user preferences from server...');
      loadFromServer();
    }
  }, [authenticated, twitchAuthenticated, loadFromServer]);

  // 設定変更時にサーバーに自動保存（デバウンス: 2秒）
  const saveTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    const hasAuthentication = authenticated || twitchAuthenticated;
    if (!hasAuthentication) return;

    // 前回のタイマーをクリア
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    // 2秒後に保存
    saveTimeoutRef.current = window.setTimeout(() => {
      console.log('[App] Auto-saving user preferences to server...');
      saveToServer();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    authenticated,
    twitchAuthenticated,
    activeSlotsCount,
    preset,
    autoQualityEnabled,
    mutedAll,
    masterVolume,
    saveToServer
  ]);

  // エラーテストモードが有効な場合はエラー画面を表示
  if (shouldThrowError) {
    console.log('[App] Error test mode is enabled, displaying ErrorScreen');
    return <ErrorScreen />;
  }

  // メンテナンス中の場合はメンテナンス画面を表示
  if (maintenanceEnabled) {
    return <MaintenancePage />;
  }

  // Safari非対応画面を表示（beta環境では許可）
  if (isSafari() && !config.isBeta) {
    return <UnsupportedBrowser />;
  }

  // モバイル制限を解除（全環境でモバイルアクセス可能）
  // if (isMobile && !config.isBeta) {
  //   return <MobileRestriction />;
  // }

  return (
    <ErrorBoundary>
      <ConsentManager />
      <AppShell />
    </ErrorBoundary>
  );
}

export default App;

