// YouTube IFrame Player API型定義の拡張

/// <reference types="youtube" />

declare namespace YT {
  // PlayerVarsを拡張
  interface PlayerVars {
    vq?: string; // 画質設定 (hd1080, hd720, large, medium, small など)
  }

  // Playerインターフェースを拡張
  interface Player {
    setPlaybackQuality(suggestedQuality: string): void;
    getPlaybackQuality(): string;
    getAvailableQualityLevels(): string[];
  }

  // Eventsインターフェースを拡張
  interface Events {
    onError?: (event: OnErrorEvent) => void;
  }

  // OnErrorEvent型定義
  interface OnErrorEvent {
    target: Player;
    data: number;
  }
}
