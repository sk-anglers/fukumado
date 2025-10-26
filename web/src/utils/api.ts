const backendOrigin =
  (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ??
  (window.location.origin.includes('5173')
    ? window.location.origin.replace('5173', '4000')
    : window.location.origin);

export const apiUrl = (path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/auth')) {
    return `${backendOrigin}${path}`;
  }
  return path;
};

export const apiFetch = (input: string, init?: RequestInit): Promise<Response> => {
  const url = apiUrl(input);
  return fetch(url, {
    credentials: 'include',
    ...init
  });
};
