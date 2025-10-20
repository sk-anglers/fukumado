import { Router } from 'express';
import { fetchLiveStreams } from '../services/youtubeService';

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

    if ((!channelIds || channelIds.length === 0) && !queryParam) {
      return res.status(400).json({
        error: 'Either "channelId" (can be multiple) or "q" query parameter must be provided.'
      });
    }

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
