import { useEffect } from 'react';
import { AppShell } from './components/AppShell/AppShell';
import { useYoutubeStreams } from './hooks/useYoutubeStreams';
import { useLayoutStore } from './stores/layoutStore';
import { useUserStore } from './stores/userStore';

function App(): JSX.Element {
  const ensureSelection = useLayoutStore((state) => state.ensureSelection);
  const followedChannelIds = useUserStore((state) =>
    state.followedChannels.filter((item) => item.platform === 'youtube').map((item) => item.channelId)
  );
  useYoutubeStreams(followedChannelIds);

  useEffect(() => {
    ensureSelection();
  }, [ensureSelection]);

  return <AppShell />;
}

export default App;
