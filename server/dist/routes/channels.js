"use strict";
/**
 * Channels Router
 * թ�������API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.channelsRouter = void 0;
const express_1 = require("express");
const channelService_1 = require("../services/channelService");
exports.channelsRouter = (0, express_1.Router)();
/**
 * GET /api/channels/followed
 * ��������nթ��������Ȓ֗
 */
exports.channelsRouter.get('/followed', async (req, res) => {
    try {
        // �÷��K�����ID�֗
        const userId = req.session.twitchUser?.id || req.session.googleUser?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const followedChannels = await (0, channelService_1.getFollowedChannelsWithDetails)(userId);
        res.json({
            success: true,
            channels: followedChannels,
        });
    }
    catch (error) {
        console.error('[Channels API] Error getting followed channels:', error);
        res.status(500).json({
            error: 'Failed to get followed channels',
        });
    }
});
/**
 * POST /api/channels/follow
 * �����թ��
 */
exports.channelsRouter.post('/follow', async (req, res) => {
    try {
        const { platform, channelId } = req.body;
        if (!platform || !channelId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // �÷��K�����ID�֗
        const userId = req.session.twitchUser?.id || req.session.googleUser?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        await (0, channelService_1.addFollowedChannel)(userId, platform, channelId);
        res.json({
            success: true,
            message: 'Channel followed successfully',
        });
    }
    catch (error) {
        console.error('[Channels API] Error following channel:', error);
        res.status(500).json({
            error: 'Failed to follow channel',
        });
    }
});
/**
 * DELETE /api/channels/unfollow
 * ����뒢�թ��
 */
exports.channelsRouter.delete('/unfollow', async (req, res) => {
    try {
        const { platform, channelId } = req.body;
        if (!platform || !channelId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // �÷��K�����ID�֗
        const userId = req.session.twitchUser?.id || req.session.googleUser?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        await (0, channelService_1.unfollowChannel)(userId, platform, channelId);
        res.json({
            success: true,
            message: 'Channel unfollowed successfully',
        });
    }
    catch (error) {
        console.error('[Channels API] Error unfollowing channel:', error);
        res.status(500).json({
            error: 'Failed to unfollow channel',
        });
    }
});
/**
 * PATCH /api/channels/notification
 * �-����
 */
exports.channelsRouter.patch('/notification', async (req, res) => {
    try {
        const { platform, channelId, enabled } = req.body;
        if (!platform || !channelId || typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // �÷��K�����ID�֗
        const userId = req.session.twitchUser?.id || req.session.googleUser?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        await (0, channelService_1.updateNotificationSetting)(userId, platform, channelId, enabled);
        res.json({
            success: true,
            message: 'Notification setting updated successfully',
        });
    }
    catch (error) {
        console.error('[Channels API] Error updating notification setting:', error);
        res.status(500).json({
            error: 'Failed to update notification setting',
        });
    }
});
//# sourceMappingURL=channels.js.map