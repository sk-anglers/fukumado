import { Router } from 'express';
import { ensureGoogleAccessToken } from './auth';
import { fetchLiveStreams, fetchUserSubscriptions, searchChannels } from '../services/youtubeService';
import { streamSyncService, tokenStorage } from '../services/streamSyncService';

export const youtubeRouter = Router();

// チャンネル検索キャッシュ（5分TTL）
interface CacheEntry {
  data: any;
  timestamp: number;
}

const channelSearchCache = new Map<string, CacheEntry>();
const SEARCH_CACHE_TTL_MS = 300000; // 5分

youtubeRouter.get('/live', async (req, res) => {
  try {
    const channelIdsParam = req.query.channelId;
    const queryParam = req.query.q;
    const maxResultsParam = req.query.maxResults;

    const channelIds = Array.isArray(channelIdsParam)
      ? channelIdsParam.map(String)
      : channelIdsParam
        ? [String(channelIdsParam)]
        : undefined;

    const maxResults = maxResultsParam ? Number(maxResultsParam) : undefined;

    // チャンネルIDもクエリも指定されていない場合、キャッシュから返す
    if ((!channelIds || channelIds.length === 0) && !queryParam) {
      console.log('[YouTube API] No channelId or query specified, trying cache...');
      const cached = await streamSyncService.getCachedYouTubeStreams();

      if (cached) {
        console.log(`[YouTube API] Returning ${cached.length} cached streams`);
        return res.json({ items: cached });
      }

      // キャッシュがない場合はエラー
      console.log('[YouTube API] No cache available');
      return res.status(400).json({
        error: 'Either "channelId" (can be multiple) or "q" query parameter must be provided.'
      });
    }

    // チャンネルIDまたはクエリが指定されている場合は従来通りAPI呼び出し
    console.log('[YouTube API] Fetching from YouTube API...');
    const results = await fetchLiveStreams({
      channelIds,
      query: queryParam ? String(queryParam) : undefined,
      maxResults
    });

    res.json({ items: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

youtubeRouter.get('/channels', async (req, res) => {
  try {
    const query = req.query.q;
    const maxResultsParam = req.query.maxResults;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '"q" query parameter is required' });
    }

    // キャッシュキーを生成（クエリ文字列を小文字化して正規化）
    const cacheKey = query.toLowerCase().trim();
    const now = Date.now();

    // キャッシュチェック
    const cached = channelSearchCache.get(cacheKey);
    if (cached && now - cached.timestamp < SEARCH_CACHE_TTL_MS) {
      const remainingTtl = Math.ceil((SEARCH_CACHE_TTL_MS - (now - cached.timestamp)) / 1000);
      console.log(`[YouTube Channel Search Cache] キャッシュヒット: "${query}" (TTL残り: ${remainingTtl}秒)`);
      return res.json(cached.data);
    }

    // キャッシュミス - APIから取得
    console.log(`[YouTube Channel Search Cache] キャッシュミス: "${query}" - APIから取得します`);
    const maxResults = maxResultsParam ? Number(maxResultsParam) : undefined;
    const channels = await searchChannels(query, maxResults);
    const responseData = { items: channels };

    // キャッシュに保存
    channelSearchCache.set(cacheKey, {
      data: responseData,
      timestamp: now
    });

    // 古いキャッシュエントリを削除（メモリリーク対策）
    for (const [key, entry] of channelSearchCache.entries()) {
      if (now - entry.timestamp >= SEARCH_CACHE_TTL_MS) {
        channelSearchCache.delete(key);
      }
    }

    res.json(responseData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

youtubeRouter.get('/subscriptions', async (req, res) => {
  try {
    const accessToken = await ensureGoogleAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const channels = await fetchUserSubscriptions(accessToken);

    // TokenStorageにアクセストークンを保存
    const sessionId = req.sessionID || 'default';
    tokenStorage.setToken(sessionId, 'youtube', accessToken);

    console.log(`[YouTube Subscriptions] Saved token for session: ${sessionId}`);

    res.json({ items: channels, sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
