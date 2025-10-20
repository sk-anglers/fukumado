import { useEffect } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
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
  embedUrl: https://www.youtube.com/embed/?enablejsapi=1
});

const DEFAULT_QUERY = 'Apex Legends';
const NO_STREAMS_MESSAGE = 'フォロー中のチャンネルでは現在ライブ配信が見つかりませんでした。';

const buildChannelQuery = (channelIds: string[]): string =>
  channelIds.map((id) => channelId=).join('&');

const fetchStreamResponse = async (endpoint: string): Promise<YouTubeApiResponse> => {
  const response = await fetch(endpoint, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(Failed to fetch YouTube streams:  );
  }
  return await response.json();
};

export const useYoutubeStreams = (channelIds: string[] = [], fallbackQuery: string = DEFAULT_QUERY): void => {
  const setAvailableStreamsForPlatform = useLayoutStore((state) => state.setAvailableStreamsForPlatform);
  const setStreamsLoading = useLayoutStore((state) => state.setStreamsLoading);
  const setStreamsError = useLayoutStore((state) => state.setStreamsError);

  useEffect(() => {
    let cancelled = false;

    const showNoStreams = (): void => {
      setAvailableStreamsForPlatform('youtube', []);
      setStreamsError(NO_STREAMS_MESSAGE);
    };

    const applyStreams = (items: YouTubeApiResponseItem[]): void => {
      const mapped = items.map(mapItemToStreamer);
      setAvailableStreamsForPlatform('youtube', mapped);
    };

    const run = async (): Promise<void> => {
      setStreamsLoading(true);
      setStreamsError(undefined);

      const tryChannelFetch = async (): Promise<boolean> => {
        if (channelIds.length === 0) return false;
        try {
          const data = await fetchStreamResponse(/api/youtube/live?);
          if (cancelled) return true;
          if (data.items.length > 0) {
            applyStreams(data.items);
            return true;
          }
          return false;
        } catch {
          if (!cancelled) {
            setStreamsError(NO_STREAMS_MESSAGE);
          }
          return false;
        }
      };

      const tryFallbackFetch = async (): Promise<void> => {
        try {
          const data = await fetchStreamResponse(/api/youtube/live?q=);
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
        }
      }
    };

    run().catch(() => {
      if (!cancelled) {
        showNoStreams();
        setStreamsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [channelIds, fallbackQuery, setAvailableStreamsForPlatform, setStreamsError, setStreamsLoading]);
};
