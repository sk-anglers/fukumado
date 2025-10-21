import { useMemo } from "react";
import clsx from "clsx";
import { type Streamer } from "../../types";
import { useLayoutStore } from "../../stores/layoutStore";
import { SlotSelectionModal } from "../SlotSelectionModal/SlotSelectionModal";
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
    searchQuery,
    pendingStream,
    setPendingStream
  } = useLayoutStore((state) => ({
    availableStreams: state.availableStreams,
    streamsLoading: state.streamsLoading,
    streamsError: state.streamsError,
    searchQuery: state.searchQuery,
    pendingStream: state.pendingStream,
    setPendingStream: state.setPendingStream
  }));


  const filteredStreams = useMemo(() => {
    console.log('[Sidebar] availableStreams数:', availableStreams.length);
    console.log('[Sidebar] availableStreams:', availableStreams);
    console.log('[Sidebar] searchQuery:', searchQuery);

    if (!searchQuery.trim()) {
      console.log('[Sidebar] 検索クエリなし、全配信を返す');
      return availableStreams;
    }
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = availableStreams.filter((stream) => {
      const displayName = stream.displayName?.toLowerCase() || "";
      const title = stream.title?.toLowerCase() || "";
      const channelTitle = stream.channelTitle?.toLowerCase() || "";
      return displayName.includes(lowerQuery) || title.includes(lowerQuery) || channelTitle.includes(lowerQuery);
    });
    console.log('[Sidebar] フィルタ後の配信数:', filtered.length);
    return filtered;
  }, [availableStreams, searchQuery]);

  return (
    <>
      {pendingStream && (
        <SlotSelectionModal
          stream={pendingStream}
          onClose={() => setPendingStream(null)}
        />
      )}
      <aside className={styles.sidebar}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>フォロー中の配信</h2>
        </div>
        <div className={styles.streamList}>
          {(() => {
            console.log('[Sidebar レンダリング] streamsLoading:', streamsLoading);
            console.log('[Sidebar レンダリング] streamsError:', streamsError);
            console.log('[Sidebar レンダリング] filteredStreams.length:', filteredStreams.length);
            return null;
          })()}
          {streamsLoading ? (
            <div className={styles.streamListMessage}>配信情報を取得しています…</div>
          ) : filteredStreams.length === 0 ? (
            streamsError ? (
              <div className={clsx(styles.streamListMessage, styles.streamListMessageError)}>
                配信情報の取得に失敗しました：{streamsError}
              </div>
            ) : (
              <div className={styles.streamListMessage}>
                {searchQuery ? "検索結果が見つかりません。" : "現在表示できる配信が見つかりません。"}
              </div>
            )
          ) : (
            filteredStreams.map((stream) => (
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
