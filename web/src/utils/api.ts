import { useMaintenanceStore } from '../stores/maintenanceStore';

export const backendOrigin =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (window.location.origin.includes('5173')
    ? window.location.origin.replace('5173', '4000')
    : // 本番環境フォールバック: ドメインに応じて適切なAPIエンドポイントを推測
      window.location.origin.includes('beta.fukumado.jp')
      ? 'https://beta-api.fukumado.jp'
      : window.location.origin.includes('fukumado.jp')
      ? 'https://api.fukumado.jp'
      : window.location.origin);

// デバッグ用にグローバルに公開
(window as any).__BACKEND_ORIGIN__ = backendOrigin;

// APIログを記録
const logApiRequest = (method: string, url: string, status?: number, error?: string) => {
  const event = new CustomEvent('api-log', {
    detail: {
      timestamp: new Date().toLocaleTimeString('ja-JP'),
      method,
      url,
      status,
      error
    }
  });
  window.dispatchEvent(event);
};

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

  const method = init?.method || 'GET';

  // リクエストをログに記録
  logApiRequest(method, finalUrl);

  let response: Response;
  try {
    response = await fetch(finalUrl, {
      credentials: 'include',
      ...init
    });

    // レスポンスをログに記録
    logApiRequest(method, finalUrl, response.status);
  } catch (error) {
    // エラーをログに記録
    logApiRequest(method, finalUrl, undefined, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }

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
  } else if (response.ok) {
    // 正常なレスポンス（200-299）の場合、メンテナンスストアをクリア
    // WebSocketで通知が来る前に503から復帰した場合の補助的対策
    const maintenanceState = useMaintenanceStore.getState();
    if (maintenanceState.enabled) {
      console.log('[API] Clearing maintenance mode (received OK response)');
      maintenanceState.clearMaintenance();
    }
  }

  return response;
};
