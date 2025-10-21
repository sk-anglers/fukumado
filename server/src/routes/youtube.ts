import { Router } from 'express';
import { ensureGoogleAccessToken } from './auth';
import { fetchLiveStreams, fetchUserSubscriptions, searchChannels } from '../services/youtubeService';
import { streamSyncService } from '../services/streamSyncService';

export const youtubeRouter = Router();

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

    const maxResults = maxResultsParam ? Number(maxResultsParam) : undefined;
    const channels = await searchChannels(query, maxResults);
    res.json({ items: channels });
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
    res.json({ items: channels });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
