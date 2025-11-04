import morgan from 'morgan';
import { Request, Response } from 'express';
import { SecurityLogService } from '../services/securityLogService';

// セキュリティログサービスのインスタンス
const securityLogService = new SecurityLogService();

/**
 * カスタムトークン定義
 */
// セッションIDトークン
morgan.token('session-id', (req: Request) => {
  return (req as any).sessionID || 'no-session';
});

// リアルIPアドレストークン（プロキシ経由の場合も考慮）
morgan.token('real-ip', (req: Request) => {
  return req.headers['x-forwarded-for']?.toString() || req.ip || 'unknown';
});

// レスポンス時間（ミリ秒）
morgan.token('response-time-ms', (req: Request, res: Response) => {
  const startTime = (req as any)._startTime;
  if (!startTime) return '0';
  return `${Date.now() - startTime}ms`;
});

/**
 * カスタムログフォーマット
 */
const customFormat = [
  '[:date[iso]]',
  ':real-ip',
  ':method',
  ':url',
  'HTTP/:http-version',
  ':status',
  ':res[content-length]',
  ':response-time ms',
  'session=:session-id',
  'user-agent=":user-agent"'
].join(' ');

/**
 * HTTPリクエストログミドルウェア（開発環境用）
 */
export const developmentLogger = morgan('dev', {
  skip: (req: Request) => {
    // ヘルスチェックはログ出力をスキップ
    return req.path === '/health';
  }
});

/**
 * HTTPリクエストログミドルウェア（本番環境用）
 */
export const productionLogger = morgan(customFormat, {
  skip: (req: Request) => {
    // ヘルスチェックはログ出力をスキップ
    return req.path === '/health';
  }
});

/**
 * 環境に応じたロガーを選択
 */
export const requestLogger = process.env.NODE_ENV === 'production'
  ? productionLogger
  : developmentLogger;

/**
 * エラーログミドルウェア
 * エラーレスポンス（4xx, 5xx）のみをログ出力
 */
export const errorLogger = morgan(customFormat, {
  skip: (req: Request, res: Response) => {
    // 2xx, 3xx のレスポンスはスキップ
    return res.statusCode < 400;
  }
});

/**
 * セキュリティ関連のログ
 */
export class SecurityLogger {
  /**
   * ブロックされたリクエストをログ出力
   */
  public static logBlockedRequest(
    ip: string,
    reason: string,
    path: string,
    metadata?: Record<string, any>
  ): void {
    const timestamp = new Date().toISOString();
    console.warn(`[Security Block] ${timestamp} - IP: ${ip} - Path: ${path} - Reason: ${reason}`, metadata || '');
    securityLogService.addSecurityLog('block', ip, reason, path, metadata);
  }

  /**
   * レート制限違反をログ出力
   */
  public static logRateLimitViolation(
    ip: string,
    path: string,
    currentCount: number,
    limit: number
  ): void {
    const timestamp = new Date().toISOString();
    console.warn(`[Rate Limit] ${timestamp} - IP: ${ip} - Path: ${path} - Count: ${currentCount}/${limit}`);
    securityLogService.addSecurityLog('rate_limit', ip, `Rate limit exceeded: ${currentCount}/${limit}`, path, { currentCount, limit });
  }

  /**
   * 異常なアクセスパターンをログ出力
   */
  public static logAnomalousActivity(
    ip: string,
    pattern: string,
    details: Record<string, any>
  ): void {
    const timestamp = new Date().toISOString();
    console.warn(`[Anomaly Detected] ${timestamp} - IP: ${ip} - Pattern: ${pattern}`, details);
    securityLogService.addSecurityLog('anomaly', ip, pattern, undefined, details);
  }

  /**
   * WebSocket接続イベントをログ出力
   */
  public static logWebSocketEvent(
    event: 'connect' | 'disconnect' | 'error' | 'message',
    ip: string,
    metadata?: Record<string, any>
  ): void {
    const timestamp = new Date().toISOString();
    const level = event === 'error' ? 'ERROR' : 'INFO';
    console.log(`[WebSocket ${level}] ${timestamp} - Event: ${event} - IP: ${ip}`, metadata || '');
  }

  /**
   * 認証関連イベントをログ出力
   */
  public static logAuthEvent(
    event: 'login' | 'logout' | 'token_refresh' | 'auth_failed',
    userId: string | null,
    ip: string,
    metadata?: Record<string, any>
  ): void {
    const timestamp = new Date().toISOString();
    const level = event === 'auth_failed' ? 'WARN' : 'INFO';
    console.log(`[Auth ${level}] ${timestamp} - Event: ${event} - User: ${userId || 'anonymous'} - IP: ${ip}`, metadata || '');
  }

  /**
   * データアクセスをログ出力（将来的な監査ログ用）
   */
  public static logDataAccess(
    userId: string,
    resource: string,
    action: 'read' | 'write' | 'delete',
    ip: string
  ): void {
    const timestamp = new Date().toISOString();
    console.log(`[Data Access] ${timestamp} - User: ${userId} - Resource: ${resource} - Action: ${action} - IP: ${ip}`);
  }
}

/**
 * アクセスログの統計情報を収集
 */
export class AccessLogStats {
  private requestCounts: Map<string, number> = new Map(); // path -> count
  private ipCounts: Map<string, number> = new Map(); // ip -> count
  private errorCounts: Map<number, number> = new Map(); // status code -> count
  private startTime: Date = new Date();

  /**
   * リクエストを記録
   */
  public recordRequest(req: Request, res: Response): void {
    // パスごとのカウント
    const path = req.path;
    this.requestCounts.set(path, (this.requestCounts.get(path) || 0) + 1);

    // IPごとのカウント
    const ip = req.ip || 'unknown';
    this.ipCounts.set(ip, (this.ipCounts.get(ip) || 0) + 1);

    // エラーステータスコードのカウント
    if (res.statusCode >= 400) {
      this.errorCounts.set(res.statusCode, (this.errorCounts.get(res.statusCode) || 0) + 1);
    }
  }

  /**
   * 統計情報を取得
   */
  public getStats(): {
    totalRequests: number;
    uniqueIPs: number;
    topPaths: Array<{ path: string; count: number }>;
    topIPs: Array<{ ip: string; count: number }>;
    errorBreakdown: Array<{ statusCode: number; count: number }>;
    uptime: number;
  } {
    // 総リクエスト数
    const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);

    // ユニークIP数
    const uniqueIPs = this.ipCounts.size;

    // トップパス（上位10件）
    const topPaths = Array.from(this.requestCounts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // トップIP（上位10件）
    const topIPs = Array.from(this.ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // エラー内訳
    const errorBreakdown = Array.from(this.errorCounts.entries())
      .map(([statusCode, count]) => ({ statusCode, count }))
      .sort((a, b) => b.count - a.count);

    // 稼働時間（秒）
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    return {
      totalRequests,
      uniqueIPs,
      topPaths,
      topIPs,
      errorBreakdown,
      uptime
    };
  }

  /**
   * 統計情報をリセット
   */
  public reset(): void {
    this.requestCounts.clear();
    this.ipCounts.clear();
    this.errorCounts.clear();
    this.startTime = new Date();
  }
}

// シングルトンインスタンス
export const accessLogStats = new AccessLogStats();

/**
 * アクセス統計を記録するミドルウェア
 */
export const recordAccessStats = (req: Request, res: Response, next: Function): void => {
  const startTime = Date.now();

  // レスポンス完了時に統計を記録
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    accessLogStats.recordRequest(req, res);

    // セキュリティログサービスに記録（非同期）
    securityLogService.addAccessLog(req, res, responseTime).catch((error) => {
      console.error('[Logging] Error adding access log:', error);
    });

    // エラーログも記録（4xx, 5xx）
    if (res.statusCode >= 400) {
      const message = `HTTP ${res.statusCode} - ${req.method} ${req.path}`;
      const level = res.statusCode >= 500 ? 'error' : 'warn';
      securityLogService.addErrorLog(level, message, undefined, {
        ip: req.ip,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode
      }).catch((error) => {
        console.error('[Logging] Error adding error log:', error);
      });
    }
  });

  next();
};
