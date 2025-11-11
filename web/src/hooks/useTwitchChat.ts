import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import type { ChatMessage } from '../types';
import { websocketService } from '../services/websocketService';

interface TwitchChannel {
  login: string;
  displayName: string;
  channelId?: string;
}

export const useTwitchChat = (channels: TwitchChannel[]): void => {
  const previousChannelsRef = useRef<string>('');

  // チャンネルリストを文字列化して比較用に保持
  const channelsKey = JSON.stringify(channels.map(ch => ch.login).sort());

  useEffect(() => {
    // チャンネル購読メッセージを送信する関数
    const subscribeToChannels = () => {
      if (channels.length === 0) {
        return;
      }

      console.log('[useTwitchChat] Subscribing to channels:', channels.map(ch => ch.login));

      websocketService.send({
        type: 'subscribe',
        channels: channels.map(ch => ch.login),
        channelMapping: Object.fromEntries(channels.map(ch => [ch.login, ch.displayName])),
        channelIdMapping: Object.fromEntries(
          channels.filter(ch => ch.channelId).map(ch => [ch.login, ch.channelId!])
        )
      });

      previousChannelsRef.current = channelsKey;
    };

    // チャットメッセージハンドラー
    const handleMessage = (message: any) => {
      // チャットメッセージのみを処理（typeフィールドがない、またはtype='chat'のメッセージ）
      // EventSub通知、配信リスト更新、優先度変更などは無視する
      if (message.type && message.type !== 'chat') {
        return;
      }

      // チャットメッセージかどうかを確認（platformまたはchannelLoginフィールドの存在）
      if (!message.platform && !message.channelLogin) {
        return;
      }

      console.log('[useTwitchChat] Received message:', message);

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

      // 重複チェック：最近送信したメッセージかどうか確認
      console.log('[useTwitchChat] Checking for duplicate:');
      console.log('[useTwitchChat]   - Message:', chatMessage.message);
      console.log('[useTwitchChat]   - Author:', chatMessage.author);
      console.log('[useTwitchChat]   - Recent sent messages:', useChatStore.getState().recentlySentMessages);

      const isDuplicate = useChatStore.getState().isDuplicateSentMessage(
        chatMessage.message,
        chatMessage.author
      );

      console.log('[useTwitchChat]   - Is duplicate?', isDuplicate);

      if (isDuplicate) {
        console.log('[useTwitchChat] ✓ Skipping duplicate sent message');
        return;
      }

      console.log('[useTwitchChat] Adding chat message to store:', chatMessage);
      // getState()を使用してストアのアクションを直接呼び出す（再レンダリング防止）
      useChatStore.getState().addMessage(chatMessage);
    };

    // メッセージハンドラーを登録
    const unsubscribeMessage = websocketService.onMessage(handleMessage);

    // 接続完了時にチャンネル購読を送信
    const unsubscribeOpen = websocketService.onOpen(() => {
      console.log('[useTwitchChat] WebSocket connected, subscribing to channels');
      subscribeToChannels();
    });

    // 既に接続済みで、チャンネルリストが変更された場合は購読を更新
    if (websocketService.isConnected() && previousChannelsRef.current !== channelsKey) {
      subscribeToChannels();
    }

    // クリーンアップ：ハンドラーの登録解除
    return () => {
      unsubscribeMessage();
      unsubscribeOpen();
    };
  }, [channelsKey, channels]);
};
