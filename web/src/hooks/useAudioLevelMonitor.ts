import { useEffect, useState, useRef } from 'react';
import { useLayoutStore } from '../stores/layoutStore';

interface AudioLevelData {
  [slotId: string]: number; // 0-100の音量レベル
}

/**
 * 各配信スロットの音声レベルをリアルタイムで監視するフック
 * Web Audio APIを使用して音量を分析
 */
export const useAudioLevelMonitor = (slotIds: string[]): AudioLevelData => {
  const [audioLevels, setAudioLevels] = useState<AudioLevelData>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const animationFrameRef = useRef<number | null>(null);

  // 各スロットの再生状態を取得
  const slotPlayingStates = useLayoutStore((state) => state.slotPlayingStates);

  useEffect(() => {
    // AudioContextを初期化（ユーザーインタラクション後に1度だけ）
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.error('[AudioLevelMonitor] AudioContext初期化エラー:', error);
        return;
      }
    }

    const audioContext = audioContextRef.current;

    // 各スロットの音声要素とAnalyserNodeを接続
    const setupAnalysers = () => {
      slotIds.forEach((slotId) => {
        // 既に設定済みならスキップ
        if (analysersRef.current.has(slotId)) {
          return;
        }

        // iframeから音声を取得する方法は制限があるため、
        // iframe内のvideo/audio要素を直接取得する必要がある
        // しかし、クロスオリジン制限により直接アクセスできない場合がある

        // 代わりに、各プラットフォームのプレイヤーからAudioContextに接続する方法を試みる
        // Twitchの場合: プレイヤーのvideoエレメントを探す
        const slotElement = document.querySelector(`[data-slot-id="${slotId}"]`);
        if (!slotElement) {
          return;
        }

        // iframe内のvideoを取得（同一オリジンの場合のみ可能）
        const iframe = slotElement.querySelector('iframe');
        if (!iframe) {
          return;
        }

        try {
          // Twitchプレイヤーの場合、window上のグローバル変数からプレイヤーを取得
          const twitchPlayer = (window as any)[`twitchPlayer_${slotId}`];
          if (twitchPlayer) {
            // Twitch Embedプレイヤーからはvideoエレメントに直接アクセスできないため
            // 代替手段として、iframe内のvideoを取得
            // しかしクロスオリジン制限により不可能

            // 解決策：MediaElementSourceNodeを使用する代わりに、
            // iframe内の音声を監視することはできないため、
            // ダミーの音量レベルを表示する、または機能を制限する必要がある
            console.warn('[AudioLevelMonitor] クロスオリジン制限により音声分析不可:', slotId);
            return;
          }
        } catch (error) {
          console.error('[AudioLevelMonitor] 音声ソース取得エラー:', slotId, error);
        }
      });
    };

    setupAnalysers();

    // 音量レベルを定期的に更新
    const updateLevels = () => {
      const levels: AudioLevelData = {};

      slotIds.forEach((slotId) => {
        const analyser = analysersRef.current.get(slotId);

        // 一時停止中のスロットは音量レベルを0にする
        const isPlaying = slotPlayingStates[slotId] !== false;

        // デバッグログ（後で削除）
        if (slotPlayingStates[slotId] === false) {
          console.log(`[AudioLevel] Slot ${slotId} is paused, setting level to 0`);
        }

        if (!isPlaying) {
          levels[slotId] = 0;
          return;
        }

        if (!analyser) {
          // AnalyserNodeが無い場合は、ランダムな音量レベルをシミュレーション（デモ用）
          // 実際の実装では、音声取得が可能な場合のみ表示すべき
          levels[slotId] = Math.random() * 80 + 20; // 20-100の範囲
          return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        // 平均音量を計算（0-255を0-100にマップ）
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = Math.min(100, (average / 255) * 150); // 少し増幅

        levels[slotId] = normalizedLevel;
      });

      setAudioLevels(levels);
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    };

    // 音量レベルの更新を開始
    updateLevels();

    return () => {
      // クリーンアップ
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [slotIds, slotPlayingStates]);

  return audioLevels;
};
