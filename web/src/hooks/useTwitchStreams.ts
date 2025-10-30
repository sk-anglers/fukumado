import { useEffect, useRef, useCallback } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useSyncStore } from '../stores/syncStore';
import { apiFetch } from '../utils/api';
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
  channelLogin: item.login,
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
  const response = await apiFetch(endpoint);
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
  const isFirstLoadRef = useRef<boolean>(true);

  // applyStreams関数をuseCallbackでメモ化（複数のuseEffectから参照するため）
  const applyStreamsCallback = useCallback((items: TwitchApiResponseItem[]): void => {
    const currentStreamIds = new Set(items.map((item) => item.id));

    // 配信リストに変更があるかチェック（新規追加または配信終了）
    const hasChanges =
      currentStreamIds.size !== previousStreamIdsRef.current.size ||
      Array.from(currentStreamIds).some((id) => !previousStreamIdsRef.current.has(id));

    // 変更がある場合のみストアを更新
    if (hasChanges) {
      const mapped = items.map(mapItemToStreamer);
      setAvailableStreamsForPlatform('twitch', mapped);
    }

    // 初回ロード以降のみ新規配信通知を生成
    if (!isFirstLoadRef.current) {
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
    } else {
      isFirstLoadRef.current = false;
    }

    previousStreamIdsRef.current = currentStreamIds;
  }, [setAvailableStreamsForPlatform, addNotification]);

  useEffect(() => {
    let cancelled = false;

    const showNoStreams = (): void => {
      setAvailableStreamsForPlatform('twitch', []);
      setStreamsError(NO_STREAMS_MESSAGE);
    };

    const run = async (): Promise<void> => {
      if (channelIds.length === 0) {
        setAvailableStreamsForPlatform('twitch', []);
        setLastSyncTime(Date.now());
        return;
      }

      setSyncing(true);
      setStreamsLoading(true);
      setStreamsError(undefined);

      try {
        const endpoint = `/api/twitch/live?${buildChannelQuery(channelIds)}`;
        const data = await fetchStreamResponse(endpoint);
        if (cancelled) return;
        if (data.items.length > 0) {
          applyStreamsCallback(data.items);
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

    // 初回実行のみ
    run().catch(() => {
      if (!cancelled) {
        showNoStreams();
        setStreamsLoading(false);
        setSyncing(false);
        setLastSyncTime(Date.now());
      }
    });

    return () => {
      cancelled = true;
    };
  }, [channelIds, manualSyncTrigger, applyStreamsCallback, setAvailableStreamsForPlatform, setStreamsError, setStreamsLoading, setSyncing, setLastSyncTime]);
};
