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
   * 今日のPV統計を取得（最適化版：生SQLでCOUNT(DISTINCT)を使用）
   */
  async getTodayStats(): Promise<{
    pv: number;
    uniqueUsers: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1クエリで集計（メモリ効率的）
      const result = await prisma.$queryRaw<Array<{
        pv: bigint;
        unique_users: bigint;
      }>>`
        SELECT
          COUNT(*) as pv,
          COUNT(DISTINCT ip_hash) as unique_users
        FROM page_views
        WHERE created_at >= ${today}
      `;

      if (result.length === 0) {
        return { pv: 0, uniqueUsers: 0 };
      }

      return {
        pv: Number(result[0].pv),
        uniqueUsers: Number(result[0].unique_users),
      };
    } catch (error) {
      console.error('[PVTrackerService] Error getting today stats:', error);
      return { pv: 0, uniqueUsers: 0 };
    }
  }

  /**
   * 今月のPV統計を取得（最適化版：生SQLでCOUNT(DISTINCT)を使用）
   */
  async getMonthStats(): Promise<{
    pv: number;
    uniqueUsers: number;
  }> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // 1クエリで集計（メモリ効率的）
      const result = await prisma.$queryRaw<Array<{
        pv: bigint;
        unique_users: bigint;
      }>>`
        SELECT
          COUNT(*) as pv,
          COUNT(DISTINCT ip_hash) as unique_users
        FROM page_views
        WHERE created_at >= ${startOfMonth}
      `;

      if (result.length === 0) {
        return { pv: 0, uniqueUsers: 0 };
      }

      return {
        pv: Number(result[0].pv),
        uniqueUsers: Number(result[0].unique_users),
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
   * 過去N日分の日次PVを取得（最適化版：生SQLでCOUNT(DISTINCT)を使用）
   */
  async getDailyStats(days: number = 30): Promise<
    Array<{
      date: string;
      pv: number;
      uniqueUsers: number;
    }>
  > {
    try {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days + 1);
      startDate.setHours(0, 0, 0, 0);

      // 1クエリで全期間のデータを集計（メモリ効率的）
      const result = await prisma.$queryRaw<Array<{
        date: string;
        pv: bigint;
        unique_users: bigint;
      }>>`
        SELECT
          DATE(created_at AT TIME ZONE 'Asia/Tokyo') as date,
          COUNT(*) as pv,
          COUNT(DISTINCT ip_hash) as unique_users
        FROM page_views
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at AT TIME ZONE 'Asia/Tokyo')
        ORDER BY date ASC
      `;

      // BigIntをNumberに変換
      return result.map(row => ({
        date: row.date,
        pv: Number(row.pv),
        uniqueUsers: Number(row.unique_users)
      }));
    } catch (error) {
      console.error('[PVTrackerService] Error getting daily stats:', error);
      return [];
    }
  }

  /**
   * 過去N月分の月次PVを取得（最適化版：生SQLでCOUNT(DISTINCT)を使用）
   */
  async getMonthlyStats(months: number = 12): Promise<
    Array<{
      month: string;
      pv: number;
      uniqueUsers: number;
    }>
  > {
    try {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - months + 1);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      // 1クエリで全期間のデータを集計（メモリ効率的）
      const result = await prisma.$queryRaw<Array<{
        month: string;
        pv: bigint;
        unique_users: bigint;
      }>>`
        SELECT
          TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM') as month,
          COUNT(*) as pv,
          COUNT(DISTINCT ip_hash) as unique_users
        FROM page_views
        WHERE created_at >= ${startDate}
        GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM')
        ORDER BY month ASC
      `;

      // BigIntをNumberに変換
      return result.map(row => ({
        month: row.month,
        pv: Number(row.pv),
        uniqueUsers: Number(row.unique_users)
      }));
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
