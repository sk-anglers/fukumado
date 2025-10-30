import { useMaintenanceStore } from '../stores/maintenanceStore';

export const backendOrigin =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (window.location.origin.includes('5173')
    ? window.location.origin.replace('5173', '4000')
    : window.location.origin);

export const apiUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/auth') || path.startsWith('/api/')) {
    return `${backendOrigin}${path}`;
  }
  return path;
};

// バイパストークンをURLパラメータから取得
const getBypassToken = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('bypass');
};

export const apiFetch = async (input: string, init?: RequestInit): Promise<Response> => {
  const url = apiUrl(input);

  // バイパストークンがある場合はURLに追加
  const bypassToken = getBypassToken();
  const finalUrl = bypassToken
    ? `${url}${url.includes('?') ? '&' : '?'}bypass=${bypassToken}`
    : url;

  const response = await fetch(finalUrl, {
    credentials: 'include',
    ...init
  });

  // 503エラーの場合、メンテナンス情報を抽出してストアに保存
  if (response.status === 503) {
    try {
      const data = await response.clone().json();
      if (data.error === 'Service Unavailable') {
        useMaintenanceStore.getState().setMaintenance({
          enabled: true,
          message: data.message || 'サービスは現在メンテナンス中です。',
          enabledAt: data.enabledAt,
          duration: data.duration,
          scheduledEndAt: data.scheduledEndAt
        });
      }
    } catch (error) {
      console.error('[API] Failed to parse maintenance response:', error);
    }
  }

  return response;
};
