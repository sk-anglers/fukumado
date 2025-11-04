/**
 * Alert Service
 * アラート・通知の管理サービス
 */

import prisma from './prismaService';

export type AlertType = 'cpu_high' | 'memory_high' | 'rate_limit_low' | 'quota_low' | 'security' | 'error_spike';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface CreateAlertInput {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: Record<string, any>;
}

class AlertService {
  /**
   * アラートを作成
   */
  async createAlert(input: CreateAlertInput): Promise<void> {
    try {
      // アラート設定を確認
      const setting = await prisma.alertSetting.findUnique({
        where: { type: input.type }
      });

      // 設定が無効の場合はアラートを作成しない
      if (setting && !setting.enabled) {
        console.log(`[AlertService] Alert type "${input.type}" is disabled, skipping`);
        return;
      }

      await prisma.alert.create({
        data: {
          type: input.type,
          severity: input.severity,
          title: input.title,
          message: input.message,
          details: input.details || undefined
        }
      });

      console.log(`[AlertService] Alert created: ${input.type} - ${input.title}`);
    } catch (error) {
      console.error('[AlertService] Failed to create alert:', error);
    }
  }

  /**
   * アラート一覧を取得
   */
  async getAlerts(options: {
    limit?: number;
    offset?: number;
    type?: AlertType;
    severity?: AlertSeverity;
    acknowledged?: boolean;
    resolved?: boolean;
  }) {
    const {
      limit = 50,
      offset = 0,
      type,
      severity,
      acknowledged,
      resolved
    } = options;

    const where: any = {};

    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (acknowledged !== undefined) where.acknowledged = acknowledged;
    if (resolved !== undefined) where.resolved = resolved;

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.alert.count({ where })
    ]);

    // BigInt を String に変換
    return {
      alerts: alerts.map(alert => ({
        ...alert,
        id: alert.id.toString()
      })),
      total,
      limit,
      offset
    };
  }

  /**
   * 未読アラート数を取得
   */
  async getUnreadCount(): Promise<number> {
    return prisma.alert.count({
      where: {
        acknowledged: false,
        resolved: false
      }
    });
  }

  /**
   * アラートを確認済みにする
   */
  async acknowledgeAlert(id: string, acknowledgedBy: string): Promise<void> {
    await prisma.alert.update({
      where: { id: BigInt(id) },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy
      }
    });

    console.log(`[AlertService] Alert ${id} acknowledged by ${acknowledgedBy}`);
  }

  /**
   * アラートを解決済みにする
   */
  async resolveAlert(id: string): Promise<void> {
    await prisma.alert.update({
      where: { id: BigInt(id) },
      data: {
        resolved: true,
        resolvedAt: new Date()
      }
    });

    console.log(`[AlertService] Alert ${id} resolved`);
  }

  /**
   * アラート設定を取得
   */
  async getSettings() {
    return prisma.alertSetting.findMany({
      orderBy: { type: 'asc' }
    });
  }

  /**
   * アラート設定を更新
   */
  async updateSetting(
    type: AlertType,
    data: {
      enabled?: boolean;
      threshold?: number | null;
      notifyEmail?: boolean;
      notifySlack?: boolean;
      notifyWebhook?: boolean;
    }
  ): Promise<void> {
    await prisma.alertSetting.update({
      where: { type },
      data
    });

    console.log(`[AlertService] Setting for "${type}" updated`);
  }

  /**
   * 古いアラートをクリーンアップ
   */
  async cleanup(days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.alert.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        resolved: true
      }
    });

    console.log(`[AlertService] Cleaned up ${result.count} alerts older than ${days} days`);
    return result.count;
  }
}

export const alertService = new AlertService();
