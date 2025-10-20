import { useEffect } from 'react';
import { AppShell } from './components/AppShell/AppShell';
import { useYoutubeStreams } from './hooks/useYoutubeStreams';
import { useLayoutStore } from './stores/layoutStore';

function App(): JSX.Element {
  const ensureSelection = useLayoutStore((state) => state.ensureSelection);
  useYoutubeStreams();

  useEffect(() => {
    ensureSelection();
  }, [ensureSelection]);

  return <AppShell />;
}

export default App;
