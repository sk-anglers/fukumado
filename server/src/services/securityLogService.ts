import prisma from './prismaService';
import { createHash } from 'crypto';
import { Request, Response } from 'express';

/**
 * セキュリティログタイプ
 */
export type SecurityLogType = 'block' | 'rate_limit' | 'anomaly' | 'auth_failed' | 'websocket';

/**
 * セキュリティログサービス（PostgreSQL版）
 * SecurityLogテーブルを使用してセキュリティイベントを記録・管理
 */
export class SecurityLogService {
  /**
   * セキュリティログを追加
   */
  async addSecurityLog(
    type: SecurityLogType,
    ip: string,
    reason: string,
    path?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const ipHash = this.hashIP(ip);

      await prisma.securityLog.create({
        data: {
          logType: type,
          severity: this.getSeverity(type),
          ip,
          ipHash,
          endpoint: path || null,
          method: null,
          statusCode: null,
          userAgent: null,
          message: reason,
          metadata: metadata ? metadata : undefined,
          userId: null,
          username: null,
        },
      });
    } catch (error) {
      console.error('[SecurityLogService] Error adding security log:', error);
    }
  }

  /**
   * アクセスログを追加（HTTPリクエスト）
   */
  async addAccessLog(req: Request, res: Response, responseTime: number): Promise<void> {
    try {
      const ip = req.ip || 'unknown';
      const ipHash = this.hashIP(ip);

      // 4xx/5xxの場合はセキュリティログとして記録
      if (res.statusCode >= 400) {
        await prisma.securityLog.create({
          data: {
            logType: res.statusCode >= 500 ? 'anomaly' : 'auth_failed',
            severity: res.statusCode >= 500 ? 'error' : 'warn',
            ip,
            ipHash,
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            userAgent: req.headers['user-agent'] || null,
            message: `HTTP ${res.statusCode} - ${req.method} ${req.path}`,
            metadata: {
              responseTime,
              sessionId: (req as any).sessionID,
            },
            userId: null,
            username: null,
          },
        });
      }
    } catch (error) {
      console.error('[SecurityLogService] Error adding access log:', error);
    }
  }

  /**
   * エラーログを追加
   */
  async addErrorLog(
    level: 'error' | 'warn',
    message: string,
    stack?: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.securityLog.create({
        data: {
          logType: 'anomaly',
          severity: level,
          ip: context?.ip || 'unknown',
          ipHash: this.hashIP(context?.ip || 'unknown'),
          endpoint: context?.path || null,
          method: context?.method || null,
          statusCode: context?.statusCode || null,
          userAgent: null,
          message,
          metadata: {
            stack,
            ...context,
          },
          userId: null,
          username: null,
        },
      });
    } catch (error) {
      console.error('[SecurityLogService] Error adding error log:', error);
    }
  }

  /**
   * セキュリティログを取得（フィルタリング付き）
   */
  async getSecurityLogs(options: {
    limit?: number;
    offset?: number;
    type?: SecurityLogType;
    searchIp?: string;
  }): Promise<{ logs: any[]; total: number }> {
    try {
      const where: any = {};

      if (options.type) {
        where.logType = options.type;
      }

      if (options.searchIp) {
        where.ip = {
          contains: options.searchIp,
        };
      }

      const [logs, total] = await Promise.all([
        prisma.securityLog.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          take: options.limit || 100,
          skip: options.offset || 0,
        }),
        prisma.securityLog.count({ where }),
      ]);

      return {
        logs: logs.map((log) => ({
          id: log.id.toString(),
          timestamp: log.createdAt.toISOString(),
          type: log.logType,
          ip: log.ip,
          path: log.endpoint,
          reason: log.message,
          metadata: log.metadata,
        })),
        total,
      };
    } catch (error) {
      console.error('[SecurityLogService] Error getting security logs:', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * アクセスログを取得（HTTPリクエスト）
   */
  async getAccessLogs(options: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    method?: string;
    statusCode?: number;
    searchPath?: string;
  }): Promise<{ logs: any[]; total: number }> {
    try {
      const where: any = {
        statusCode: {
          not: null,
        },
      };

      if (options.startDate) {
        where.createdAt = { ...where.createdAt, gte: new Date(options.startDate) };
      }
      if (options.endDate) {
        where.createdAt = { ...where.createdAt, lte: new Date(options.endDate) };
      }
      if (options.method) {
        where.method = options.method;
      }
      if (options.statusCode) {
        where.statusCode = options.statusCode;
      }
      if (options.searchPath) {
        where.endpoint = {
          contains: options.searchPath,
        };
      }

      const [logs, total] = await Promise.all([
        prisma.securityLog.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          take: options.limit || 100,
          skip: options.offset || 0,
        }),
        prisma.securityLog.count({ where }),
      ]);

      return {
        logs: logs.map((log) => ({
          id: log.id.toString(),
          timestamp: log.createdAt.toISOString(),
          ip: log.ip,
          method: log.method,
          path: log.endpoint,
          statusCode: log.statusCode,
          responseTime: (log.metadata as any)?.responseTime || 0,
          userAgent: log.userAgent || 'unknown',
          sessionId: (log.metadata as any)?.sessionId,
        })),
        total,
      };
    } catch (error) {
      console.error('[SecurityLogService] Error getting access logs:', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * エラーログを取得
   */
  async getErrorLogs(options: {
    limit?: number;
    offset?: number;
    level?: 'error' | 'warn';
    searchMessage?: string;
  }): Promise<{ logs: any[]; total: number }> {
    try {
      const where: any = {
        logType: 'anomaly',
      };

      if (options.level) {
        where.severity = options.level;
      }

      if (options.searchMessage) {
        where.message = {
          contains: options.searchMessage,
          mode: 'insensitive',
        };
      }

      const [logs, total] = await Promise.all([
        prisma.securityLog.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          take: options.limit || 100,
          skip: options.offset || 0,
        }),
        prisma.securityLog.count({ where }),
      ]);

      return {
        logs: logs.map((log) => ({
          id: log.id.toString(),
          timestamp: log.createdAt.toISOString(),
          level: log.severity,
          message: log.message,
          stack: (log.metadata as any)?.stack,
          context: log.metadata,
        })),
        total,
      };
    } catch (error) {
      console.error('[SecurityLogService] Error getting error logs:', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * ログサマリーを取得
   */
  async getSummary(): Promise<{
    totalAccessLogs: number;
    totalErrorLogs: number;
    totalSecurityLogs: number;
    recentErrors: number;
    recentSecurityEvents: number;
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [accessLogs, errorLogs, securityLogs, recentErrors, recentSecurityEvents] =
        await Promise.all([
          // アクセスログ総数（statusCodeがnullでないもの）
          prisma.securityLog.count({
            where: {
              statusCode: { not: null },
            },
          }),
          // エラーログ総数（anomalyタイプ）
          prisma.securityLog.count({
            where: {
              logType: 'anomaly',
            },
          }),
          // セキュリティログ総数（anomaly以外）
          prisma.securityLog.count({
            where: {
              logType: { not: 'anomaly' },
            },
          }),
          // 直近1時間のエラー
          prisma.securityLog.count({
            where: {
              logType: 'anomaly',
              createdAt: { gte: oneHourAgo },
            },
          }),
          // 直近1時間のセキュリティイベント
          prisma.securityLog.count({
            where: {
              logType: { not: 'anomaly' },
              createdAt: { gte: oneHourAgo },
            },
          }),
        ]);

      return {
        totalAccessLogs: accessLogs,
        totalErrorLogs: errorLogs,
        totalSecurityLogs: securityLogs,
        recentErrors,
        recentSecurityEvents,
      };
    } catch (error) {
      console.error('[SecurityLogService] Error getting summary:', error);
      return {
        totalAccessLogs: 0,
        totalErrorLogs: 0,
        totalSecurityLogs: 0,
        recentErrors: 0,
        recentSecurityEvents: 0,
      };
    }
  }

  /**
   * ログをクリア（指定タイプ）
   */
  async clearLogs(type: 'access' | 'error' | 'security' | 'all'): Promise<void> {
    try {
      switch (type) {
        case 'access':
          await prisma.securityLog.deleteMany({
            where: { statusCode: { not: null } },
          });
          break;
        case 'error':
          await prisma.securityLog.deleteMany({
            where: { logType: 'anomaly' },
          });
          break;
        case 'security':
          await prisma.securityLog.deleteMany({
            where: { logType: { not: 'anomaly' } },
          });
          break;
        case 'all':
          await prisma.securityLog.deleteMany({});
          break;
      }
    } catch (error) {
      console.error('[SecurityLogService] Error clearing logs:', error);
      throw error;
    }
  }

  /**
   * タイプに応じた深刻度を取得
   */
  private getSeverity(type: SecurityLogType): string {
    switch (type) {
      case 'block':
      case 'rate_limit':
        return 'warn';
      case 'anomaly':
      case 'auth_failed':
        return 'error';
      case 'websocket':
        return 'info';
      default:
        return 'info';
    }
  }

  /**
   * IPアドレスをハッシュ化
   */
  private hashIP(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').substring(0, 64);
  }
}
