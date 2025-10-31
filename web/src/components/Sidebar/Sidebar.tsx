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
import { apiUrl } from "../../utils/api";
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

  const isMobile = useIsMobile();
  const setSidebarOpen = useMobileMenuStore((state) => state.setSidebarOpen);

  const handleTwitchLogin = (): void => {
    const authWindow = window.open(
      apiUrl('/auth/twitch'),
      'twitch-oauth',
      'width=500,height=650,menubar=no,toolbar=no'
    );
    if (!authWindow) {
      return;
    }
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
