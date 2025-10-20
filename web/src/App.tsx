import { useEffect, useRef } from 'react';
import { AppShell } from './components/AppShell/AppShell';
import { useYoutubeStreams } from './hooks/useYoutubeStreams';
import { useLayoutStore } from './stores/layoutStore';
import { useUserStore } from './stores/userStore';
import { useAuthStatus } from './hooks/useAuthStatus';
import { useAuthStore } from './stores/authStore';

function App(): JSX.Element {
  const ensureSelection = useLayoutStore((state) => state.ensureSelection);
  const followedChannelIds = useUserStore((state) =>
    state.followedChannels.filter((item) => item.platform === 'youtube').map((item) => item.channelId)
  );
  const addFollowedChannels = useUserStore((state) => state.addFollowedChannels);
  const authenticated = useAuthStore((state) => state.authenticated);

  useAuthStatus();
  useYoutubeStreams(followedChannelIds);

  useEffect(() => {
    ensureSelection();
  }, [ensureSelection]);

  const hasSyncedSubscriptions = useRef(false);

  useEffect(() => {
    const syncSubscriptions = async (): Promise<void> => {
      if (!authenticated || hasSyncedSubscriptions.current) return;
      try {
        const response = await fetch('/api/youtube/subscriptions');
        if (!response.ok) {
          throw new Error(`購読チャンネルの取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (Array.isArray(data.items)) {
          const channels = data.items.map((item: { id: string; title: string }) => ({
            platform: 'youtube' as const,
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

  return <AppShell />;
}

export default App;
