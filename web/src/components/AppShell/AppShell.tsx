import { useState } from 'react';
import { Header } from '../Header/Header';
import { Sidebar } from '../Sidebar/Sidebar';
import { StreamGrid } from '../StreamGrid/StreamGrid';
import { ChatPanel } from '../ChatPanel/ChatPanel';
import { LayoutPresetModal } from '../LayoutPresetModal/LayoutPresetModal';
import { GlobalControls } from '../GlobalControls/GlobalControls';
import styles from './AppShell.module.css';

export const AppShell = (): JSX.Element => {
  const [presetModalOpen, setPresetModalOpen] = useState(false);

  return (
    <div className={styles.appShell}>
      <Header onOpenPresetModal={() => setPresetModalOpen(true)} />
      <div className={styles.body}>
        <Sidebar onOpenPresetModal={() => setPresetModalOpen(true)} />
        <main className={styles.main}>
          <StreamGrid />
          <GlobalControls onOpenPresetModal={() => setPresetModalOpen(true)} />
        </main>
        <aside className={styles.chatArea}>
          <ChatPanel />
        </aside>
      </div>
      <LayoutPresetModal open={presetModalOpen} onClose={() => setPresetModalOpen(false)} />
    </div>
  );
};
