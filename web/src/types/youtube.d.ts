export {};

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }

  namespace YT {
    class Player {
      constructor(elementId: string | HTMLElement, options: PlayerOptions);
      destroy(): void;
      playVideo(): void;
      pauseVideo(): void;
      mute(): void;
      unMute(): void;
      isMuted(): boolean;
      setVolume(volume: number): void;
      getVolume(): number;
    }

    interface PlayerOptions {
      videoId: string;
      playerVars?: {
        autoplay?: 0 | 1;
        controls?: 0 | 1;
        mute?: 0 | 1;
        rel?: 0 | 1;
        modestbranding?: 0 | 1;
        playsinline?: 0 | 1;
        origin?: string;
      };
      events?: {
        onReady?: (event: { target: Player }) => void;
      };
    }
  }
}
