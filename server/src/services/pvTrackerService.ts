import prisma from './prismaService';
import { createHash } from 'crypto';

/**
 * PV計測サービス（PostgreSQL版）
 * PageViewテーブルを使用してページビューを記録・集計
 */
export class PVTrackerService {
  /**
   * PVをカウント
   */
  async trackPageView(
    ip: string,
    path: string,
    referrer?: string,
    userAgent?: string,
    userId?: string,
    deviceType?: string
  ): Promise<void> {
    try {
      const ipHash = this.hashIP(ip);

      await prisma.pageView.create({
        data: {
          ipHash,
          path,
          referrer: referrer || null,
          userAgent: userAgent || null,
          userId: userId || null,
          deviceType: deviceType || null,
        },
      });
    } catch (error) {
      console.error('[PVTrackerService] Error tracking page view:', error);
    }
  }

  /**
   * 今日のPV統計を取得
   */
  async getTodayStats(): Promise<{
    pv: number;
    uniqueUsers: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [pvCount, uniqueCount] = await Promise.all([
        // 総PV数
        prisma.pageView.count({
          where: {
            createdAt: {
              gte: today,
            },
          },
        }),
        // ユニークユーザー数（IPハッシュでカウント）
        prisma.pageView.findMany({
          where: {
            createdAt: {
              gte: today,
            },
          },
          select: {
            ipHash: true,
          },
          distinct: ['ipHash'],
        }),
      ]);

      return {
        pv: pvCount,
        uniqueUsers: uniqueCount.length,
      };
    } catch (error) {
      console.error('[PVTrackerService] Error getting today stats:', error);
      return { pv: 0, uniqueUsers: 0 };
    }
  }

  /**
   * 今月のPV統計を取得
   */
  async getMonthStats(): Promise<{
    pv: number;
    uniqueUsers: number;
  }> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [pvCount, uniqueCount] = await Promise.all([
        prisma.pageView.count({
          where: {
            createdAt: {
              gte: startOfMonth,
            },
          },
        }),
        prisma.pageView.findMany({
          where: {
            createdAt: {
              gte: startOfMonth,
            },
          },
          select: {
            ipHash: true,
          },
          distinct: ['ipHash'],
        }),
      ]);

      return {
        pv: pvCount,
        uniqueUsers: uniqueCount.length,
      };
    } catch (error) {
      console.error('[PVTrackerService] Error getting month stats:', error);
      return { pv: 0, uniqueUsers: 0 };
    }
  }

  /**
   * 累計PVを取得
   */
  async getTotalPV(): Promise<number> {
    try {
      const total = await prisma.pageView.count();
      return total;
    } catch (error) {
      console.error('[PVTrackerService] Error getting total PV:', error);
      return 0;
    }
  }

  /**
   * 過去N日分の日次PVを取得
   */
  async getDailyStats(days: number = 30): Promise<
    Array<{
      date: string;
      pv: number;
      uniqueUsers: number;
    }>
  > {
    try {
      const stats: Array<{ date: string; pv: number; uniqueUsers: number }> = [];
      const now = new Date();

      for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const dateKey = this.getDateKey(date);

        const [pvCount, uniqueIPs] = await Promise.all([
          prisma.pageView.count({
            where: {
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          }),
          prisma.pageView.findMany({
            where: {
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
            select: {
              ipHash: true,
            },
            distinct: ['ipHash'],
          }),
        ]);

        stats.push({
          date: dateKey,
          pv: pvCount,
          uniqueUsers: uniqueIPs.length,
        });
      }

      return stats.reverse(); // 古い順に並び替え
    } catch (error) {
      console.error('[PVTrackerService] Error getting daily stats:', error);
      return [];
    }
  }

  /**
   * 過去N月分の月次PVを取得
   */
  async getMonthlyStats(months: number = 12): Promise<
    Array<{
      month: string;
      pv: number;
      uniqueUsers: number;
    }>
  > {
    try {
      const stats: Array<{ month: string; pv: number; uniqueUsers: number }> = [];
      const now = new Date();

      for (let i = 0; i < months; i++) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthKey = this.getMonthKey(date);

        const [pvCount, uniqueIPs] = await Promise.all([
          prisma.pageView.count({
            where: {
              createdAt: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
          }),
          prisma.pageView.findMany({
            where: {
              createdAt: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
            select: {
              ipHash: true,
            },
            distinct: ['ipHash'],
          }),
        ]);

        stats.push({
          month: monthKey,
          pv: pvCount,
          uniqueUsers: uniqueIPs.length,
        });
      }

      return stats.reverse(); // 古い順に並び替え
    } catch (error) {
      console.error('[PVTrackerService] Error getting monthly stats:', error);
      return [];
    }
  }

  /**
   * 全統計を取得
   */
  async getAllStats() {
    const [today, month, total, daily, monthly] = await Promise.all([
      this.getTodayStats(),
      this.getMonthStats(),
      this.getTotalPV(),
      this.getDailyStats(30),
      this.getMonthlyStats(12),
    ]);

    return {
      today,
      month,
      total,
      daily,
      monthly,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * バックアップをファイルに保存（互換性のため残す）
   */
  async backupToFile(): Promise<string> {
    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');

    try {
      const stats = await this.getAllStats();
      const backupDir = join(process.cwd(), 'backups');
      const filename = `pv-backup-${this.getDateKey(new Date())}.json`;
      const filepath = join(backupDir, filename);

      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }

      writeFileSync(filepath, JSON.stringify(stats, null, 2), 'utf-8');
      console.log(`[PVTrackerService] Backup saved to ${filepath}`);

      return filepath;
    } catch (error) {
      console.error('[PVTrackerService] Error backing up to file:', error);
      throw error;
    }
  }

  /**
   * 日付キーを取得 (YYYY-MM-DD)
   */
  private getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 月キーを取得 (YYYY-MM)
   */
  private getMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * IPアドレスをハッシュ化（プライバシー保護）
   */
  private hashIP(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').substring(0, 64);
  }
}
