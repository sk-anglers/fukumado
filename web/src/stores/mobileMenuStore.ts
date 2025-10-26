import { create } from 'zustand';

interface MobileMenuState {
  sidebarOpen: boolean;
  chatOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleChat: () => void;
  closeAll: () => void;
}

export const useMobileMenuStore = create<MobileMenuState>()((set) => ({
  sidebarOpen: false,
  chatOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setChatOpen: (open) => set({ chatOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen, chatOpen: false })),
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen, sidebarOpen: false })),
  closeAll: () => set({ sidebarOpen: false, chatOpen: false })
}));
