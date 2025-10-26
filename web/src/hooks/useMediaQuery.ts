import { useState, useEffect } from 'react';

/**
 * メディアクエリの状態を監視するカスタムフック
 * @param query - メディアクエリ文字列（例: '(max-width: 768px)'）
 * @returns クエリがマッチするかどうか
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    // 初期値を設定
    setMatches(mediaQuery.matches);

    // リスナーを登録
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};

// よく使うブレークポイント用のヘルパーフック
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 768px)');
export const useIsTablet = (): boolean => useMediaQuery('(min-width: 769px) and (max-width: 1200px)');
export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 1201px)');
