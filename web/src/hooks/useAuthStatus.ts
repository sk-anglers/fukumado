import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuthStatus = (): void => {
  const setStatus = useAuthStore((state) => state.setStatus);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setError = useAuthStore((state) => state.setError);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);
      try {
        const response = await fetch('/auth/status');
        if (!response.ok) {
          throw new Error(`ステータス取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (cancelled) return;
        setStatus({
          authenticated: Boolean(data.authenticated),
          user: data.user,
          error: undefined
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '不明なエラー';
        setError(message);
        setStatus({ authenticated: false, user: undefined, error: message });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [setError, setLoading, setStatus]);
};
