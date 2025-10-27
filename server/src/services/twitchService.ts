import { request } from 'undici';
import { ensureTwitchOAuthConfig } from '../config/env';
import { emoteCacheService } from './emoteCacheService';
import { followedChannelsCacheService } from './followedChannelsCacheService';

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

type TwitchSearchChannel = {
  id: string;
  broadcaster_login: string;
  display_name: string;
  thumbnail_url: string;
  game_id?: string;
  game_name?: string;
  is_live: boolean;
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

export interface TwitchSearchChannelInfo {
  id: string;
  login: string;
  displayName: string;
  description: string;
  thumbnailUrl: string;
}

type TwitchEmote = {
  id: string;
  name: string;
  images: {
    url_1x: string;
    url_2x: string;
    url_4x: string;
  };
  emote_type?: string;
  emote_set_id?: string;
  owner_id?: string;
  format: string[];
  scale: string[];
  theme_mode: string[];
};

export interface TwitchEmoteInfo {
  id: string;
  name: string;
  imageUrl: string;
  emoteType?: string;
  emoteSetId?: string;
  ownerId?: string;
}

const buildHeaders = (accessToken: string): Record<string, string> => {
  const { clientId } = ensureTwitchOAuthConfig();
  return {
    Authorization: `Bearer ${accessToken}`,
    'Client-ID': clientId
  };
};

export const fetchFollowedChannels = async (
  accessToken: string,
  userId: string
): Promise<TwitchChannelInfo[]> => {
  // キャッシュチェック
  const cached = followedChannelsCacheService.getFollowedChannels(userId);
  if (cached) {
    console.log('[Twitch Service] Returning cached followed channels for user:', userId);
    return cached;
  }

  console.log('[Twitch Service] Fetching followed channels from API for user:', userId);
  const headers = buildHeaders(accessToken);
  const allChannels: TwitchChannelInfo[] = [];
  let cursor: string | undefined = undefined;
  let pageCount = 0;

  do {
    pageCount++;
    const params = new URLSearchParams({
      user_id: userId,
      first: '100'
    });

    if (cursor) {
      params.append('after', cursor);
    }

    const url = `${TWITCH_BASE}/channels/followed?${params.toString()}`;
    console.log(`[Twitch Service] Fetching page ${pageCount}:`, url);

    const response = await request(url, {
      method: 'GET',
      headers
    });

    console.log(`[Twitch Service] Page ${pageCount} response status:`, response.statusCode);

    if (response.statusCode >= 400) {
      const text = await response.body.text();

      // 429 Rate Limitエラーの特別処理
      if (response.statusCode === 429) {
        const retryAfter = response.headers['retry-after'] || response.headers['ratelimit-reset'];
        console.error('[Twitch Service] ⚠️ Rate limit exceeded!');
        console.error(`[Twitch Service] Retry-After: ${retryAfter || '不明'}`);
        console.error('[Twitch Service] APIリクエストの頻度が高すぎます。しばらく待ってから再試行してください。');

        const retryMessage = retryAfter
          ? `${retryAfter}秒後に再試行してください`
          : 'しばらく待ってから再試行してください';
        throw new Error(`Twitch APIのレート制限に達しました。${retryMessage}`);
      }

      console.error('[Twitch Service] Error response:', text);
      throw new Error(`Failed to fetch followed channels: ${response.statusCode} - ${text}`);
    }

    const data = (await response.body.json()) as TwitchApiResponse<TwitchFollowedChannel>;
    console.log(`[Twitch Service] Page ${pageCount} fetched ${data.data.length} channels`);

    const channels = data.data.map((item) => ({
      id: item.broadcaster_id,
      login: item.broadcaster_login,
      displayName: item.broadcaster_name
    }));

    allChannels.push(...channels);
    cursor = data.pagination?.cursor;

    console.log(`[Twitch Service] Total channels so far: ${allChannels.length}, Next cursor: ${cursor ? 'exists' : 'none'}`);
  } while (cursor);

  console.log(`[Twitch Service] Finished fetching all ${allChannels.length} channels in ${pageCount} pages`);

  // キャッシュに保存
  followedChannelsCacheService.setFollowedChannels(userId, allChannels);

  return allChannels;
};

export const fetchLiveStreams = async (
  accessToken: string,
  channelIds: string[]
): Promise<TwitchLiveStreamInfo[]> => {
  if (channelIds.length === 0) return [];

  console.log('[Twitch Service] Fetching live streams for channels:', channelIds.length);
  const headers = buildHeaders(accessToken);
  const allStreams: TwitchLiveStreamInfo[] = [];

  // チャンネルIDを100件ずつのバッチに分割
  const batchSize = 100;
  const batches: string[][] = [];
  for (let i = 0; i < channelIds.length; i += batchSize) {
    batches.push(channelIds.slice(i, i + batchSize));
  }

  console.log(`[Twitch Service] Split into ${batches.length} batches of up to ${batchSize} channels`);

  // 各バッチに対してAPIリクエストを実行
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const params = new URLSearchParams();
    batch.forEach((id) => params.append('user_id', id));

    console.log(`[Twitch Service] Fetching batch ${batchIndex + 1}/${batches.length} (${batch.length} channels)`);

    const response = await request(`${TWITCH_BASE}/streams?${params.toString()}`, {
      method: 'GET',
      headers
    });

    if (response.statusCode >= 400) {
      const text = await response.body.text();

      // 429 Rate Limitエラーの特別処理
      if (response.statusCode === 429) {
        const retryAfter = response.headers['retry-after'] || response.headers['ratelimit-reset'];
        console.error('[Twitch Service] ⚠️ Rate limit exceeded!');
        console.error(`[Twitch Service] Retry-After: ${retryAfter || '不明'}`);
        console.error('[Twitch Service] APIリクエストの頻度が高すぎます。しばらく待ってから再試行してください。');

        const retryMessage = retryAfter
          ? `${retryAfter}秒後に再試行してください`
          : 'しばらく待ってから再試行してください';
        throw new Error(`Twitch APIのレート制限に達しました。${retryMessage}`);
      }

      console.error(`[Twitch Service] Batch ${batchIndex + 1} error:`, text);
      throw new Error(`Failed to fetch Twitch streams: ${response.statusCode} - ${text}`);
    }

    const data = (await response.body.json()) as TwitchApiResponse<TwitchStream>;
    console.log(`[Twitch Service] Batch ${batchIndex + 1} returned ${data.data.length} live streams`);

    const streams = data.data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      login: item.user_login,
      displayName: item.user_name,
      title: item.title,
      viewerCount: item.viewer_count,
      thumbnailUrl: item.thumbnail_url.replace('{width}', '640').replace('{height}', '360'),
      startedAt: item.started_at
    }));

    allStreams.push(...streams);
  }

  console.log(`[Twitch Service] Total live streams found: ${allStreams.length}`);
  return allStreams;
};

export const searchChannels = async (
  accessToken: string,
  query: string,
  maxResults = 10
): Promise<TwitchSearchChannelInfo[]> => {
  const headers = buildHeaders(accessToken);
  const params = new URLSearchParams({
    query,
    first: String(Math.min(maxResults, 100))
  });

  const response = await request(`${TWITCH_BASE}/search/channels?${params.toString()}`, {
    method: 'GET',
    headers
  });

  if (response.statusCode >= 400) {
    const text = await response.body.text();
    throw new Error(`Failed to search Twitch channels: ${response.statusCode} - ${text}`);
  }

  const data = (await response.body.json()) as TwitchApiResponse<TwitchSearchChannel>;
  return data.data.map((item) => ({
    id: item.id,
    login: item.broadcaster_login,
    displayName: item.display_name,
    description: item.game_name || '',
    thumbnailUrl: item.thumbnail_url
  }));
};

export const fetchGlobalEmotes = async (
  accessToken: string
): Promise<TwitchEmoteInfo[]> => {
  // キャッシュチェック
  const cached = emoteCacheService.getGlobalEmotes();
  if (cached) {
    console.log('[Twitch Service] Returning cached global emotes');
    return cached;
  }

  console.log('[Twitch Service] Fetching global emotes from API');
  const headers = buildHeaders(accessToken);

  const response = await request(`${TWITCH_BASE}/chat/emotes/global`, {
    method: 'GET',
    headers
  });

  if (response.statusCode >= 400) {
    const text = await response.body.text();
    console.error('[Twitch Service] Error fetching global emotes:', text);
    throw new Error(`Failed to fetch global emotes: ${response.statusCode} - ${text}`);
  }

  const data = (await response.body.json()) as TwitchApiResponse<TwitchEmote>;
  console.log(`[Twitch Service] Fetched ${data.data.length} global emotes from API`);

  const emotes = data.data.map((item) => ({
    id: item.id,
    name: item.name,
    imageUrl: item.images.url_1x,
    emoteType: item.emote_type,
    emoteSetId: item.emote_set_id,
    ownerId: item.owner_id
  }));

  // キャッシュに保存
  emoteCacheService.setGlobalEmotes(emotes);

  return emotes;
};

export const fetchChannelEmotes = async (
  accessToken: string,
  broadcasterId: string
): Promise<TwitchEmoteInfo[]> => {
  // キャッシュチェック
  const cached = emoteCacheService.getChannelEmotes(broadcasterId);
  if (cached) {
    console.log('[Twitch Service] Returning cached channel emotes for broadcaster:', broadcasterId);
    return cached;
  }

  console.log('[Twitch Service] Fetching channel emotes from API for broadcaster:', broadcasterId);
  const headers = buildHeaders(accessToken);
  const params = new URLSearchParams({
    broadcaster_id: broadcasterId
  });

  const response = await request(`${TWITCH_BASE}/chat/emotes?${params.toString()}`, {
    method: 'GET',
    headers
  });

  if (response.statusCode >= 400) {
    const text = await response.body.text();
    console.error('[Twitch Service] Error fetching channel emotes:', text);
    throw new Error(`Failed to fetch channel emotes: ${response.statusCode} - ${text}`);
  }

  const data = (await response.body.json()) as TwitchApiResponse<TwitchEmote>;
  console.log(`[Twitch Service] Fetched ${data.data.length} channel emotes from API`);

  const emotes = data.data.map((item) => ({
    id: item.id,
    name: item.name,
    imageUrl: item.images.url_1x,
    emoteType: item.emote_type,
    emoteSetId: item.emote_set_id,
    ownerId: item.owner_id
  }));

  // キャッシュに保存
  emoteCacheService.setChannelEmotes(broadcasterId, emotes);

  return emotes;
};
