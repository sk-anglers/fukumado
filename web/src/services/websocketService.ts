/**
 * WebSocketシングルトンサービス
 * React Strict Modeの影響を受けないグローバル管理
 */

import { backendOrigin } from '../utils/api';
import { debugLog, debugWarn, debugError } from '../utils/debugLog';

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
      debugLog('[WebSocketService]', 'Already connected or connecting, readyState:', this.ws.readyState);
      return;
    }

    debugLog('[WebSocketService]', '==== ESTABLISHING CONNECTION ====');
    debugLog('[WebSocketService]', 'WS_URL:', WS_URL);
    this.isIntentionallyClosed = false;

    try {
      this.ws = new WebSocket(WS_URL);
      debugLog('[WebSocketService]', 'WebSocket instance created');

      this.ws.onopen = () => {
        debugLog('[WebSocketService]', '<<<< CONNECTION OPENED >>>>');
        debugLog('[WebSocketService]', 'ReadyState:', this.ws?.readyState);
        this.reconnectAttempts = 0;

        // ハートビートを開始
        debugLog('[WebSocketService]', 'About to start heartbeat...');
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
        debugLog('[WebSocketService]', '<<<< MESSAGE RECEIVED >>>>');
        debugLog('[WebSocketService]', 'Event:', event);
        debugLog('[WebSocketService]', 'Raw data:', event.data);

        try {
          const data = JSON.parse(event.data);
          debugLog('[WebSocketService]', 'Parsed data:', data);
          debugLog('[WebSocketService]', 'Message type:', data.type || 'undefined');

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
        debugError('[WebSocketService]', '<<<< ERROR OCCURRED >>>>');
        debugError('[WebSocketService]', 'Error event:', error);
        debugError('[WebSocketService]', 'ReadyState:', this.ws?.readyState);

        // エラーハンドラーを実行
        this.errorHandlers.forEach(handler => {
          try {
            handler(error);
          } catch (err) {
            debugError('[WebSocketService]', 'Error in error handler:', err);
          }
        });
      };

      this.ws.onclose = (event) => {
        debugLog('[WebSocketService]', '<<<< CONNECTION CLOSED >>>>');
        debugLog('[WebSocketService]', 'Close code:', event.code);
        debugLog('[WebSocketService]', 'Close reason:', event.reason);
        debugLog('[WebSocketService]', 'Was clean:', event.wasClean);
        debugLog('[WebSocketService]', 'ReadyState:', this.ws?.readyState);
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
    debugLog('[WebSocketService]', '==== SEND CALLED ====');
    debugLog('[WebSocketService]', 'WS exists:', !!this.ws);
    debugLog('[WebSocketService]', 'ReadyState:', this.ws?.readyState);
    debugLog('[WebSocketService]', 'Data to send:', data);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      debugWarn('[WebSocketService]', 'Cannot send message: not connected');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      debugLog('[WebSocketService]', 'Stringified message:', message);
      debugLog('[WebSocketService]', 'About to call ws.send()...');
      this.ws.send(message);
      debugLog('[WebSocketService]', '✓ ws.send() completed successfully');
      return true;
    } catch (error) {
      debugError('[WebSocketService]', 'Error sending message:', error);
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

    debugLog('[WebSocketService]', '🫀 STARTING HEARTBEAT');
    debugLog('[WebSocketService]', 'Heartbeat interval:', this.heartbeatInterval, 'ms');

    // 定期的にハートビートを送信
    this.heartbeatTimer = setInterval(() => {
      debugLog('[WebSocketService]', '==== HEARTBEAT TICK ====');
      debugLog('[WebSocketService]', 'isConnected():', this.isConnected());
      debugLog('[WebSocketService]', 'ReadyState:', this.ws?.readyState);

      if (this.isConnected()) {
        debugLog('[WebSocketService]', '→ Sending heartbeat...');
        const result = this.send({ type: 'heartbeat' });
        debugLog('[WebSocketService]', 'Heartbeat send result:', result);
      } else {
        debugWarn('[WebSocketService]', '⊘ Cannot send heartbeat - not connected');
      }
    }, this.heartbeatInterval);

    debugLog('[WebSocketService]', '✓ Heartbeat timer started');
  }

  /**
   * ハートビート送信を停止
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      debugLog('[WebSocketService]', '🫀 STOPPING HEARTBEAT');
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      debugLog('[WebSocketService]', '✓ Heartbeat timer cleared');
    }
  }
}

// グローバルシングルトンインスタンス
export const websocketService = new WebSocketService();
