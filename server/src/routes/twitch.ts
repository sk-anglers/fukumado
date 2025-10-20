import { Router } from 'express';
import { ensureTwitchAccessToken } from './auth';
import { fetchFollowedChannels, fetchLiveStreams } from '../services/twitchService';

export const twitchRouter = Router();

twitchRouter.get('/subscriptions', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    const user = req.session.twitchUser;
    if (!accessToken || !user) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    const channels = await fetchFollowedChannels(accessToken, user.id);
    res.json({ items: channels });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

twitchRouter.get('/live', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    const channelIdsParam = req.query.channelId;
    const channelIds = Array.isArray(channelIdsParam)
      ? channelIdsParam.map(String)
      : channelIdsParam
        ? [String(channelIdsParam)]
        : [];

    const streams = await fetchLiveStreams(accessToken, channelIds);
    res.json({ items: streams });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
