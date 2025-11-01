/**
 * Twitch EventSub Conduits用の型定義
 *
 * 公式ドキュメント: https://dev.twitch.tv/docs/eventsub/handling-conduit-events/
 */

/**
 * Conduit Transport タイプ
 */
export type ConduitTransportMethod = 'webhook' | 'websocket';

/**
 * Conduit Transport
 */
export interface ConduitTransport {
  method: ConduitTransportMethod;
  /** WebSocketの場合のみ必須 */
  session_id?: string;
  /** Webhookの場合のみ必須 */
  callback?: string;
}

/**
 * Conduit Shard
 */
export interface ConduitShard {
  id: string;
  status: 'enabled' | 'webhook_callback_verification_pending' | 'webhook_callback_verification_failed' | 'notification_failures_exceeded' | 'websocket_disconnected' | 'websocket_failed_ping_pong' | 'websocket_received_inbound_traffic' | 'websocket_connection_unused' | 'websocket_internal_error' | 'websocket_network_timeout' | 'websocket_network_error';
  transport: ConduitTransport;
}

/**
 * Conduit情報
 */
export interface Conduit {
  id: string;
  shard_count: number;
}

/**
 * Conduit作成レスポンス
 */
export interface CreateConduitResponse {
  data: Conduit[];
}

/**
 * Conduit更新レスポンス
 */
export interface UpdateConduitResponse {
  data: Conduit[];
}

/**
 * Conduit取得レスポンス
 */
export interface GetConduitsResponse {
  data: Conduit[];
}

/**
 * Conduit削除レスポンス（空）
 */
export interface DeleteConduitResponse {
  // 204 No Content
}

/**
 * シャード更新リクエスト
 */
export interface UpdateShardsRequest {
  conduit_id: string;
  shards: Array<{
    id: string;
    transport: ConduitTransport;
  }>;
}

/**
 * シャード更新レスポンス
 */
export interface UpdateShardsResponse {
  data: ConduitShard[];
  errors?: Array<{
    id: string;
    message: string;
    code: string;
  }>;
}

/**
 * シャード取得レスポンス
 */
export interface GetShardsResponse {
  data: ConduitShard[];
  pagination?: {
    cursor?: string;
  };
}

/**
 * Conduit統計情報
 */
export interface ConduitStats {
  conduitId: string | null;
  totalShards: number;
  enabledShards: number;
  disabledShards: number;
  totalSubscriptions: number;
  usagePercentage: number;
}
