import { request } from 'undici';
import { ensureYouTubeApiKey } from '../config/env';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeLiveStream {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
}

interface YouTubeSearchListResponse {
  items: Array<{
    id: { videoId?: string };
    snippet: {
      publishedAt: string;
      channelId: string;
      title: string;
      description: string;
      thumbnails: Record<
        'default' | 'medium' | 'high',
        { url: string; width?: number; height?: number }
      >;
      channelTitle: string;
    };
  }>;
}

const maxResultsDefault = 10;

const buildSearchUrl = (params: URLSearchParams): string =>
  `${YOUTUBE_API_BASE}/search?${params.toString()}`;

const performRequest = async <T>(url: string): Promise<T> => {
  const response = await request(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (response.statusCode >= 400) {
    const body = await response.body.text();
    throw new Error(`YouTube API error: ${response.statusCode} - ${body}`);
  }

  return await response.body.json() as T;
};

const normalizeSearchItems = (items: YouTubeSearchListResponse['items']): YouTubeLiveStream[] =>
  items
    .filter((item) => item.id.videoId)
    .map((item) => ({
      id: item.id.videoId as string,
      title: item.snippet.title,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        '',
      publishedAt: item.snippet.publishedAt
    }));

export interface FetchLiveStreamsOptions {
  channelIds?: string[];
  query?: string;
  maxResults?: number;
}

export const fetchLiveStreams = async (
  options: FetchLiveStreamsOptions
): Promise<YouTubeLiveStream[]> => {
  const apiKey = ensureYouTubeApiKey();

  const maxResults = options.maxResults ?? maxResultsDefault;
  const results: YouTubeLiveStream[] = [];

  if (options.channelIds?.length) {
    const responses = await Promise.all(
      options.channelIds.map(async (channelId) => {
        const params = new URLSearchParams({
          part: 'snippet',
          channelId,
          type: 'video',
          eventType: 'live',
          key: apiKey,
          maxResults: maxResults.toString()
        });
        const url = buildSearchUrl(params);
        const data = await performRequest<YouTubeSearchListResponse>(url);
        return normalizeSearchItems(data.items);
      })
    );

    responses.forEach((streams) => {
      results.push(...streams);
    });
  } else if (options.query) {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      eventType: 'live',
      key: apiKey,
      maxResults: maxResults.toString(),
      q: options.query
    });
    const url = buildSearchUrl(params);
    const data = await performRequest<YouTubeSearchListResponse>(url);
    results.push(...normalizeSearchItems(data.items));
  } else {
    throw new Error('Either channelIds or query must be provided to fetch YouTube live streams.');
  }

  return results;
};
