import { useEffect, useState } from 'react';
import { Header } from '../Header/Header';
import { Sidebar } from '../Sidebar/Sidebar';
import { StreamGrid } from '../StreamGrid/StreamGrid';
import { ChatPanel } from '../ChatPanel/ChatPanel';
import { LayoutPresetModal } from '../LayoutPresetModal/LayoutPresetModal';
import { GlobalControls } from '../GlobalControls/GlobalControls';
import { useLayoutStore } from '../../stores/layoutStore';
import styles from './AppShell.module.css';

export const AppShell = (): JSX.Element => {
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const fullscreen = useLayoutStore((state) => state.fullscreen);

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      const element = document.fullscreenElement;
      if (!element && fullscreen) {
        useLayoutStore.getState().setFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [fullscreen]);

  return (
    <div className={styles.appShell}>
      {!fullscreen && <Header onOpenPresetModal={() => setPresetModalOpen(true)} />}
      <div className={fullscreen ? styles.bodyFullscreen : styles.body}>
        {!fullscreen && <Sidebar onOpenPresetModal={() => setPresetModalOpen(true)} />}
        <main className={fullscreen ? styles.mainFullscreen : styles.main}>
          <StreamGrid />
          {!fullscreen && <GlobalControls onOpenPresetModal={() => setPresetModalOpen(true)} />}
        </main>
        {!fullscreen && (
          <aside className={styles.chatArea}>
            <ChatPanel />
          </aside>
        )}
      </div>
      <LayoutPresetModal open={presetModalOpen} onClose={() => setPresetModalOpen(false)} />
    </div>
  );
};
