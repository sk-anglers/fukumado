import { Router } from 'express';
import { ensureTwitchAccessToken } from './auth';
import { fetchFollowedChannels, fetchLiveStreams, searchChannels, fetchGlobalEmotes, fetchChannelEmotes } from '../services/twitchService';
import { twitchChatService } from '../services/twitchChatService';
import { twitchEventSubService } from '../services/twitchEventSubService';
import { twitchEventSubManager } from '../services/twitchEventSubManager';
import { twitchEventSubWebhookService } from '../services/twitchEventSubWebhookService';
import { tokenStorage, streamSyncService } from '../services/streamSyncService';
import { priorityManager } from '../services/priorityManager';
import { dynamicChannelAllocator } from '../services/dynamicChannelAllocator';
import { followedChannelsCacheService } from '../services/followedChannelsCacheService';
import { env } from '../config/env';

export const twitchRouter = Router();

// チャンネル検索キャッシュ（5分TTL）
interface CacheEntry {
  data: any;
  timestamp: number;
}

const channelSearchCache = new Map<string, CacheEntry>();
const SEARCH_CACHE_TTL_MS = 300000; // 5分

twitchRouter.get('/subscriptions', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    const user = req.session.twitchUser;
    if (!accessToken || !user) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    // refresh=true の場合はキャッシュを無効化
    if (req.query.refresh === 'true') {
      followedChannelsCacheService.invalidateUser(user.id);
      console.log('[Twitch Subscriptions] Cache invalidated for user:', user.id);
    }

    // チャットサービスに認証情報を設定（バッジ取得のため）
    twitchChatService.setCredentials(accessToken, user.login);

    const channels = await fetchFollowedChannels(accessToken, user.id);

    // TokenStorageにアクセストークンを保存
    const sessionId = req.sessionID || 'default';
    tokenStorage.setToken(sessionId, 'twitch', accessToken);

    console.log(`[Twitch Subscriptions] Saved token for session: ${sessionId}`);

    res.json({ items: channels, sessionId });
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

    // チャンネルIDが指定されていない場合、StreamSyncServiceのキャッシュから返す
    if (channelIds.length === 0) {
      console.log('[Twitch API] No channelId specified, trying cache...');
      const cached = await streamSyncService.getCachedStreams();

      if (cached && cached.twitch) {
        console.log(`[Twitch API] Returning ${cached.twitch.length} cached streams`);
        return res.json({ items: cached.twitch });
      }

      // キャッシュがない場合はエラー
      console.log('[Twitch API] No cache available');
      return res.status(400).json({
        error: 'Either "channelId" (can be multiple) must be provided or StreamSync must be running.'
      });
    }

    // チャンネルIDが指定されている場合は直接API呼び出し
    console.log('[Twitch API] Fetching from Twitch API...');
    const streams = await fetchLiveStreams(accessToken, channelIds);
    res.json({ items: streams });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

twitchRouter.get('/channels', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

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
      console.log(`[Twitch Channel Search Cache] キャッシュヒット: "${query}" (TTL残り: ${remainingTtl}秒)`);
      return res.json(cached.data);
    }

    // キャッシュミス - APIから取得
    console.log(`[Twitch Channel Search Cache] キャッシュミス: "${query}" - APIから取得します`);
    const maxResults = maxResultsParam ? Number(maxResultsParam) : undefined;
    const channels = await searchChannels(accessToken, query, maxResults);
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

twitchRouter.post('/chat/send', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    const user = req.session.twitchUser;

    if (!accessToken || !user) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    const { channelId, channelLogin, message } = req.body;

    if (!channelId || typeof channelId !== 'string') {
      return res.status(400).json({ error: 'channelId is required' });
    }

    if (!channelLogin || typeof channelLogin !== 'string') {
      return res.status(400).json({ error: 'channelLogin is required' });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'message is required' });
    }

    // 認証情報を設定
    twitchChatService.setCredentials(accessToken, user.login);

    // メッセージを送信
    await twitchChatService.sendMessage(channelLogin, message.trim());

    // エモート情報をパース
    const emotes = await parseEmotesFromMessage(accessToken, channelId, message.trim());

    res.json({ success: true, emotes });
  } catch (error) {
    console.error('[Twitch Chat] Send message error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * メッセージテキストからエモート情報をパース
 */
async function parseEmotesFromMessage(
  accessToken: string,
  broadcasterId: string,
  message: string
): Promise<Array<{ id: string; positions: Array<{ start: number; end: number }> }>> {
  try {
    // グローバルエモートとチャンネルエモートを取得
    const [globalEmotes, channelEmotes] = await Promise.all([
      fetchGlobalEmotes(accessToken),
      fetchChannelEmotes(accessToken, broadcasterId)
    ]);

    // エモート名をIDにマッピング
    const emoteMap = new Map<string, string>();
    [...globalEmotes, ...channelEmotes].forEach((emote) => {
      emoteMap.set(emote.name, emote.id);
    });

    // メッセージをトークンに分割してエモートを検出
    const emotePositions = new Map<string, Array<{ start: number; end: number }>>();
    let currentPos = 0;

    // スペースで分割してトークンを処理
    const tokens = message.split(' ');
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const emoteId = emoteMap.get(token);

      if (emoteId) {
        // エモートが見つかった
        const start = currentPos;
        const end = currentPos + token.length - 1;

        if (!emotePositions.has(emoteId)) {
          emotePositions.set(emoteId, []);
        }
        emotePositions.get(emoteId)!.push({ start, end });
      }

      // 次のトークンの開始位置を計算（トークン長 + スペース1文字）
      currentPos += token.length;
      if (i < tokens.length - 1) {
        currentPos += 1; // スペース
      }
    }

    // 結果を配列に変換
    const result: Array<{ id: string; positions: Array<{ start: number; end: number }> }> = [];
    emotePositions.forEach((positions, id) => {
      result.push({ id, positions });
    });

    return result;
  } catch (error) {
    console.error('[Twitch Chat] Error parsing emotes:', error);
    // エモートのパースに失敗しても、メッセージ送信自体は成功しているので空配列を返す
    return [];
  }
}

twitchRouter.get('/emotes/global', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    const emotes = await fetchGlobalEmotes(accessToken);
    res.json({ items: emotes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

twitchRouter.get('/emotes/channel', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    const broadcasterId = req.query.broadcasterId;
    if (!broadcasterId || typeof broadcasterId !== 'string') {
      return res.status(400).json({ error: 'broadcasterId query parameter is required' });
    }

    const emotes = await fetchChannelEmotes(accessToken, broadcasterId);
    res.json({ items: emotes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

twitchRouter.post('/eventsub/connect', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    const user = req.session.twitchUser;

    if (!accessToken || !user) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    if (!env.twitch.clientId) {
      return res.status(500).json({ error: 'Twitch Client ID not configured' });
    }

    // 認証情報を設定
    twitchChatService.setCredentials(accessToken, user.login);

    // 新: EventSubManager（3本接続）を使用
    twitchEventSubManager.setCredentials(accessToken, env.twitch.clientId);

    // DynamicChannelAllocatorに認証情報を設定
    dynamicChannelAllocator.setTwitchCredentials(accessToken, env.twitch.clientId);

    // EventSubに接続（全ての接続を開始）
    await twitchEventSubManager.connectAll();

    // 統計情報を取得
    const stats = twitchEventSubManager.getStats();

    res.json({
      success: true,
      message: 'EventSub Manager connected with 3 connections',
      stats
    });
  } catch (error) {
    console.error('[Twitch EventSub Manager] Connection error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

twitchRouter.post('/eventsub/subscribe', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds must be an array' });
    }

    // 新: EventSubManager（3本接続）を使用
    await twitchEventSubManager.subscribeToUsers(userIds);

    // 統計情報を取得
    const stats = twitchEventSubManager.getStats();
    const capacity = twitchEventSubManager.getCapacity();

    res.json({
      success: true,
      subscribedCount: userIds.length,
      stats,
      capacity
    });
  } catch (error) {
    console.error('[Twitch EventSub Manager] Subscribe error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

twitchRouter.get('/eventsub/status', async (req, res) => {
  // 新: EventSubManager（3本接続）の統計情報を取得
  const stats = await twitchEventSubManager.getStats();
  const capacity = twitchEventSubManager.getCapacity();
  const subscribedUserIds = twitchEventSubManager.getSubscribedUserIds();

  res.json({
    connected: stats.activeConnections > 0,
    subscribedCount: subscribedUserIds.length,
    subscribedUserIds,
    stats,
    capacity
  });
});

// Webhook方式でのEventSub
twitchRouter.post('/eventsub/webhook/connect', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    const user = req.session.twitchUser;

    if (!accessToken || !user) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    if (!env.twitch.clientId) {
      return res.status(500).json({ error: 'Twitch Client ID not configured' });
    }

    if (!env.twitch.webhookUrl || !env.twitch.webhookSecret) {
      return res.status(500).json({ error: 'Webhook configuration missing' });
    }

    // チャットサービスに認証情報を設定
    twitchChatService.setCredentials(accessToken, user.login);

    // Webhookサービスに認証情報を設定
    twitchEventSubWebhookService.setCredentials(
      accessToken,
      env.twitch.clientId,
      env.twitch.webhookSecret,
      env.twitch.webhookUrl
    );

    // DynamicChannelAllocatorでWebhookフォールバックを有効化
    dynamicChannelAllocator.enableWebhook(env.twitch.webhookUrl, env.twitch.webhookSecret);

    res.json({ success: true, message: 'EventSub Webhook configured' });
  } catch (error) {
    console.error('[Twitch EventSub Webhook] Configuration error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

twitchRouter.post('/eventsub/webhook/subscribe', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'Twitch authentication required' });
    }

    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds must be an array' });
    }

    await twitchEventSubWebhookService.subscribeToUsers(userIds);

    res.json({ success: true, subscribedCount: userIds.length });
  } catch (error) {
    console.error('[Twitch EventSub Webhook] Subscribe error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

twitchRouter.get('/eventsub/webhook/status', (req, res) => {
  const subscribedUserIds = twitchEventSubWebhookService.getSubscribedUserIds();
  res.json({
    subscribed: subscribedUserIds.length > 0,
    subscribedCount: subscribedUserIds.length,
    subscribedUserIds
  });
});

// Webhookエンドポイント（Twitchからの通知を受け取る）
twitchRouter.post('/webhooks/twitch', (req, res) => {
  const messageType = req.headers['twitch-eventsub-message-type'] as string;
  const messageId = req.headers['twitch-eventsub-message-id'] as string;
  const messageTimestamp = req.headers['twitch-eventsub-message-timestamp'] as string;
  const signature = req.headers['twitch-eventsub-message-signature'] as string;

  console.log(`[Twitch Webhook] Received message type: ${messageType}`);

  // 署名検証
  const isValid = twitchEventSubWebhookService.verifySignature(
    messageId,
    messageTimestamp,
    JSON.stringify(req.body),
    signature
  );

  if (!isValid) {
    console.error('[Twitch Webhook] Invalid signature');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // メッセージタイプごとに処理
  switch (messageType) {
    case 'webhook_callback_verification':
      // Webhook登録時の検証
      console.log('[Twitch Webhook] Verification request received');
      return res.status(200).send(req.body.challenge);

    case 'notification':
      // イベント通知
      console.log('[Twitch Webhook] Notification received');
      twitchEventSubWebhookService.handleWebhookNotification(req.body);
      return res.status(200).json({ success: true });

    case 'revocation':
      // サブスクリプション取り消し
      console.log('[Twitch Webhook] Revocation received');
      return res.status(200).json({ success: true });

    default:
      console.log(`[Twitch Webhook] Unknown message type: ${messageType}`);
      return res.status(200).json({ success: true });
  }
});

// ========================================
// 優先度管理エンドポイント
// ========================================

/**
 * 優先度統計情報を取得
 * GET /api/twitch/priority/status
 */
twitchRouter.get('/priority/status', (req, res) => {
  try {
    const stats = priorityManager.getStats();
    const classification = streamSyncService.getChannelClassification();

    res.json({
      success: true,
      stats,
      classification,
      summary: {
        totalChannels: stats.totalChannels,
        realtimeChannels: stats.realtimeChannels,
        delayedChannels: stats.delayedChannels,
        totalUsers: stats.totalUsers,
        realtimePercentage: stats.totalChannels > 0
          ? ((stats.realtimeChannels / stats.totalChannels) * 100).toFixed(1)
          : '0.0',
        delayedPercentage: stats.totalChannels > 0
          ? ((stats.delayedChannels / stats.totalChannels) * 100).toFixed(1)
          : '0.0'
      }
    });
  } catch (error) {
    console.error('[Priority] Error getting status:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * 優先度を手動で再計算（デバッグ用）
 * POST /api/twitch/priority/recalculate
 */
twitchRouter.post('/priority/recalculate', (req, res) => {
  try {
    console.log('[Priority] Manual recalculation requested');

    // 現在の統計情報を取得
    const beforeStats = priorityManager.getStats();

    // 優先度を再計算（PriorityManagerは自動的に再計算するので、統計情報を取得するだけ）
    const afterStats = priorityManager.getStats();

    res.json({
      success: true,
      message: 'Priority recalculated',
      before: beforeStats,
      after: afterStats
    });
  } catch (error) {
    console.error('[Priority] Error recalculating:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ========================================
// 動的チャンネル割り当てエンドポイント
// ========================================

/**
 * チャンネル割り当て状況を取得
 * GET /api/twitch/allocation/status
 */
twitchRouter.get('/allocation/status', (req, res) => {
  try {
    const stats = dynamicChannelAllocator.getStats();
    const eventSubCapacity = stats.eventSubCapacity;

    res.json({
      success: true,
      stats,
      summary: {
        totalChannels: stats.total,
        eventSubChannels: stats.byMethod.eventsub,
        webhookChannels: stats.byMethod.webhook,
        pollingChannels: stats.byMethod.polling,
        realtimeChannels: stats.byPriority.realtime,
        delayedChannels: stats.byPriority.delayed,
        eventSubCapacity: {
          used: eventSubCapacity.used,
          total: eventSubCapacity.total,
          available: eventSubCapacity.available,
          percentage: eventSubCapacity.percentage.toFixed(1) + '%'
        }
      }
    });
  } catch (error) {
    console.error('[Allocation] Error getting status:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * チャンネル割り当てを手動でリバランス
 * POST /api/twitch/allocation/rebalance
 */
twitchRouter.post('/allocation/rebalance', async (req, res) => {
  try {
    console.log('[Allocation] Manual rebalance requested');

    await dynamicChannelAllocator.rebalance();

    const stats = dynamicChannelAllocator.getStats();

    res.json({
      success: true,
      message: 'Channel allocation rebalanced',
      stats
    });
  } catch (error) {
    console.error('[Allocation] Error rebalancing:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * 特定チャンネルの割り当て情報を取得
 * GET /api/twitch/allocation/:platform/:channelId
 */
twitchRouter.get('/allocation/:platform/:channelId', (req, res) => {
  try {
    const { platform, channelId } = req.params;

    if (platform !== 'youtube' && platform !== 'twitch') {
      return res.status(400).json({ error: 'Invalid platform. Must be "youtube" or "twitch"' });
    }

    const allocation = dynamicChannelAllocator.getAllocation(channelId, platform as 'youtube' | 'twitch');

    if (!allocation) {
      return res.status(404).json({ error: 'Channel not found in allocations' });
    }

    res.json({
      success: true,
      allocation
    });
  } catch (error) {
    console.error('[Allocation] Error getting channel allocation:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
