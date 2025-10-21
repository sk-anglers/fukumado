import { useEffect, useRef, useMemo } from "react";
import { AppShell } from "./components/AppShell/AppShell";
import { useYoutubeStreams } from "./hooks/useYoutubeStreams";
import { useTwitchStreams } from "./hooks/useTwitchStreams";
import { useTwitchChat } from "./hooks/useTwitchChat";
import { useLayoutStore } from "./stores/layoutStore";
import { useUserStore } from "./stores/userStore";
import { useAuthStatus } from "./hooks/useAuthStatus";
import { useTwitchAuthStatus } from "./hooks/useTwitchAuthStatus";
import { useAuthStore } from "./stores/authStore";
import { apiFetch } from "./utils/api";

function App(): JSX.Element {
  const ensureSelection = useLayoutStore((state) => state.ensureSelection);
  const slots = useLayoutStore((state) => state.slots);
  const followedChannels = useUserStore((state) => state.followedChannels);
  const followedChannelIds = useUserStore((state) =>
    state.followedChannels.filter((item) => item.platform === "youtube").map((item) => item.channelId)
  );
  const twitchFollowedChannelIds = useUserStore((state) =>
    state.followedChannels.filter((item) => item.platform === "twitch").map((item) => item.channelId)
  );
  const addFollowedChannels = useUserStore((state) => state.addFollowedChannels);
  const authenticated = useAuthStore((state) => state.authenticated);
  const twitchAuthenticated = useAuthStore((state) => state.twitchAuthenticated);

  console.log('[App] 全フォローチャンネル数:', followedChannels.length);
  console.log('[App] 全フォローチャンネル:', followedChannels);
  console.log('[App] YouTubeチャンネル数:', followedChannelIds.length);
  console.log('[App] YouTubeチャンネルID:', followedChannelIds);
  console.log('[App] Twitchチャンネル数:', twitchFollowedChannelIds.length);
  console.log('[App] TwitchチャンネルID:', twitchFollowedChannelIds);

  // 現在視聴中のTwitchチャンネルの情報を取得
  const activeTwitchChannels = useMemo(() => {
    const channels: Array<{ login: string; displayName: string }> = [];
    for (const slot of slots) {
      if (slot.assignedStream?.platform === 'twitch' && slot.assignedStream.embedUrl) {
        // embedUrlから channel パラメータを抽出
        const match = slot.assignedStream.embedUrl.match(/[?&]channel=([^&]+)/);
        if (match && match[1]) {
          channels.push({
            login: match[1],
            displayName: slot.assignedStream.displayName
          });
        }
      }
    }
    console.log('[App] 視聴中のTwitchチャンネル:', channels);
    return channels;
  }, [slots]);

  useAuthStatus();
  useTwitchAuthStatus();
  useYoutubeStreams(followedChannelIds);
  useTwitchStreams(twitchFollowedChannelIds);
  useTwitchChat(activeTwitchChannels);

  useEffect(() => {
    ensureSelection();
  }, [ensureSelection]);

  const hasSyncedSubscriptions = useRef(false);
  const hasSyncedTwitchSubscriptions = useRef(false);

  useEffect(() => {
    const syncSubscriptions = async (): Promise<void> => {
      if (!authenticated || hasSyncedSubscriptions.current) return;
      try {
        const response = await apiFetch("/api/youtube/subscriptions");
        if (!response.ok) {
          throw new Error(`購読チャンネルの取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (Array.isArray(data.items)) {
          const channels = data.items.map((item: { id: string; title: string }) => ({
            platform: "youtube" as const,
            channelId: item.id,
            label: item.title
          }));
          addFollowedChannels(channels);
          hasSyncedSubscriptions.current = true;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    };
    syncSubscriptions();
  }, [authenticated, addFollowedChannels]);

  useEffect(() => {
    if (!authenticated) {
      hasSyncedSubscriptions.current = false;
    }
  }, [authenticated]);

  useEffect(() => {
    const syncTwitchSubscriptions = async (): Promise<void> => {
      if (!twitchAuthenticated || hasSyncedTwitchSubscriptions.current) return;
      try {
        const response = await apiFetch("/api/twitch/subscriptions");
        if (!response.ok) {
          throw new Error(`Twitchフォローチャンネルの取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (Array.isArray(data.items)) {
          const channels = data.items.map((item: { id: string; displayName: string }) => ({
            platform: "twitch" as const,
            channelId: item.id,
            label: item.displayName
          }));
          addFollowedChannels(channels);
          hasSyncedTwitchSubscriptions.current = true;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    };
    syncTwitchSubscriptions();
  }, [twitchAuthenticated, addFollowedChannels]);

  useEffect(() => {
    if (!twitchAuthenticated) {
      hasSyncedTwitchSubscriptions.current = false;
    }
  }, [twitchAuthenticated]);

  return <AppShell />;
}

export default App;

