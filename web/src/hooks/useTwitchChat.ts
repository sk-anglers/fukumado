import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import type { ChatMessage } from '../types';
import { backendOrigin } from '../utils/api';

const WS_URL = backendOrigin.replace(/^http/, 'ws') + '/chat';

interface TwitchChannel {
  login: string;
  displayName: string;
  channelId?: string;
}

export const useTwitchChat = (channels: TwitchChannel[]): void => {
  console.error('🔥🔥🔥 [useTwitchChat] HOOK CALLED - DEPLOY CHECK:', new Date().toISOString(), 'channels:', channels);

  const wsRef = useRef<WebSocket | null>(null);
  const previousChannelsRef = useRef<string>('');
  const addMessage = useChatStore((state) => state.addMessage);

  // チャンネルリストを文字列化して比較用に保持
  const channelsKey = JSON.stringify(channels.map(ch => ch.login).sort());

  useEffect(() => {
    console.error('⚠️⚠️⚠️ [useTwitchChat] useEffect TRIGGERED, channels.length:', channels.length);

    // WebSocket接続を確立（初回のみ）
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      console.error('🔥 [useTwitchChat] Creating NEW WebSocket connection to:', WS_URL);
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.error('✅✅✅ [useTwitchChat] WebSocket connection OPENED');
        wsRef.current = ws;

        // チャンネル購読を送信
        console.warn('⚠️ [useTwitchChat] Checking channels to subscribe, channels.length:', channels.length);
        if (channels.length > 0) {
          console.error('📤📤📤 [useTwitchChat] SENDING subscribe message for channels:', channels.map(ch => ch.login));
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
          console.error('📨📨📨 [useTwitchChat] MESSAGE RECEIVED:', message);

          // チャットメッセージのみを処理（typeフィールドがない、またはplatformがtwitchのメッセージ）
          // EventSub通知、配信リスト更新、優先度変更などは無視する
          if (message.type && message.type !== 'chat') {
            console.warn('⚠️ [useTwitchChat] Ignoring non-chat message:', message.type);
            return;
          }

          // チャットメッセージかどうかを確認（platformまたはchannelLoginフィールドの存在）
          if (!message.platform && !message.channelLogin) {
            console.warn('⚠️ [useTwitchChat] Ignoring message without platform/channelLogin');
            return;
          }

          console.error('💬 [useTwitchChat] PROCESSING chat message:', {
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

          console.error('✅ [useTwitchChat] ADDING MESSAGE TO STORE:', chatMessage);
          addMessage(chatMessage);
        } catch (error) {
          console.error('❌❌❌ [useTwitchChat] ERROR parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌❌❌ [useTwitchChat] WEBSOCKET ERROR:', error);
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
