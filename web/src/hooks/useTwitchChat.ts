import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import type { ChatMessage } from '../types';

const WS_URL = 'ws://localhost:4000/chat';

interface TwitchChannel {
  login: string;
  displayName: string;
}

export const useTwitchChat = (channels: TwitchChannel[]): void => {
  const wsRef = useRef<WebSocket | null>(null);
  const previousChannelsRef = useRef<string>('');
  const addMessage = useChatStore((state) => state.addMessage);

  // チャンネルリストを文字列化して比較用に保持
  const channelsKey = JSON.stringify(channels.map(ch => ch.login).sort());

  useEffect(() => {
    console.log('[useTwitchChat] Effect triggered');
    console.log('[useTwitchChat] Current channels:', channels);
    console.log('[useTwitchChat] Previous channels key:', previousChannelsRef.current);
    console.log('[useTwitchChat] Current channels key:', channelsKey);

    // WebSocket接続を確立（初回のみ）
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      console.log('[useTwitchChat] Creating new WebSocket connection');
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[useTwitchChat] WebSocket connected');
        wsRef.current = ws;

        // チャンネル購読を送信
        if (channels.length > 0) {
          console.log('[useTwitchChat] Subscribing to channels:', channels);
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels: channels.map(ch => ch.login),
            channelMapping: Object.fromEntries(channels.map(ch => [ch.login, ch.displayName]))
          }));
          previousChannelsRef.current = channelsKey;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[useTwitchChat] Received message:', message);

          // ChatMessage型に変換してストアに追加
          const chatMessage: ChatMessage = {
            id: message.id,
            platform: 'twitch',
            author: message.author,
            message: message.message,
            timestamp: message.timestamp,
            avatarColor: message.avatarColor,
            channelName: message.channelName
          };

          addMessage(chatMessage);
        } catch (error) {
          console.error('[useTwitchChat] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[useTwitchChat] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[useTwitchChat] WebSocket closed');
        wsRef.current = null;
      };

      wsRef.current = ws;
    } else if (wsRef.current.readyState === WebSocket.OPEN && previousChannelsRef.current !== channelsKey) {
      // 既に接続済みで、チャンネルリストが実際に変更された場合のみ購読を更新
      console.log('[useTwitchChat] Updating subscribed channels:', channels);
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        channels: channels.map(ch => ch.login),
        channelMapping: Object.fromEntries(channels.map(ch => [ch.login, ch.displayName]))
      }));
      previousChannelsRef.current = channelsKey;
    }

    // クリーンアップ関数：コンポーネントアンマウント時のみ実行
    return () => {
      // チャンネル変更時には切断しない
    };
  }, [channelsKey, channels, addMessage]);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('[useTwitchChat] Component unmounting, closing WebSocket');
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);
};
