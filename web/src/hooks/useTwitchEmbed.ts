// Twitch Embed API型定義
export interface TwitchPlayerOptions {
  width?: string | number;
  height?: string | number;
  channel?: string;
  video?: string;
  collection?: string;
  parent?: string[];
  autoplay?: boolean;
  muted?: boolean;
  time?: string;
}

export interface TwitchQuality {
  group: string;
  name: string;
}

export interface TwitchPlayer {
  play(): void;
  pause(): void;
  setVolume(volume: number): void;
  getVolume(): number;
  setMuted(muted: boolean): void;
  getMuted(): boolean;
  setChannel(channel: string): void;
  setVideo(videoId: string): void;
  setCollection(collectionId: string, videoId: string): void;
  getQualities(): TwitchQuality[];
  setQuality(quality: string): void;
  getQuality(): string;
  addEventListener(event: string, callback: () => void): void;
  removeEventListener(event: string, callback: () => void): void;
  destroy(): void;
}

export interface TwitchEmbedAPI {
  Player: new (elementId: string | HTMLElement, options: TwitchPlayerOptions) => TwitchPlayer;
}

declare global {
  interface Window {
    Twitch?: TwitchEmbedAPI;
  }
}

let apiReadyPromise: Promise<TwitchEmbedAPI> | null = null;

const loadScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://embed.twitch.tv/embed/v1.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Twitch Embed API script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://embed.twitch.tv/embed/v1.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Twitch Embed API script'));
    document.head.appendChild(script);
  });

export const loadTwitchEmbedApi = (): Promise<TwitchEmbedAPI> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Twitch Embed API is only available in browser environment'));
  }

  if (apiReadyPromise) {
    return apiReadyPromise;
  }

  apiReadyPromise = new Promise((resolve, reject) => {
    loadScript()
      .then(() => {
        // Twitchオブジェクトが利用可能になるまで少し待つ
        const checkTwitch = (): void => {
          if (typeof window.Twitch !== 'undefined') {
            resolve(window.Twitch);
          } else {
            setTimeout(checkTwitch, 50);
          }
        };
        checkTwitch();
      })
      .catch(reject);
  });

  return apiReadyPromise;
};
