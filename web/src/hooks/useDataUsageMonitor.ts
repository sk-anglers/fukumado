import { useEffect, useRef } from 'react';
import { useDataUsageStore } from '../stores/dataUsageStore';

/**
 * Resource Timing APIを使用してデータ転送量を監視するフック
 * ブラウザがダウンロードしたリソースのサイズを定期的に集計します
 */
export const useDataUsageMonitor = (): void => {
  const addUsage = useDataUsageStore((state) => state.addUsage);
  const processedResourcesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Resource Timing APIでリソースのサイズを測定
    const measureResources = (): void => {
      try {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

        entries.forEach((entry) => {
          const resourceKey = `${entry.name}-${entry.startTime}`;

          // 既に処理済みのリソースはスキップ
          if (processedResourcesRef.current.has(resourceKey)) {
            return;
          }

          // transferSize: 実際に転送されたバイト数（ヘッダー含む）
          // encodedBodySize: 圧縮された本体のサイズ
          // decodedBodySize: 解凍後の本体のサイズ
          const transferSize = entry.transferSize;

          // transferSize が 0 の場合はキャッシュから読み込まれた可能性が高い
          if (transferSize > 0) {
            addUsage(transferSize);
          }

          // 処理済みとしてマーク
          processedResourcesRef.current.add(resourceKey);
        });

        // メモリ節約のため、古いエントリをクリア（最新500件のみ保持）
        if (processedResourcesRef.current.size > 500) {
          const keysArray = Array.from(processedResourcesRef.current);
          const toRemove = keysArray.slice(0, keysArray.length - 500);
          toRemove.forEach((key) => processedResourcesRef.current.delete(key));
        }
      } catch (error) {
        console.error('[DataUsage] リソース測定エラー:', error);
      }
    };

    // 初回測定
    measureResources();

    // 5秒ごとに新しいリソースをチェック
    const interval = setInterval(measureResources, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [addUsage]);
};
