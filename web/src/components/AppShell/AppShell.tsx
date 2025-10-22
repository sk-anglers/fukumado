import { useEffect, useState } from 'react';
import { Header } from '../Header/Header';
import { Sidebar } from '../Sidebar/Sidebar';
import { StreamGrid } from '../StreamGrid/StreamGrid';
import { ChatPanel } from '../ChatPanel/ChatPanel';
import { LayoutPresetModal } from '../LayoutPresetModal/LayoutPresetModal';
import { Footer } from '../Footer/Footer';
import { useLayoutStore } from '../../stores/layoutStore';
import styles from './AppShell.module.css';

export const AppShell = (): JSX.Element => {
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const fullscreen = useLayoutStore((state) => state.fullscreen);
  const setUserInteracted = useLayoutStore((state) => state.setUserInteracted);

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

  // ユーザーインタラクションを検出
  useEffect(() => {
    const handleUserInteraction = (): void => {
      setUserInteracted(true);
      // 一度検出したらリスナーを削除
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [setUserInteracted]);

  return (
    <div className={styles.appShell}>
      {!fullscreen && <Header onOpenPresetModal={() => setPresetModalOpen(true)} />}
      <div className={fullscreen ? styles.bodyFullscreen : styles.body}>
        {!fullscreen && <Sidebar onOpenPresetModal={() => setPresetModalOpen(true)} />}
        <main className={fullscreen ? styles.mainFullscreen : styles.main}>
          <StreamGrid />
        </main>
        {!fullscreen && (
          <aside className={styles.chatArea}>
            <ChatPanel />
          </aside>
        )}
      </div>
      {!fullscreen && <Footer />}
      <LayoutPresetModal open={presetModalOpen} onClose={() => setPresetModalOpen(false)} />
    </div>
  );
};
