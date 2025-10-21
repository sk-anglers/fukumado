import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useSyncStore } from '../stores/syncStore';
import type { Streamer } from '../types';

interface TwitchApiResponseItem {
  id: string;
  userId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string;
  startedAt: string;
}

interface TwitchApiResponse {
  items: TwitchApiResponseItem[];
}

const mapItemToStreamer = (item: TwitchApiResponseItem): Streamer => ({
  id: item.id,
  platform: 'twitch',
  title: item.title,
  displayName: item.displayName,
  channelId: item.userId,
  channelTitle: item.displayName,
  thumbnailUrl: item.thumbnailUrl,
  liveSince: item.startedAt,
  viewerCount: item.viewerCount,
  embedUrl: `https://player.twitch.tv/?channel=${item.login}&parent=${window.location.hostname}&autoplay=false&muted=false`
});

const NO_STREAMS_MESSAGE = 'フォロー中のチャンネルでは現在ライブ配信が見つかりませんでした。';

const buildChannelQuery = (channelIds: string[]): string =>
  channelIds.map((id) => `channelId=${id}`).join('&');

const fetchStreamResponse = async (endpoint: string): Promise<TwitchApiResponse> => {
  const response = await fetch(endpoint, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch Twitch streams: ${response.status}`);
  }
  return await response.json();
};

export const useTwitchStreams = (channelIds: string[] = []): void => {
  const setAvailableStreamsForPlatform = useLayoutStore((state) => state.setAvailableStreamsForPlatform);
  const setStreamsLoading = useLayoutStore((state) => state.setStreamsLoading);
  const setStreamsError = useLayoutStore((state) => state.setStreamsError);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const syncSettings = useSyncStore((state) => state.settings);
  const setSyncing = useSyncStore((state) => state.setSyncing);
  const setLastSyncTime = useSyncStore((state) => state.setLastSyncTime);
  const manualSyncTrigger = useSyncStore((state) => state.manualSyncTrigger);

  const previousStreamIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let intervalId: NodeJS.Timeout | null = null;

    const showNoStreams = (): void => {
      setAvailableStreamsForPlatform('twitch', []);
      setStreamsError(NO_STREAMS_MESSAGE);
    };

    const applyStreams = (items: TwitchApiResponseItem[]): void => {
      const currentStreamIds = new Set(items.map((item) => item.id));

      // 配信リストに変更があるかチェック（新規追加または配信終了）
      const hasChanges =
        currentStreamIds.size !== previousStreamIdsRef.current.size ||
        Array.from(currentStreamIds).some((id) => !previousStreamIdsRef.current.has(id));

      // 変更がある場合のみストアを更新
      if (hasChanges) {
        const mapped = items.map(mapItemToStreamer);
        setAvailableStreamsForPlatform('twitch', mapped);
        console.log('[Twitch] 配信リストに変更を検出、ストアを更新しました');
      } else {
        console.log('[Twitch] 配信リストに変更なし、ストア更新をスキップしました');
      }

      // 新規配信を検出して通知を追加
      const newStreams = items.filter((item) => !previousStreamIdsRef.current.has(item.id));

      newStreams.forEach((item) => {
        addNotification({
          type: 'stream_started',
          platform: 'twitch',
          channelId: item.userId,
          channelName: item.displayName,
          streamId: item.id,
          streamTitle: item.title,
          thumbnailUrl: item.thumbnailUrl
        });
      });

      previousStreamIdsRef.current = currentStreamIds;
    };

    const run = async (): Promise<void> => {
      console.log('[Twitch配信取得] 開始');
      console.log('[Twitch] フォロー中のチャンネル数:', channelIds.length);
      console.log('[Twitch] チャンネルID:', channelIds);

      if (channelIds.length === 0) {
        console.log('[Twitch] チャンネルが0件のため空配列を設定');
        setAvailableStreamsForPlatform('twitch', []);
        setLastSyncTime(Date.now());
        return;
      }

      setSyncing(true);
      setStreamsLoading(true);
      setStreamsError(undefined);

      try {
        const endpoint = `/api/twitch/live?${buildChannelQuery(channelIds)}`;
        console.log('[Twitch] API呼び出し:', endpoint);
        const data = await fetchStreamResponse(endpoint);
        console.log('[Twitch] API レスポンス:', data);
        console.log('[Twitch] 取得した配信数:', data.items.length);
        if (cancelled) return;
        if (data.items.length > 0) {
          applyStreams(data.items);
        } else {
          showNoStreams();
        }
      } catch (error) {
        console.error('[Twitch] API呼び出しエラー:', error);
        if (!cancelled) {
          showNoStreams();
        }
      } finally {
        if (!cancelled) {
          setStreamsLoading(false);
          setSyncing(false);
          setLastSyncTime(Date.now());
        }
      }
    };

    // 初回実行
    run().catch(() => {
      if (!cancelled) {
        showNoStreams();
        setStreamsLoading(false);
        setSyncing(false);
        setLastSyncTime(Date.now());
      }
    });

    // 自動同期が有効な場合、定期実行を設定
    if (syncSettings.enabled) {
      intervalId = setInterval(() => {
        if (!cancelled) {
          run().catch(() => {
            if (!cancelled) {
              showNoStreams();
              setStreamsLoading(false);
              setSyncing(false);
            }
          });
        }
      }, syncSettings.interval);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [channelIds, syncSettings.enabled, syncSettings.interval, manualSyncTrigger, setAvailableStreamsForPlatform, setStreamsError, setStreamsLoading, setSyncing, setLastSyncTime, addNotification]);
};
