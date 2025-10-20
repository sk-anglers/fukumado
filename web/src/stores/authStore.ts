import { create } from 'zustand';

interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  error?: string;
  user?: AuthUser;
  setStatus: (data: { authenticated: boolean; user?: AuthUser; error?: string }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authenticated: false,
  loading: false,
  error: undefined,
  user: undefined,
  setStatus: ({ authenticated, user, error }) =>
    set({
      authenticated,
      user,
      error: error ?? undefined
    }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error })
}));
