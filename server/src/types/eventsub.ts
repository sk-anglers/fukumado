/**
 * Twitch EventSub 関連の型定義
 */

/**
 * EventSub セッション情報
 */
export interface EventSubSession {
  id: string;
  status: string;
  connected_at: string;
  keepalive_timeout_seconds: number;
  reconnect_url?: string;
}

/**
 * EventSub メッセージ
 */
export interface EventSubMessage {
  metadata: {
    message_id: string;
    message_type: string;
    message_timestamp: string;
    subscription_type?: string;
    subscription_version?: string;
  };
  payload: {
    session?: EventSubSession;
    subscription?: {
      id: string;
      status: string;
      type: string;
      version: string;
      condition: Record<string, string>;
      transport: {
        method: string;
        session_id: string;
      };
      created_at: string;
    };
    event?: {
      id: string;
      broadcaster_user_id: string;
      broadcaster_user_login: string;
      broadcaster_user_name: string;
      type?: string;
      started_at?: string;
    };
  };
}

/**
 * 配信イベントの型
 */
export type StreamEventType = 'online' | 'offline';

/**
 * 配信イベント
 */
export interface StreamEvent {
  type: StreamEventType;
  broadcasterId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  startedAt?: string;
}

/**
 * 配信イベントハンドラー
 */
export type StreamEventHandler = (event: StreamEvent) => void;

/**
 * 接続ステータス
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * EventSub接続の統計情報
 */
export interface ConnectionStats {
  index: number;
  status: ConnectionStatus;
  sessionId: string | null;
  subscriptionCount: number;
  subscribedUserIds: string[];
  connectedAt: string | null;
}

/**
 * EventSubManager の統計情報
 */
export interface ManagerStats {
  mode: 'websocket' | 'conduit';
  totalConnections: number;
  activeConnections: number;
  totalSubscriptions: number;
  subscribedChannelCount: number;
  connections: ConnectionStats[];
  conduitStats?: {
    conduitId: string | null;
    totalShards: number;
    enabledShards: number;
    disabledShards: number;
    totalSubscriptions: number;
    usagePercentage: number;
  };
}

/**
 * EventSub イベント履歴
 */
export interface EventSubHistoryItem extends StreamEvent {
  timestamp: string;
  id: string;
}
