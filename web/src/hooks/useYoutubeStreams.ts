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
  embedUrl: `https://www.youtube.com/embed/${item.id}?enablejsapi=1`
});

const DEFAULT_QUERY = 'Apex Legends';

export const useYoutubeStreams = (query: string = DEFAULT_QUERY): void => {
  const setAvailableStreams = useLayoutStore((state) => state.setAvailableStreams);
  const setStreamsLoading = useLayoutStore((state) => state.setStreamsLoading);
  const setStreamsError = useLayoutStore((state) => state.setStreamsError);

  useEffect(() => {
    let ignore = false;

    const fetchStreams = async (): Promise<void> => {
      setStreamsLoading(true);
      setStreamsError(undefined);
      try {
        const response = await fetch(`/api/youtube/live?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch YouTube streams: ${response.status} ${response.statusText}`);
        }
        const data = (await response.json()) as YouTubeApiResponse;
        if (ignore) return;
        const streams = data.items.map(mapItemToStreamer);
        setAvailableStreams(streams);
      } catch (error) {
        if (ignore) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setStreamsError(message);
        setAvailableStreams([]);
      } finally {
        if (!ignore) {
          setStreamsLoading(false);
        }
      }
    };

    fetchStreams();

    return () => {
      ignore = true;
    };
  }, [query, setAvailableStreams, setStreamsError, setStreamsLoading]);
};
