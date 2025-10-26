import { useEffect, useState } from 'react';
import { Header } from '../Header/Header';
import { Sidebar } from '../Sidebar/Sidebar';
import { StreamGrid } from '../StreamGrid/StreamGrid';
import { ChatPanel } from '../ChatPanel/ChatPanel';
import { LayoutPresetModal } from '../LayoutPresetModal/LayoutPresetModal';
import { Footer } from '../Footer/Footer';
import { ToastContainer } from '../Toast/Toast';
import { useLayoutStore } from '../../stores/layoutStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useMobileMenuStore } from '../../stores/mobileMenuStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useDataUsageMonitor } from '../../hooks/useDataUsageMonitor';
import styles from './AppShell.module.css';

export const AppShell = (): JSX.Element => {
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const fullscreen = useLayoutStore((state) => state.fullscreen);
  const setUserInteracted = useLayoutStore((state) => state.setUserInteracted);
  const toasts = useNotificationStore((state) => state.toasts);
  const removeToast = useNotificationStore((state) => state.removeToast);

  const isMobile = useIsMobile();
  const { sidebarOpen, chatOpen, closeAll } = useMobileMenuStore();

  // データ使用量の監視を開始
  useDataUsageMonitor();

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
        {!fullscreen && (
          <>
            {/* デスクトップ: 通常表示 / モバイル: オーバーレイ表示 */}
            <div className={isMobile && sidebarOpen ? styles.sidebarOverlay : styles.sidebarNormal}>
              <Sidebar onOpenPresetModal={() => setPresetModalOpen(true)} />
            </div>
            {/* モバイルでサイドバーが開いている時のバックドロップ */}
            {isMobile && sidebarOpen && (
              <div className={styles.backdrop} onClick={closeAll} />
            )}
          </>
        )}
        <main className={fullscreen ? styles.mainFullscreen : styles.main}>
          <StreamGrid />
        </main>
        {!fullscreen && (
          <>
            {/* デスクトップ: 通常表示 / モバイル: オーバーレイ表示 */}
            <aside className={isMobile && chatOpen ? styles.chatOverlay : styles.chatArea}>
              <ChatPanel />
            </aside>
            {/* モバイルでチャットが開いている時のバックドロップ */}
            {isMobile && chatOpen && (
              <div className={styles.backdrop} onClick={closeAll} />
            )}
          </>
        )}
      </div>
      {!fullscreen && <Footer />}
      <LayoutPresetModal open={presetModalOpen} onClose={() => setPresetModalOpen(false)} />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};
