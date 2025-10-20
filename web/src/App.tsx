import { useEffect } from 'react';
import { AppShell } from './components/AppShell/AppShell';
import { useLayoutStore } from './stores/layoutStore';

function App(): JSX.Element {
  const ensureSelection = useLayoutStore((state) => state.ensureSelection);

  useEffect(() => {
    ensureSelection();
  }, [ensureSelection]);

  return <AppShell />;
}

export default App;
