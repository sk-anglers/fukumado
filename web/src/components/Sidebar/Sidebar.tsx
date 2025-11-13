import { useMemo } from "react";
import clsx from "clsx";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { type Streamer } from "../../types";
import { useLayoutStore } from "../../stores/layoutStore";
import { useMobileMenuStore } from "../../stores/mobileMenuStore";
import { useAuthStore } from "../../stores/authStore";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { SlotSelectionModal } from "../SlotSelectionModal/SlotSelectionModal";
import { config } from "../../config";
import { apiUrl, apiFetch } from "../../utils/api";
import { trackButtonClick } from "../../utils/gtm";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  onOpenPresetModal: () => void;
}

const platformLabel: Record<Streamer["platform"], string> = {
  youtube: "YouTube Live",
  twitch: "Twitch",
  niconico: "ニコニコ生放送"
};

const platformAccent: Record<Streamer["platform"], string> = {
  youtube: "#ef4444",
  twitch: "#a855f7",
  niconico: "#facc15"
};

const formatViewerCount = (viewerCount?: number): string => {
  if (viewerCount == null) return "視聴者数 -";
  return `視聴 ${viewerCount.toLocaleString()} 人`;
};

const formatMeta = (stream: Streamer): string => {
  if (stream.gameTitle) return stream.gameTitle;
  if (stream.liveSince) {
    const date = new Date(stream.liveSince);
    if (!Number.isNaN(date.getTime())) {
      return `${date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 配信開始`;
    }
  }
  return stream.channelTitle ?? "配信中";
};

interface ChannelResult {
  id: string;
  title: string;
}

export const Sidebar = ({ onOpenPresetModal }: SidebarProps): JSX.Element => {
  const {
    availableStreams,
    streamsLoading,
    streamsError,
    pendingStream,
    setPendingStream
  } = useLayoutStore((state) => ({
    availableStreams: state.availableStreams,
    streamsLoading: state.streamsLoading,
    streamsError: state.streamsError,
    pendingStream: state.pendingStream,
    setPendingStream: state.setPendingStream
  }));

  const twitchAuthenticated = useAuthStore((state) => state.twitchAuthenticated);
  const twitchUser = useAuthStore((state) => state.twitchUser);
  const twitchLoading = useAuthStore((state) => state.twitchLoading);
  const setTwitchStatus = useAuthStore((state) => state.setTwitchStatus);
  const setTwitchLoading = useAuthStore((state) => state.setTwitchLoading);
  const setTwitchError = useAuthStore((state) => state.setTwitchError);

  const isMobile = useIsMobile();
  const setSidebarOpen = useMobileMenuStore((state) => state.setSidebarOpen);

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
    // GTMトラッキング
    trackButtonClick('sidebar_twitch_login');

    // モバイルの場合はリダイレクト方式
    if (isMobile) {
      window.location.href = apiUrl('/auth/twitch');
      return;
    }

    // デスクトップは既存のポップアップ方式
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
      }
    }, 500);
  };

  const filteredStreams = useMemo(() => {
    // プラットフォームによるフィルタリングのみ適用
    let platformFiltered = availableStreams;

    // YouTube無効時はYouTube配信を除外
    if (!config.enableYoutube) {
      platformFiltered = availableStreams.filter((stream) => stream.platform !== 'youtube');
    }

    // ニコニコ無効時はニコニコ配信を除外
    if (!config.enableNiconico) {
      platformFiltered = platformFiltered.filter((stream) => stream.platform !== 'niconico');
    }

    return platformFiltered;
  }, [availableStreams]);

  return (
    <>
      {pendingStream && (
        <SlotSelectionModal
          stream={pendingStream}
          onClose={() => setPendingStream(null)}
        />
      )}
      <aside className={styles.sidebar}>
      {isMobile && (
        <div className={styles.loginSection}>
          {!twitchAuthenticated ? (
            <button
              type="button"
              className={styles.loginButton}
              onClick={handleTwitchLogin}
              disabled={twitchLoading}
            >
              Twitchでサインイン
            </button>
          ) : (
            <div className={styles.loginInfo}>
              <span>接続中: {twitchUser?.displayName ?? 'Twitch'}</span>
            </div>
          )}
        </div>
      )}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>フォロー中の配信</h2>
          {isMobile && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setSidebarOpen(false)}
              aria-label="サイドバーを閉じる"
            >
              <XMarkIcon />
            </button>
          )}
        </div>
        <div className={styles.streamList}>
          {streamsLoading ? (
            <div className={styles.streamListMessage}>配信情報を取得しています…</div>
          ) : filteredStreams.length === 0 ? (
            streamsError ? (
              <div className={clsx(styles.streamListMessage, styles.streamListMessageError)}>
                配信情報の取得に失敗しました：{streamsError}
              </div>
            ) : (
              <div className={styles.streamListMessage}>
                現在表示できる配信が見つかりません。
              </div>
            )
          ) : (
            filteredStreams.map((stream) => (
              <div key={stream.id} className={styles.streamListItem}>
                <div className={styles.streamThumbnail}>
                  {stream.thumbnailUrl ? (
                    <img src={stream.thumbnailUrl} alt={stream.title} />
                  ) : (
                    <div className={styles.thumbnailPlaceholder}>
                      {stream.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.platformBadge}
                    style={{ backgroundColor: platformAccent[stream.platform] }}
                    onClick={(e) => {
                      e.stopPropagation();
                      trackButtonClick('sidebar_open_on_platform', {
                        platform: stream.platform,
                        channel_id: stream.id
                      });
                      const url = stream.platform === 'twitch'
                        ? `https://www.twitch.tv/${stream.channelLogin || stream.id}`
                        : stream.platform === 'youtube'
                        ? `https://www.youtube.com/watch?v=${stream.id}`
                        : stream.embedUrl;
                      if (url) window.open(url, '_blank');
                    }}
                    title={`${platformLabel[stream.platform]}で開く`}
                  >
                    {platformLabel[stream.platform]}
                  </button>
                </div>
                <div className={styles.streamHeader}>
                  <span className={styles.streamerLabel}>{stream.displayName}</span>
                </div>
                <p className={styles.streamTitle}>{stream.title}</p>
                <div className={styles.streamMeta}>
                  <span>{formatMeta(stream)}</span>
                  <span>{formatViewerCount(stream.viewerCount)}</span>
                </div>
                <button
                  type="button"
                  className={styles.assignButton}
                  onClick={() => {
                    trackButtonClick('sidebar_assign_stream', {
                      platform: stream.platform,
                      channel_id: stream.id
                    });
                    setPendingStream(stream);
                  }}
                >
                  割り当てる
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
    </>
  );
};
