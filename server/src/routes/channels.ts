/**
 * Channels Router
 * Õ©íüÁãóÍë¡API
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  addFollowedChannel,
  unfollowChannel,
  getFollowedChannelsWithDetails,
  updateNotificationSetting,
} from '../services/channelService';

export const channelsRouter = Router();

/**
 * GET /api/channels/followed
 * í°¤óæü¶ünÕ©íüÁãóÍëê¹È’Ö—
 */
channelsRouter.get('/followed', async (req: Request, res: Response) => {
  try {
    // »Ã·çóK‰æü¶üID’Ö—
    const userId = req.session.twitchUser?.id || req.session.googleUser?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const followedChannels = await getFollowedChannelsWithDetails(userId);

    res.json({
      success: true,
      channels: followedChannels,
    });
  } catch (error) {
    console.error('[Channels API] Error getting followed channels:', error);
    res.status(500).json({
      error: 'Failed to get followed channels',
    });
  }
});

/**
 * POST /api/channels/follow
 * ÁãóÍë’Õ©íü
 */
channelsRouter.post('/follow', async (req: Request, res: Response) => {
  try {
    const { platform, channelId } = req.body;

    if (!platform || !channelId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // »Ã·çóK‰æü¶üID’Ö—
    const userId = req.session.twitchUser?.id || req.session.googleUser?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await addFollowedChannel(userId, platform, channelId);

    res.json({
      success: true,
      message: 'Channel followed successfully',
    });
  } catch (error) {
    console.error('[Channels API] Error following channel:', error);
    res.status(500).json({
      error: 'Failed to follow channel',
    });
  }
});

/**
 * DELETE /api/channels/unfollow
 * ÁãóÍë’¢óÕ©íü
 */
channelsRouter.delete('/unfollow', async (req: Request, res: Response) => {
  try {
    const { platform, channelId } = req.body;

    if (!platform || !channelId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // »Ã·çóK‰æü¶üID’Ö—
    const userId = req.session.twitchUser?.id || req.session.googleUser?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await unfollowChannel(userId, platform, channelId);

    res.json({
      success: true,
      message: 'Channel unfollowed successfully',
    });
  } catch (error) {
    console.error('[Channels API] Error unfollowing channel:', error);
    res.status(500).json({
      error: 'Failed to unfollow channel',
    });
  }
});

/**
 * PATCH /api/channels/notification
 * å-š’ô°
 */
channelsRouter.patch('/notification', async (req: Request, res: Response) => {
  try {
    const { platform, channelId, enabled } = req.body;

    if (!platform || !channelId || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // »Ã·çóK‰æü¶üID’Ö—
    const userId = req.session.twitchUser?.id || req.session.googleUser?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await updateNotificationSetting(userId, platform, channelId, enabled);

    res.json({
      success: true,
      message: 'Notification setting updated successfully',
    });
  } catch (error) {
    console.error('[Channels API] Error updating notification setting:', error);
    res.status(500).json({
      error: 'Failed to update notification setting',
    });
  }
});
