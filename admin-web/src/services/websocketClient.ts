import { WebSocketMessage, ConnectionStatus } from '../types';

type MessageHandler = (message: WebSocketMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

/**
 * WebSocketクライアント
 */
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000; // 3秒
  private messageHandlers: MessageHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private isIntentionallyClosed = false;

  /**
   * WebSocket接続を開始
   */
  connect() {
    this.isIntentionallyClosed = false;
    this.createConnection();
  }

  /**
   * WebSocket接続を作成
   */
  private createConnection() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/admin/ws`;

    console.log('[WebSocket] Connecting to:', wsUrl);
    this.notifyStatus('connecting');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.notifyStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.notifyStatus('error');
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.notifyStatus('disconnected');
        this.ws = null;

        // 意図的な切断でなければ再接続を試みる
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.notifyStatus('error');
      this.scheduleReconnect();
    }
  }

  /**
   * 再接続をスケジュール
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.notifyStatus('error');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  /**
   * WebSocket接続を切断
   */
  disconnect() {
    this.isIntentionallyClosed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.notifyStatus('disconnected');
  }

  /**
   * メッセージハンドラーを登録
   */
  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
  }

  /**
   * ステータスハンドラーを登録
   */
  onStatusChange(handler: StatusHandler) {
    this.statusHandlers.push(handler);
  }

  /**
   * メッセージハンドラーを解除
   */
  offMessage(handler: MessageHandler) {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
  }

  /**
   * ステータスハンドラーを解除
   */
  offStatusChange(handler: StatusHandler) {
    this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
  }

  /**
   * メッセージを送信
   */
  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  }

  /**
   * 接続状態を取得
   */
  getStatus(): ConnectionStatus {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  /**
   * メッセージを処理
   */
  private handleMessage(message: WebSocketMessage) {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error('[WebSocket] Message handler error:', error);
      }
    });
  }

  /**
   * ステータス変更を通知
   */
  private notifyStatus(status: ConnectionStatus) {
    this.statusHandlers.forEach((handler) => {
      try {
        handler(status);
      } catch (error) {
        console.error('[WebSocket] Status handler error:', error);
      }
    });
  }
}

// シングルトンインスタンス
export const websocketClient = new WebSocketClient();
