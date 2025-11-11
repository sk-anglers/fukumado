import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { apiFetch } from "../utils/api";

export const useTwitchAuthStatus = (): void => {
  const setTwitchStatus = useAuthStore((state) => state.setTwitchStatus);
  const setTwitchLoading = useAuthStore((state) => state.setTwitchLoading);
  const setTwitchError = useAuthStore((state) => state.setTwitchError);
  const setSessionId = useAuthStore((state) => state.setSessionId);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async (): Promise<void> => {
      setTwitchLoading(true);
      setTwitchError(undefined);
      try {
        const response = await apiFetch("/auth/twitch/status");
        if (!response.ok) {
          throw new Error(`Twitchステータス取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (cancelled) return;
        setTwitchStatus({
          authenticated: Boolean(data.authenticated),
          user: data.user,
          error: undefined
        });

        // Safari対応: 認証成功時にsessionIDを取得
        if (data.authenticated) {
          try {
            const sessionResponse = await apiFetch("/auth/session");
            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              if (sessionData.sessionId) {
                console.log('[useTwitchAuthStatus] Setting sessionId:', sessionData.sessionId);
                setSessionId(sessionData.sessionId);
              }
            }
          } catch (error) {
            console.error('[useTwitchAuthStatus] Failed to fetch sessionId:', error);
          }
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "不明なエラー";
        setTwitchError(message);
        setTwitchStatus({ authenticated: false, user: undefined, error: message });
      } finally {
        if (!cancelled) {
          setTwitchLoading(false);
        }
      }
    };

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [setTwitchError, setTwitchLoading, setTwitchStatus, setSessionId]);
};
