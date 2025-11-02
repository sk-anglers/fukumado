/**
 * WebSocketシングルトンサービス
 * React Strict Modeの影響を受けないグローバル管理
 */

import { backendOrigin } from '../utils/api';

const WS_URL = backendOrigin.replace(/^http/, 'ws') + '/chat';

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Event) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private openHandlers: Set<ConnectionHandler> = new Set();
  private closeHandlers: Set<ConnectionHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isIntentionallyClosed = false;
  private heartbeatTimer: number | null = null;
  private readonly heartbeatInterval = 30000; // 30秒

  /**
   * WebSocket接続を確立（既に接続済みの場合は何もしない）
   */
  connect(): void {
    // 既に接続されている場合は何もしない
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocketService] Already connected or connecting');
      return;
    }

    console.log('[WebSocketService] Establishing connection...');
    this.isIntentionallyClosed = false;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WebSocketService] Connected successfully');
        this.reconnectAttempts = 0;

        // ハートビートを開始
        this.startHeartbeat();

        // 接続ハンドラーを実行
        this.openHandlers.forEach(handler => {
          try {
            handler();
          } catch (error) {
            console.error('[WebSocketService] Error in open handler:', error);
          }
        });
      };

      this.ws.onmessage = (event) => {
        console.error('📨📨📨 [WebSocketService] MESSAGE RECEIVED:', event.data);

        try {
          const data = JSON.parse(event.data);
          console.error('🔍 [WebSocketService] PARSED - type:', data.type, 'platform:', data.platform, 'channelLogin:', data.channelLogin);

          // 全てのメッセージハンドラーに通知
          this.messageHandlers.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              console.error('[WebSocketService] Error in message handler:', error);
            }
          });
        } catch (error) {
          console.error('[WebSocketService] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌❌❌ [WebSocketService] WEBSOCKET ERROR:', error);

        // エラーハンドラーを実行
        this.errorHandlers.forEach(handler => {
          try {
            handler(error);
          } catch (err) {
            console.error('[WebSocketService] Error in error handler:', err);
          }
        });
      };

      this.ws.onclose = () => {
        console.error('🔌 [WebSocketService] CONNECTION CLOSED');
        this.ws = null;

        // ハートビートを停止
        this.stopHeartbeat();

        // クローズハンドラーを実行
        this.closeHandlers.forEach(handler => {
          try {
            handler();
          } catch (error) {
            console.error('[WebSocketService] Error in close handler:', error);
          }
        });

        // 意図的なクローズでない場合は再接続を試みる
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
          console.log(`[WebSocketService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

          this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('[WebSocketService] Error creating WebSocket:', error);
    }
  }

  /**
   * WebSocket接続を切断
   */
  disconnect(): void {
    console.log('[WebSocketService] Disconnecting...');
    this.isIntentionallyClosed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  /**
   * メッセージを送信
   */
  send(data: any): boolean {
    console.error('📤 [WebSocketService] SEND called, ws exists:', !!this.ws, 'readyState:', this.ws?.readyState);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ [WebSocketService] Cannot send message: not connected');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      console.error('✅ [WebSocketService] Message SENT:', message);
      return true;
    } catch (error) {
      console.error('❌❌❌ [WebSocketService] Error sending message:', error);
      return false;
    }
  }

  /**
   * 接続状態を取得
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * ReadyStateを取得
   */
  getReadyState(): number | null {
    return this.ws?.readyState ?? null;
  }

  /**
   * メッセージハンドラーを登録
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);

    // クリーンアップ関数を返す
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * 接続ハンドラーを登録
   */
  onOpen(handler: ConnectionHandler): () => void {
    this.openHandlers.add(handler);

    // 既に接続済みの場合は即座に実行
    if (this.isConnected()) {
      try {
        handler();
      } catch (error) {
        console.error('[WebSocketService] Error in open handler:', error);
      }
    }

    return () => {
      this.openHandlers.delete(handler);
    };
  }

  /**
   * クローズハンドラーを登録
   */
  onClose(handler: ConnectionHandler): () => void {
    this.closeHandlers.add(handler);

    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  /**
   * エラーハンドラーを登録
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);

    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * 全てのハンドラーをクリア
   */
  clearAllHandlers(): void {
    this.messageHandlers.clear();
    this.openHandlers.clear();
    this.closeHandlers.clear();
    this.errorHandlers.clear();
  }

  /**
   * ハートビート送信を開始
   */
  private startHeartbeat(): void {
    // 既存のタイマーをクリア
    this.stopHeartbeat();

    console.error('💓 [WebSocketService] STARTING heartbeat (interval: 30s)');

    // 定期的にハートビートを送信
    this.heartbeatTimer = setInterval(() => {
      console.error('💓 [WebSocketService] HEARTBEAT TICK - isConnected:', this.isConnected());
      if (this.isConnected()) {
        console.error('💓 [WebSocketService] Sending heartbeat');
        this.send({ type: 'heartbeat' });
      }
    }, this.heartbeatInterval);
  }

  /**
   * ハートビート送信を停止
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      console.log('[WebSocketService] Stopping heartbeat');
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// グローバルシングルトンインスタンス
export const websocketService = new WebSocketService();
