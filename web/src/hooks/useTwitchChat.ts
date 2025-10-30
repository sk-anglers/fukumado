import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import type { ChatMessage } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/chat';

interface TwitchChannel {
  login: string;
  displayName: string;
  channelId?: string;
}

export const useTwitchChat = (channels: TwitchChannel[]): void => {
  const wsRef = useRef<WebSocket | null>(null);
  const previousChannelsRef = useRef<string>('');
  const addMessage = useChatStore((state) => state.addMessage);

  // チャンネルリストを文字列化して比較用に保持
  const channelsKey = JSON.stringify(channels.map(ch => ch.login).sort());

  useEffect(() => {
    // WebSocket接続を確立（初回のみ）
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        wsRef.current = ws;

        // チャンネル購読を送信
        if (channels.length > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels: channels.map(ch => ch.login),
            channelMapping: Object.fromEntries(channels.map(ch => [ch.login, ch.displayName])),
            channelIdMapping: Object.fromEntries(
              channels.filter(ch => ch.channelId).map(ch => [ch.login, ch.channelId!])
            )
          }));
          previousChannelsRef.current = channelsKey;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // 受信メッセージの詳細をログ出力（デバッグ用）
          console.log('[useTwitchChat] Received raw message:', message);

          // チャットメッセージのみを処理（typeフィールドがない、またはplatformがtwitchのメッセージ）
          // EventSub通知、配信リスト更新、優先度変更などは無視する
          if (message.type && message.type !== 'chat') {
            console.log('[useTwitchChat] Ignoring non-chat message:', message.type);
            return;
          }

          // チャットメッセージかどうかを確認（platformまたはchannelLoginフィールドの存在）
          if (!message.platform && !message.channelLogin) {
            console.log('[useTwitchChat] Ignoring message without platform/channelLogin');
            return;
          }

          console.log('[useTwitchChat] Processing chat message fields:', {
            id: message.id,
            author: message.author,
            message: message.message,
            timestamp: message.timestamp,
            channelName: message.channelName
          });

          // ChatMessage型に変換してストアに追加
          const chatMessage: ChatMessage = {
            id: message.id,
            platform: 'twitch',
            author: message.author,
            message: message.message,
            timestamp: message.timestamp,
            avatarColor: message.avatarColor,
            channelName: message.channelName,
            // Twitch固有の情報も含める
            emotes: message.emotes,
            badges: message.badges,
            bits: message.bits,
            isSubscriber: message.isSubscriber,
            isModerator: message.isModerator,
            isVip: message.isVip
          };

          console.log('[useTwitchChat] Converted ChatMessage:', chatMessage);
          addMessage(chatMessage);
        } catch (error) {
          console.error('[useTwitchChat] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[useTwitchChat] WebSocket error:', error);
      };

      ws.onclose = () => {
        wsRef.current = null;
      };

      wsRef.current = ws;
    } else if (wsRef.current.readyState === WebSocket.OPEN && previousChannelsRef.current !== channelsKey) {
      // 既に接続済みで、チャンネルリストが実際に変更された場合のみ購読を更新
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        channels: channels.map(ch => ch.login),
        channelMapping: Object.fromEntries(channels.map(ch => [ch.login, ch.displayName])),
        channelIdMapping: Object.fromEntries(
          channels.filter(ch => ch.channelId).map(ch => [ch.login, ch.channelId!])
        )
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
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);
};
