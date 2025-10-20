import { request } from 'undici';
import { ensureTwitchOAuthConfig } from '../config/env';

const TWITCH_BASE = 'https://api.twitch.tv/helix';

interface TwitchApiResponse<T> {
  data: T[];
  pagination?: {
    cursor?: string;
  };
}

type TwitchFollowedChannel = {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
};

type TwitchStream = {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  viewer_count: number;
  thumbnail_url: string;
  started_at: string;
};

export interface TwitchChannelInfo {
  id: string;
  login: string;
  displayName: string;
}

export interface TwitchLiveStreamInfo {
  id: string;
  userId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string;
  startedAt: string;
}

const buildHeaders = (accessToken: string): Record<string, string> => {
  const { clientId } = ensureTwitchOAuthConfig();
  return {
    Authorization: Bearer ,
    'Client-ID': clientId
  };
};

export const fetchFollowedChannels = async (
  accessToken: string,
  userId: string
): Promise<TwitchChannelInfo[]> => {
  const headers = buildHeaders(accessToken);
  const params = new URLSearchParams({
    user_id: userId,
    first: '100'
  });

  const response = await request(${TWITCH_BASE}/channels/followed?, {
    method: 'GET',
    headers
  });

  if (response.statusCode >= 400) {
    const text = await response.body.text();
    throw new Error(Failed to fetch followed channels:  - );
  }

  const data = (await response.body.json()) as TwitchApiResponse<TwitchFollowedChannel>;
  return data.data.map((item) => ({
    id: item.broadcaster_id,
    login: item.broadcaster_login,
    displayName: item.broadcaster_name
  }));
};

export const fetchLiveStreams = async (
  accessToken: string,
  channelIds: string[]
): Promise<TwitchLiveStreamInfo[]> => {
  if (channelIds.length === 0) return [];

  const headers = buildHeaders(accessToken);
  const params = new URLSearchParams();
  channelIds.slice(0, 100).forEach((id) => params.append('user_id', id));

  const response = await request(${TWITCH_BASE}/streams?, {
    method: 'GET',
    headers
  });

  if (response.statusCode >= 400) {
    const text = await response.body.text();
    throw new Error(Failed to fetch Twitch streams:  - );
  }

  const data = (await response.body.json()) as TwitchApiResponse<TwitchStream>;
  return data.data.map((item) => ({
    id: item.id,
    userId: item.user_id,
    login: item.user_login,
    displayName: item.user_name,
    title: item.title,
    viewerCount: item.viewer_count,
    thumbnailUrl: item.thumbnail_url.replace('{width}', '640').replace('{height}', '360'),
    startedAt: item.started_at
  }));
};
