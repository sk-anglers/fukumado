/**
 * Window拡張型定義
 * Google Analytics (gtag.js) と Google Tag Manager (dataLayer) の型定義
 */

// Google Analytics gtag関数の型定義
type GtagCommand = 'config' | 'set' | 'event' | 'consent';

interface Gtag {
  (command: 'config', targetId: string, config?: Record<string, any>): void;
  (command: 'set', config: Record<string, any>): void;
  (command: 'event', eventName: string, eventParams?: Record<string, any>): void;
  (command: 'consent', consentArg: string, consentParams: Record<string, any>): void;
}

// Google Tag Manager dataLayer の型定義
interface DataLayerEvent {
  event: string;
  [key: string]: any;
}

// Window オブジェクトの拡張
declare global {
  interface Window {
    gtag: Gtag;
    dataLayer: DataLayerEvent[];
  }
}

export {};
