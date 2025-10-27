import { Router } from 'express';
import { twitchEventSubManager } from '../services/twitchEventSubManager';

export const eventsubRouter = Router();

/**
 * GET /api/admin/eventsub/stats
 * EventSub統計取得
 */
eventsubRouter.get('/stats', async (req, res) => {
  try {
    const stats = twitchEventSubManager.getStats();
    const capacity = twitchEventSubManager.getCapacity();

    res.json({
      success: true,
      data: {
        stats,
        capacity
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EventSub] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/eventsub/subscriptions
 * 購読チャンネル一覧取得
 */
eventsubRouter.get('/subscriptions', async (req, res) => {
  try {
    const channelIds = twitchEventSubManager.getSubscribedUserIds();
    const stats = twitchEventSubManager.getStats();

    // 各接続の購読チャンネル情報を収集
    const subscriptions = stats.connections.map((conn) => ({
      connectionIndex: conn.index,
      status: conn.status,
      sessionId: conn.sessionId,
      subscriptionCount: conn.subscriptionCount,
      subscribedUserIds: conn.subscribedUserIds
    }));

    res.json({
      success: true,
      data: {
        totalChannels: channelIds.length,
        channelIds,
        subscriptions
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EventSub] Error getting subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/eventsub/subscriptions/:userId
 * 特定チャンネルの購読解除
 */
eventsubRouter.delete('/subscriptions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    await twitchEventSubManager.unsubscribeChannel(userId);
    console.log(`[EventSub] Unsubscribed channel: ${userId}`);

    res.json({
      success: true,
      data: {
        userId,
        unsubscribed: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[EventSub] Error unsubscribing channel:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/eventsub/reconnect
 * 全接続を再接続
 */
eventsubRouter.post('/reconnect', async (req, res) => {
  try {
    console.log('[EventSub] Reconnecting all connections...');
    await twitchEventSubManager.reconnectAll();

    res.json({
      success: true,
      data: {
        reconnected: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EventSub] Error reconnecting:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/eventsub/subscribe
 * チャンネルを購読（テスト用）
 * Body: { userId: "123456789" }
 */
eventsubRouter.post('/subscribe', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[EventSub] Subscribing to user: ${userId}`);
    await twitchEventSubManager.subscribeToUsers([userId]);

    res.json({
      success: true,
      data: {
        userId,
        subscribed: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[EventSub] Error subscribing to user:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/eventsub/credentials
 * EventSub認証情報を設定
 * Body: { accessToken: "...", clientId: "..." }
 */
eventsubRouter.post('/credentials', async (req, res) => {
  try {
    const { accessToken, clientId } = req.body;

    if (!accessToken || !clientId) {
      return res.status(400).json({
        success: false,
        error: 'accessToken and clientId are required',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[EventSub] Setting new credentials...');

    // 認証情報を設定
    twitchEventSubManager.setCredentials(accessToken, clientId);

    // 全接続を再接続
    await twitchEventSubManager.reconnectAll();

    console.log('[EventSub] Credentials updated and connections reestablished');

    res.json({
      success: true,
      data: {
        updated: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EventSub] Error setting credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
