import { create } from 'zustand';

interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl?: string;
}

interface AuthState {
  // Google (YouTube) authentication
  authenticated: boolean;
  loading: boolean;
  error?: string;
  user?: AuthUser;
  setStatus: (data: { authenticated: boolean; user?: AuthUser; error?: string }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
  // Twitch authentication
  twitchAuthenticated: boolean;
  twitchLoading: boolean;
  twitchError?: string;
  twitchUser?: TwitchUser;
  setTwitchStatus: (data: { authenticated: boolean; user?: TwitchUser; error?: string }) => void;
  setTwitchLoading: (loading: boolean) => void;
  setTwitchError: (error?: string) => void;
  // Session ID for token storage
  sessionId?: string;
  setSessionId: (sessionId: string) => void;
  clearSessionId: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Google (YouTube) authentication
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
  setError: (error) => set({ error }),
  // Twitch authentication
  twitchAuthenticated: false,
  twitchLoading: false,
  twitchError: undefined,
  twitchUser: undefined,
  setTwitchStatus: ({ authenticated, user, error }) =>
    set({
      twitchAuthenticated: authenticated,
      twitchUser: user,
      twitchError: error ?? undefined
    }),
  setTwitchLoading: (loading) => set({ twitchLoading: loading }),
  setTwitchError: (error) => set({ twitchError: error }),
  // Session ID for token storage
  sessionId: undefined,
  setSessionId: (sessionId) => set({ sessionId }),
  clearSessionId: () => set({ sessionId: undefined })
}));
