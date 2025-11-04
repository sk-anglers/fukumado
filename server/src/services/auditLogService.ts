/**
 * Audit Log Service
 * 管理者操作の監査ログを記録するサービス
 */

import prisma from './prismaService';

export interface AuditLogEntry {
  action: string;
  actor: string;
  actorIp: string;
  actorAgent?: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, any>;
  status: 'success' | 'failure';
  errorMessage?: string;
}

class AuditLogService {
  /**
   * 監査ログを記録
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          actor: entry.actor,
          actorIp: entry.actorIp,
          actorAgent: entry.actorAgent || undefined,
          targetType: entry.targetType,
          targetId: entry.targetId || undefined,
          details: entry.details || undefined,
          status: entry.status,
          errorMessage: entry.errorMessage || undefined
        }
      });
      console.log(`[AuditLog] Recorded: ${entry.action} by ${entry.actor} (${entry.status})`);
    } catch (error) {
      // 監査ログの記録失敗はコンソールに出力するのみ（例外は投げない）
      console.error('[AuditLog] Failed to record audit log:', error);
    }
  }

  /**
   * 監査ログ一覧を取得
   */
  async getLogs(options: {
    limit?: number;
    offset?: number;
    action?: string;
    actor?: string;
    actorIp?: string;
    targetType?: string;
    status?: 'success' | 'failure';
    startDate?: Date;
    endDate?: Date;
  }) {
    const {
      limit = 100,
      offset = 0,
      action,
      actor,
      actorIp,
      targetType,
      status,
      startDate,
      endDate
    } = options;

    const where: any = {};

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    if (actor) {
      where.actor = { contains: actor, mode: 'insensitive' };
    }

    if (actorIp) {
      where.actorIp = actorIp;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    return {
      logs,
      total,
      limit,
      offset
    };
  }

  /**
   * 監査ログサマリーを取得
   */
  async getSummary(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalLogs, successCount, failureCount, actionCounts] = await Promise.all([
      // 総ログ数
      prisma.auditLog.count({
        where: { createdAt: { gte: startDate } }
      }),

      // 成功数
      prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate },
          status: 'success'
        }
      }),

      // 失敗数
      prisma.auditLog.count({
        where: {
          createdAt: { gte: startDate },
          status: 'failure'
        }
      }),

      // 操作種別ごとのカウント
      prisma.$queryRaw<Array<{ action: string; count: bigint }>>`
        SELECT action, COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= ${startDate}
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      `
    ]);

    return {
      period: { days, startDate, endDate: new Date() },
      totalLogs,
      successCount,
      failureCount,
      topActions: actionCounts.map(item => ({
        action: item.action,
        count: Number(item.count)
      }))
    };
  }

  /**
   * 古い監査ログをクリーンアップ（指定日数より古いログを削除）
   */
  async cleanup(days: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });

    console.log(`[AuditLog] Cleaned up ${result.count} logs older than ${days} days`);
    return result.count;
  }
}

export const auditLogService = new AuditLogService();
