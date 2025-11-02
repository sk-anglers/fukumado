import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import type { ChatMessage } from '../types';
import { backendOrigin } from '../utils/api';
import { debugLog, debugWarn, debugError } from '../utils/debugLog';

const WS_URL = backendOrigin.replace(/^http/, 'ws') + '/chat';

interface TwitchChannel {
  login: string;
  displayName: string;
  channelId?: string;
}

export const useTwitchChat = (channels: TwitchChannel[]): void => {
  const wsRef = useRef<WebSocket | null>(null);
  const previousChannelsRef = useRef<string>('');
  const addMessage = useChatStore((state) => state.addMessage);
  const lastChatMessageTimeRef = useRef<number>(0);

  // チャンネルリストを文字列化して比較用に保持
  const channelsKey = JSON.stringify(channels.map(ch => ch.login).sort());

  useEffect(() => {
    // WebSocket接続を確立（初回のみ）
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      debugLog('[useTwitchChat]', '==== CREATING NEW WEBSOCKET CONNECTION ====');
      debugLog('[useTwitchChat]', 'WS_URL:', WS_URL);
      debugLog('[useTwitchChat]', 'Channels to subscribe:', channels.map(ch => ch.login));

      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        debugLog('[useTwitchChat]', '<<<< WEBSOCKET CONNECTION OPENED >>>>');
        debugLog('[useTwitchChat]', 'ReadyState:', ws.readyState);
        wsRef.current = ws;

        // チャンネル購読を送信
        if (channels.length > 0) {
          const subscribeMessage = {
            type: 'subscribe',
            channels: channels.map(ch => ch.login),
            channelMapping: Object.fromEntries(channels.map(ch => [ch.login, ch.displayName])),
            channelIdMapping: Object.fromEntries(
              channels.filter(ch => ch.channelId).map(ch => [ch.login, ch.channelId!])
            )
          };
          debugLog('[useTwitchChat]', '→ Sending subscribe message:', subscribeMessage);
          ws.send(JSON.stringify(subscribeMessage));
          previousChannelsRef.current = channelsKey;
          debugLog('[useTwitchChat]', '✓ Subscribe message sent successfully');
        }
      };

      ws.onmessage = (event) => {
        debugLog('[useTwitchChat]', '<<<< MESSAGE RECEIVED >>>>');
        debugLog('[useTwitchChat]', 'Event object:', event);
        debugLog('[useTwitchChat]', 'Raw data:', event.data);
        debugLog('[useTwitchChat]', 'Data type:', typeof event.data);

        try {
          const message = JSON.parse(event.data);

          debugLog('[useTwitchChat]', 'Parsed message:', message);
          debugLog('[useTwitchChat]', 'Message type:', message.type || 'undefined');

          // チャットメッセージのみを処理（typeフィールドがない、またはplatformがtwitchのメッセージ）
          // EventSub通知、配信リスト更新、優先度変更などは無視する
          if (message.type && message.type !== 'chat') {
            debugLog('[useTwitchChat]', '⊘ Ignoring non-chat message:', message.type);
            return;
          }

          // チャットメッセージかどうかを確認（platformまたはchannelLoginフィールドの存在）
          if (!message.platform && !message.channelLogin) {
            debugLog('[useTwitchChat]', '⊘ Ignoring message without platform/channelLogin');
            return;
          }

          // チャットメッセージ受信時刻を記録
          const now = performance.now();
          const timeSinceLastChat = lastChatMessageTimeRef.current ? now - lastChatMessageTimeRef.current : 0;
          lastChatMessageTimeRef.current = now;

          debugLog('[useTwitchChat]', '💬 CHAT MESSAGE DETECTED');
          debugLog('[useTwitchChat]', `Time since last chat: ${timeSinceLastChat.toFixed(2)}ms`);
          debugLog('[useTwitchChat]', 'Chat message fields:', {
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

          debugLog('[useTwitchChat]', '✓ Converted to ChatMessage:', chatMessage);
          addMessage(chatMessage);
          debugLog('[useTwitchChat]', '✓ Message added to store successfully');
        } catch (error) {
          debugError('[useTwitchChat]', 'Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        debugError('[useTwitchChat]', '<<<< WEBSOCKET ERROR OCCURRED >>>>');
        debugError('[useTwitchChat]', 'Error event:', error);
        debugError('[useTwitchChat]', 'ReadyState:', ws.readyState);
      };

      ws.onclose = (event) => {
        debugLog('[useTwitchChat]', '<<<< WEBSOCKET CONNECTION CLOSED >>>>');
        debugLog('[useTwitchChat]', 'Close code:', event.code);
        debugLog('[useTwitchChat]', 'Close reason:', event.reason);
        debugLog('[useTwitchChat]', 'Was clean:', event.wasClean);
        debugLog('[useTwitchChat]', 'ReadyState:', ws.readyState);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } else if (wsRef.current.readyState === WebSocket.OPEN && previousChannelsRef.current !== channelsKey) {
      // 既に接続済みで、チャンネルリストが実際に変更された場合のみ購読を更新
      debugLog('[useTwitchChat]', '==== RESUBSCRIBING TO CHANNELS ====');
      debugLog('[useTwitchChat]', 'Previous channels:', previousChannelsRef.current);
      debugLog('[useTwitchChat]', 'New channels:', channelsKey);

      const resubscribeMessage = {
        type: 'subscribe',
        channels: channels.map(ch => ch.login),
        channelMapping: Object.fromEntries(channels.map(ch => [ch.login, ch.displayName])),
        channelIdMapping: Object.fromEntries(
          channels.filter(ch => ch.channelId).map(ch => [ch.login, ch.channelId!])
        )
      };
      debugLog('[useTwitchChat]', '→ Sending resubscribe message:', resubscribeMessage);
      wsRef.current.send(JSON.stringify(resubscribeMessage));
      previousChannelsRef.current = channelsKey;
      debugLog('[useTwitchChat]', '✓ Resubscribe message sent successfully');
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
