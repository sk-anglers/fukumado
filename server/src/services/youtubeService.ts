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

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  customUrl?: string;
}

interface YouTubeSubscriptionResponse {
  items: Array<{
    snippet: {
      resourceId: {
        channelId: string;
      };
      title: string;
      description: string;
      thumbnails: Record<
        'default' | 'medium' | 'high',
        { url: string; width?: number; height?: number }
      >;
      channelId: string;
      channelTitle: string;
    };
  }>;
  nextPageToken?: string;
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

interface YouTubeChannelSearchResponse {
  items: Array<{
    id: { channelId?: string };
    snippet: {
      title: string;
      description: string;
      thumbnails: Record<
        'default' | 'medium' | 'high',
        { url: string; width?: number; height?: number }
      >;
      customUrl?: string;
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

const normalizeChannelItems = (items: YouTubeChannelSearchResponse['items']): YouTubeChannel[] =>
  items
    .filter((item) => item.id.channelId)
    .map((item) => ({
      id: item.id.channelId as string,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl:
        item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        '',
      customUrl: item.snippet.customUrl
    }));

export const searchChannels = async (query: string, maxResults: number = 10): Promise<YouTubeChannel[]> => {
  const apiKey = ensureYouTubeApiKey();
  if (!query.trim()) {
    return [];
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    key: apiKey,
    maxResults: Math.min(Math.max(maxResults, 1), 25).toString(),
    q: query
  });

  const url = buildSearchUrl(params);
  const data = await performRequest<YouTubeChannelSearchResponse>(url);
  return normalizeChannelItems(data.items);
};

const normalizeSubscriptionItem = (item: YouTubeSubscriptionResponse['items'][number]): YouTubeChannel => ({
  id: item.snippet.resourceId.channelId,
  title: item.snippet.title,
  description: item.snippet.description,
  thumbnailUrl:
    item.snippet.thumbnails.high?.url ??
    item.snippet.thumbnails.medium?.url ??
    item.snippet.thumbnails.default?.url ??
    '',
  customUrl: item.snippet.channelTitle
});

export const fetchUserSubscriptions = async (accessToken: string): Promise<YouTubeChannel[]> => {
  const params = new URLSearchParams({
    part: 'snippet',
    mine: 'true',
    maxResults: '50',
    order: 'alphabetical'
  });

  const response = await request(`${YOUTUBE_API_BASE}/subscriptions?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.statusCode >= 400) {
    const body = await response.body.text();
    throw new Error(`Failed to fetch subscriptions: ${response.statusCode} - ${body}`);
  }

  const data = (await response.body.json()) as YouTubeSubscriptionResponse;
  return data.items.map(normalizeSubscriptionItem);
};
