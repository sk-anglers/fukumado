import { Router } from 'express';
import { ensureTwitchAccessToken } from './auth';
import { fetchFollowedChannels, fetchLiveStreams, searchChannels, fetchGlobalEmotes, fetchChannelEmotes } from '../services/twitchService';
import { twitchChatService } from '../services/twitchChatService';
import { twitchEventSubService } from '../services/twitchEventSubService';
import { twitchEventSubWebhookService } from '../services/twitchEventSubWebhookService';
import { tokenStorage } from '../services/streamSyncService';
import { env } from '../config/env';

export const twitchRouter = Router();

// 配信情報のキャッシュ（60秒TTL）
interface CacheEntry {
  data: any;
  timestamp: number;
}

const liveStreamsCache = new Map<string, CacheEntry>();
const channelSearchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 60秒
const SEARCH_CACHE_TTL_MS = 300000; // 5分

twitchRouter.get('/subscriptions', async (req, res) => {
  try {
    const accessToken = await ensureTwitchAccessToken(req);
    const user = req.session.twitchUser;
    if (!accessToken || !user) {
      return res.status(401).json({ error: 'Twitch authentication required' });
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

    // キャッシュキーを生成（チャンネルIDをソートして結合）
    const cacheKey = [...channelIds].sort().join(',');
    const now = Date.now();

    // キャッシュチェック
    const cached = liveStreamsCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      const remainingTtl = Math.ceil((CACHE_TTL_MS - (now - cached.timestamp)) / 1000);
      console.log(`[Twitch API Cache] キャッシュヒット (TTL残り: ${remainingTtl}秒)`);
      return res.json(cached.data);
    }

    // キャッシュミス - APIから取得
    console.log('[Twitch API Cache] キャッシュミス - APIから取得します');
    const streams = await fetchLiveStreams(accessToken, channelIds);
    const responseData = { items: streams };

    // キャッシュに保存
    liveStreamsCache.set(cacheKey, {
      data: responseData,
      timestamp: now
    });

    // 古いキャッシュエントリを削除（メモリリーク対策）
    for (const [key, entry] of liveStreamsCache.entries()) {
      if (now - entry.timestamp >= CACHE_TTL_MS) {
        liveStreamsCache.delete(key);
      }
    }

    res.json(responseData);
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

    res.json({ success: true });
  } catch (error) {
    console.error('[Twitch Chat] Send message error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

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
    twitchEventSubService.setCredentials(accessToken, env.twitch.clientId);

    // EventSubに接続
    await twitchEventSubService.connect();

    res.json({ success: true, message: 'EventSub connected' });
  } catch (error) {
    console.error('[Twitch EventSub] Connection error:', error);
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

    await twitchEventSubService.subscribeToUsers(userIds);

    res.json({ success: true, subscribedCount: userIds.length });
  } catch (error) {
    console.error('[Twitch EventSub] Subscribe error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

twitchRouter.get('/eventsub/status', (req, res) => {
  const subscribedUserIds = twitchEventSubService.getSubscribedUserIds();
  res.json({
    connected: subscribedUserIds.length > 0,
    subscribedCount: subscribedUserIds.length,
    subscribedUserIds
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
