const inferBackendOrigin = (): string => {
  const envOrigin = import.meta.env.VITE_BACKEND_ORIGIN as string | undefined;
  if (envOrigin) return envOrigin;

  const { origin } = window.location;
  if (origin.includes('5173')) {
    return origin.replace('5173', '4000');
  }
  return origin;
};

export const backendOrigin = inferBackendOrigin();

export const apiUrl = (path: string): string =>
  path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${backendOrigin}${path.startsWith('/') ? path : `/${path}`}`;

export const apiFetch = (input: string, init?: RequestInit): Promise<Response> => {
  return fetch(apiUrl(input), {
    credentials: 'include',
    ...init
  });
};
