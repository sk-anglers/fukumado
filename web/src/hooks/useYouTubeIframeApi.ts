let apiReadyPromise: Promise<typeof YT> | null = null;

const loadScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load YouTube Iframe API script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load YouTube Iframe API script'));
    document.head.appendChild(script);
  });

export const loadYouTubeIframeApi = (): Promise<typeof YT> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube Iframe API is only available in browser environment'));
  }

  if (apiReadyPromise) {
    return apiReadyPromise;
  }

  apiReadyPromise = new Promise((resolve, reject) => {
    loadScript().catch(reject);

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (typeof YT !== 'undefined') {
        resolve(YT);
      } else {
        reject(new Error('YouTube Iframe API failed to initialise'));
      }
    };
  });

  return apiReadyPromise;
};
