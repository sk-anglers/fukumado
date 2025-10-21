import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useSyncStore } from '../stores/syncStore';
import type { Streamer } from '../types';

interface YouTubeApiResponseItem {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
}

interface YouTubeApiResponse {
  items: YouTubeApiResponseItem[];
}

const mapItemToStreamer = (item: YouTubeApiResponseItem): Streamer => ({
  id: item.id,
  platform: 'youtube',
  title: item.title,
  displayName: item.channelTitle,
  channelId: item.channelId,
  channelTitle: item.channelTitle,
  description: item.description,
  thumbnailUrl: item.thumbnailUrl,
  liveSince: item.publishedAt,
  embedUrl: `https://www.youtube.com/embed/${item.id}?enablejsapi=1`
});

const DEFAULT_QUERY = 'Apex Legends';
const NO_STREAMS_MESSAGE = 'フォロー中のチャンネルでは現在ライブ配信が見つかりませんでした。';

const buildChannelQuery = (channelIds: string[]): string =>
  channelIds.map((id) => `channelId=${id}`).join('&');

const fetchStreamResponse = async (endpoint: string): Promise<YouTubeApiResponse> => {
  const response = await fetch(endpoint, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube streams: ${response.status}`);
  }
  return await response.json();
};

export const useYoutubeStreams = (channelIds: string[] = [], fallbackQuery: string = DEFAULT_QUERY): void => {
  const setAvailableStreamsForPlatform = useLayoutStore((state) => state.setAvailableStreamsForPlatform);
  const setStreamsLoading = useLayoutStore((state) => state.setStreamsLoading);
  const setStreamsError = useLayoutStore((state) => state.setStreamsError);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const syncSettings = useSyncStore((state) => state.settings);
  const setSyncing = useSyncStore((state) => state.setSyncing);
  const setLastSyncTime = useSyncStore((state) => state.setLastSyncTime);
  const manualSyncTrigger = useSyncStore((state) => state.manualSyncTrigger);

  const previousStreamIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let intervalId: NodeJS.Timeout | null = null;

    const showNoStreams = (): void => {
      setAvailableStreamsForPlatform('youtube', []);
      setStreamsError(NO_STREAMS_MESSAGE);
    };

    const applyStreams = (items: YouTubeApiResponseItem[]): void => {
      const currentStreamIds = new Set(items.map((item) => item.id));

      // 配信リストに変更があるかチェック（新規追加または配信終了）
      const hasChanges =
        currentStreamIds.size !== previousStreamIdsRef.current.size ||
        Array.from(currentStreamIds).some((id) => !previousStreamIdsRef.current.has(id));

      // 変更がある場合のみストアを更新
      if (hasChanges) {
        const mapped = items.map(mapItemToStreamer);
        setAvailableStreamsForPlatform('youtube', mapped);
        console.log('[YouTube] 配信リストに変更を検出、ストアを更新しました');
      } else {
        console.log('[YouTube] 配信リストに変更なし、ストア更新をスキップしました');
      }

      // 新規配信を検出して通知を追加
      const newStreams = items.filter((item) => !previousStreamIdsRef.current.has(item.id));

      newStreams.forEach((item) => {
        addNotification({
          type: 'stream_started',
          platform: 'youtube',
          channelId: item.channelId,
          channelName: item.channelTitle,
          streamId: item.id,
          streamTitle: item.title,
          thumbnailUrl: item.thumbnailUrl
        });
      });

      previousStreamIdsRef.current = currentStreamIds;
    };

    const run = async (): Promise<void> => {
      console.log('[YouTube配信取得] 開始');
      console.log('[YouTube] フォロー中のチャンネル数:', channelIds.length);
      console.log('[YouTube] チャンネルID:', channelIds);

      setSyncing(true);
      setStreamsLoading(true);
      setStreamsError(undefined);

      const tryChannelFetch = async (): Promise<boolean> => {
        if (channelIds.length === 0) {
          console.log('[YouTube] チャンネルが0件のためスキップ');
          return false;
        }
        try {
          const endpoint = `/api/youtube/live?${buildChannelQuery(channelIds)}`;
          console.log('[YouTube] API呼び出し:', endpoint);
          const data = await fetchStreamResponse(endpoint);
          console.log('[YouTube] API レスポンス:', data);
          console.log('[YouTube] 取得した配信数:', data.items.length);
          if (cancelled) return true;
          if (data.items.length > 0) {
            applyStreams(data.items);
            return true;
          }
          return false;
        } catch (error) {
          console.error('[YouTube] API呼び出しエラー:', error);
          if (!cancelled) {
            setStreamsError(NO_STREAMS_MESSAGE);
          }
          return false;
        }
      };

      const tryFallbackFetch = async (): Promise<void> => {
        try {
          const data = await fetchStreamResponse(`/api/youtube/live?q=${encodeURIComponent(fallbackQuery)}`);
          if (!cancelled) {
            if (data.items.length > 0) {
              applyStreams(data.items);
              setStreamsError(undefined);
            } else {
              showNoStreams();
            }
          }
        } catch {
          if (!cancelled) {
            showNoStreams();
          }
        }
      };

      try {
        const loadedFromChannels = await tryChannelFetch();
        if (!loadedFromChannels) {
          await tryFallbackFetch();
        }
      } finally {
        if (!cancelled) {
          setStreamsLoading(false);
          setSyncing(false);
          setLastSyncTime(Date.now());
        }
      }
    };

    // 初回実行
    run().catch(() => {
      if (!cancelled) {
        showNoStreams();
        setStreamsLoading(false);
        setSyncing(false);
        setLastSyncTime(Date.now());
      }
    });

    // 自動同期が有効な場合、定期実行を設定
    if (syncSettings.enabled) {
      intervalId = setInterval(() => {
        if (!cancelled) {
          run().catch(() => {
            if (!cancelled) {
              showNoStreams();
              setStreamsLoading(false);
              setSyncing(false);
            }
          });
        }
      }, syncSettings.interval);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [channelIds, fallbackQuery, syncSettings.enabled, syncSettings.interval, manualSyncTrigger, setAvailableStreamsForPlatform, setStreamsError, setStreamsLoading, setSyncing, setLastSyncTime, addNotification]);
};
