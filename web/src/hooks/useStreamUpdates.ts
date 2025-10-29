import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import { websocketService } from '../services/websocketService';
import type { Streamer } from '../types';

interface StreamUpdateMessage {
  type: 'stream_list_updated';
  platform: 'youtube' | 'twitch';
  streams: any[];
  changes: {
    added: string[];
    removed: string[];
  };
}

interface YouTubeStream {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
}

interface TwitchStream {
  id: string;
  userId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string;
  startedAt: string;
}

const mapYouTubeToStreamer = (item: YouTubeStream): Streamer => ({
  id: item.id,
  platform: 'youtube',
  title: item.title,
  displayName: item.channelTitle,
  channelId: item.channelId,
  channelTitle: item.channelTitle,
  description: item.description,
  thumbnailUrl: item.thumbnailUrl,
  liveSince: item.publishedAt,
  embedUrl: `https://www.youtube.com/embed/${item.id}?enablejsapi=1`
});

const mapTwitchToStreamer = (item: TwitchStream): Streamer => ({
  id: item.id,
  platform: 'twitch',
  title: item.title,
  displayName: item.displayName,
  channelId: item.userId,
  channelLogin: item.login,
  channelTitle: item.displayName,
  thumbnailUrl: item.thumbnailUrl,
  liveSince: item.startedAt,
  viewerCount: item.viewerCount,
  embedUrl: `https://player.twitch.tv/?channel=${item.login}&parent=${window.location.hostname}&autoplay=false&muted=false`
});

/**
 * WebSocket経由で配信リスト更新を受信するフック
 * グローバルシングルトンのWebSocketServiceを使用
 */
export const useStreamUpdates = (
  youtubeChannelIds: string[] = [],
  twitchChannelIds: string[] = []
): void => {
  const hasSubscribedRef = useRef<boolean>(false);
  const isFirstLoadRef = useRef<boolean>(true);
  const lastSessionIdRef = useRef<string | undefined>(undefined);
  const lastChannelsRef = useRef<{ youtube: string; twitch: string }>({ youtube: '', twitch: '' });

  const setAvailableStreamsForPlatform = useLayoutStore((state) => state.setAvailableStreamsForPlatform);
  const setStreamsLoading = useLayoutStore((state) => state.setStreamsLoading);
  const setStreamsError = useLayoutStore((state) => state.setStreamsError);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const setSyncing = useSyncStore((state) => state.setSyncing);
  const setLastSyncTime = useSyncStore((state) => state.setLastSyncTime);
  const sessionId = useAuthStore((state) => state.sessionId);

  // WebSocket接続の確立とメッセージハンドラー登録（常に実行）
  useEffect(() => {
    // グローバルなWebSocket接続を確立
    console.log('[useStreamUpdates] Ensuring WebSocket connection...');
    websocketService.connect();

    // メッセージハンドラーを登録
    const unsubscribeMessage = websocketService.onMessage((message: any) => {
      if (message.type === 'stream_list_updated') {
        console.log('[useStreamUpdates] Stream update received:', {
          platform: message.platform,
          count: message.streams.length,
          added: message.changes.added.length,
          removed: message.changes.removed.length
        });

        // プラットフォームに応じてStreamer型に変換
        let streamers: Streamer[] = [];
        if (message.platform === 'youtube') {
          streamers = message.streams.map(mapYouTubeToStreamer);
        } else if (message.platform === 'twitch') {
          streamers = message.streams.map(mapTwitchToStreamer);
        }

        // ストアを更新
        setAvailableStreamsForPlatform(message.platform, streamers);
        setStreamsError(undefined);
        setSyncing(false);
        setStreamsLoading(false);
        setLastSyncTime(Date.now());

        // 初回ロード以降のみ新規配信通知を生成
        if (!isFirstLoadRef.current && message.changes.added.length > 0) {
          const newStreams = streamers.filter(s => message.changes.added.includes(s.id));
          newStreams.forEach(stream => {
            console.log('[useStreamUpdates] New stream detected:', stream.displayName, stream.title);
            addNotification({
              type: 'stream_started',
              platform: message.platform,
              channelId: stream.channelId || '',
              channelName: stream.displayName,
              streamId: stream.id,
              streamTitle: stream.title,
              thumbnailUrl: stream.thumbnailUrl
            });
          });
        } else if (isFirstLoadRef.current) {
          console.log('[useStreamUpdates] Initial load, skipping notifications');
          isFirstLoadRef.current = false;
        }
      }
    });

    // エラーハンドラーを登録
    const unsubscribeError = websocketService.onError(() => {
      setSyncing(false);
      setStreamsLoading(false);
    });

    // クリーンアップ（ハンドラーの登録解除のみ、接続は維持）
    return () => {
      unsubscribeMessage();
      unsubscribeError();
    };
  }, [
    setAvailableStreamsForPlatform,
    setStreamsError,
    setStreamsLoading,
    setSyncing,
    setLastSyncTime,
    addNotification
  ]);

  // チャンネルまたはsessionIdが変更されたらsubscribeメッセージを送信
  useEffect(() => {
    const channelsKey = {
      youtube: youtubeChannelIds.join(','),
      twitch: twitchChannelIds.join(',')
    };

    // フォローチャンネルが0件の場合は何もしない
    if (youtubeChannelIds.length === 0 && twitchChannelIds.length === 0) {
      return;
    }

    // sessionIdがない場合は待つ
    if (!sessionId) {
      console.log('[useStreamUpdates] Waiting for sessionId...', {
        youtubeChannels: youtubeChannelIds.length,
        twitchChannels: twitchChannelIds.length
      });
      return;
    }

    // チャンネルとsessionIdが前回と同じなら何もしない
    const channelsChanged = channelsKey.youtube !== lastChannelsRef.current.youtube ||
                           channelsKey.twitch !== lastChannelsRef.current.twitch;
    const sessionIdChanged = sessionId !== lastSessionIdRef.current;

    if (!channelsChanged && !sessionIdChanged && hasSubscribedRef.current) {
      console.log('[useStreamUpdates] No changes detected, skipping subscribe');
      return;
    }

    // WebSocket接続を待つ
    const sendSubscription = () => {
      if (!websocketService.isConnected()) {
        console.log('[useStreamUpdates] Waiting for WebSocket connection...');
        return;
      }

      // subscribe_streamsメッセージを送信
      console.log('[useStreamUpdates] Sending subscribe_streams message:', {
        youtube: youtubeChannelIds.length,
        twitch: twitchChannelIds.length,
        sessionId: sessionId,
        reason: channelsChanged ? 'channels changed' : sessionIdChanged ? 'sessionId changed' : 'initial'
      });

      const success = websocketService.send({
        type: 'subscribe_streams',
        youtubeChannels: youtubeChannelIds,
        twitchChannels: twitchChannelIds,
        sessionId: sessionId
      });

      if (success) {
        hasSubscribedRef.current = true;
        lastSessionIdRef.current = sessionId;
        lastChannelsRef.current = channelsKey;

        // 同期中状態にする
        setSyncing(true);
        setStreamsLoading(true);
      }
    };

    // 既に接続済みなら即座に送信、未接続なら接続完了を待つ
    if (websocketService.isConnected()) {
      sendSubscription();
    } else {
      const unsubscribe = websocketService.onOpen(() => {
        sendSubscription();
        unsubscribe();
      });
    }
  }, [
    youtubeChannelIds.join(','),
    twitchChannelIds.join(','),
    sessionId,
    setSyncing,
    setStreamsLoading
  ]);
};
