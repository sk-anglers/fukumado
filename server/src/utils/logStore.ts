import { Request, Response } from 'express';

/**
 * アクセスログエントリ
 */
export interface AccessLogEntry {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  userAgent: string;
  sessionId?: string;
}

/**
 * エラーログエントリ
 */
export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

/**
 * セキュリティログエントリ
 */
export interface SecurityLogEntry {
  id: string;
  timestamp: string;
  type: 'block' | 'rate_limit' | 'anomaly' | 'auth_failed' | 'websocket';
  ip: string;
  path?: string;
  reason: string;
  metadata?: Record<string, any>;
}

/**
 * ログストア - メモリ内でログを保持
 */
class LogStore {
  private accessLogs: AccessLogEntry[] = [];
  private errorLogs: ErrorLogEntry[] = [];
  private securityLogs: SecurityLogEntry[] = [];

  private readonly MAX_ACCESS_LOGS = 1000;
  private readonly MAX_ERROR_LOGS = 500;
  private readonly MAX_SECURITY_LOGS = 500;

  /**
   * アクセスログを追加
   */
  public addAccessLog(req: Request, res: Response, responseTime: number): void {
    const entry: AccessLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ip: req.ip || 'unknown',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: (req as any).sessionID
    };

    this.accessLogs.unshift(entry);

    // 最大数を超えた場合は古いログを削除
    if (this.accessLogs.length > this.MAX_ACCESS_LOGS) {
      this.accessLogs.pop();
    }
  }

  /**
   * エラーログを追加
   */
  public addErrorLog(
    level: 'error' | 'warn',
    message: string,
    stack?: string,
    context?: Record<string, any>
  ): void {
    const entry: ErrorLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      stack,
      context
    };

    this.errorLogs.unshift(entry);

    if (this.errorLogs.length > this.MAX_ERROR_LOGS) {
      this.errorLogs.pop();
    }
  }

  /**
   * セキュリティログを追加
   */
  public addSecurityLog(
    type: SecurityLogEntry['type'],
    ip: string,
    reason: string,
    path?: string,
    metadata?: Record<string, any>
  ): void {
    const entry: SecurityLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type,
      ip,
      path,
      reason,
      metadata
    };

    this.securityLogs.unshift(entry);

    if (this.securityLogs.length > this.MAX_SECURITY_LOGS) {
      this.securityLogs.pop();
    }
  }

  /**
   * アクセスログを取得（フィルタリング付き）
   */
  public getAccessLogs(options: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    method?: string;
    statusCode?: number;
    searchPath?: string;
  }): { logs: AccessLogEntry[]; total: number } {
    let filtered = [...this.accessLogs];

    // 日時範囲フィルター
    if (options.startDate) {
      const start = new Date(options.startDate).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= start);
    }
    if (options.endDate) {
      const end = new Date(options.endDate).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= end);
    }

    // メソッドフィルター
    if (options.method) {
      filtered = filtered.filter(log => log.method === options.method);
    }

    // ステータスコードフィルター
    if (options.statusCode) {
      filtered = filtered.filter(log => log.statusCode === options.statusCode);
    }

    // パス検索
    if (options.searchPath) {
      filtered = filtered.filter(log => log.path.includes(options.searchPath!));
    }

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return {
      logs: filtered.slice(offset, offset + limit),
      total
    };
  }

  /**
   * エラーログを取得（フィルタリング付き）
   */
  public getErrorLogs(options: {
    limit?: number;
    offset?: number;
    level?: 'error' | 'warn';
    searchMessage?: string;
  }): { logs: ErrorLogEntry[]; total: number } {
    let filtered = [...this.errorLogs];

    // レベルフィルター
    if (options.level) {
      filtered = filtered.filter(log => log.level === options.level);
    }

    // メッセージ検索
    if (options.searchMessage) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(options.searchMessage!.toLowerCase())
      );
    }

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return {
      logs: filtered.slice(offset, offset + limit),
      total
    };
  }

  /**
   * セキュリティログを取得（フィルタリング付き）
   */
  public getSecurityLogs(options: {
    limit?: number;
    offset?: number;
    type?: SecurityLogEntry['type'];
    searchIp?: string;
  }): { logs: SecurityLogEntry[]; total: number } {
    let filtered = [...this.securityLogs];

    // タイプフィルター
    if (options.type) {
      filtered = filtered.filter(log => log.type === options.type);
    }

    // IP検索
    if (options.searchIp) {
      filtered = filtered.filter(log => log.ip.includes(options.searchIp!));
    }

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return {
      logs: filtered.slice(offset, offset + limit),
      total
    };
  }

  /**
   * ログサマリーを取得
   */
  public getSummary(): {
    totalAccessLogs: number;
    totalErrorLogs: number;
    totalSecurityLogs: number;
    recentErrors: number;
    recentSecurityEvents: number;
  } {
    // 直近1時間のエラー
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentErrors = this.errorLogs.filter(
      log => new Date(log.timestamp).getTime() > oneHourAgo
    ).length;

    // 直近1時間のセキュリティイベント
    const recentSecurityEvents = this.securityLogs.filter(
      log => new Date(log.timestamp).getTime() > oneHourAgo
    ).length;

    return {
      totalAccessLogs: this.accessLogs.length,
      totalErrorLogs: this.errorLogs.length,
      totalSecurityLogs: this.securityLogs.length,
      recentErrors,
      recentSecurityEvents
    };
  }

  /**
   * ログをクリア
   */
  public clearLogs(type: 'access' | 'error' | 'security' | 'all'): void {
    switch (type) {
      case 'access':
        this.accessLogs = [];
        break;
      case 'error':
        this.errorLogs = [];
        break;
      case 'security':
        this.securityLogs = [];
        break;
      case 'all':
        this.accessLogs = [];
        this.errorLogs = [];
        this.securityLogs = [];
        break;
    }
  }

  /**
   * ID生成
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// シングルトンインスタンス
export const logStore = new LogStore();
