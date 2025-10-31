import Redis from 'ioredis';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * PV計測サービス
 * Redisを使用して日次・月次・累計PVを記録
 */
export class PVTracker {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;

    // 毎日0時にバックアップを実行
    this.scheduleDailyBackup();
  }

  /**
   * PVをカウント
   */
  async trackPageView(ip: string): Promise<void> {
    const now = new Date();
    const dateKey = this.getDateKey(now);
    const monthKey = this.getMonthKey(now);

    try {
      // PVカウントをインクリメント
      await Promise.all([
        // 日次PV
        this.redis.incr(`pv:daily:${dateKey}`),
        this.redis.expire(`pv:daily:${dateKey}`, 60 * 60 * 24 * 90), // 90日間保持

        // 月次PV
        this.redis.incr(`pv:monthly:${monthKey}`),
        this.redis.expire(`pv:monthly:${monthKey}`, 60 * 60 * 24 * 365 * 2), // 2年間保持

        // 累計PV
        this.redis.incr('pv:total'),

        // ユニークユーザー（IP）
        this.redis.sadd(`pv:unique:daily:${dateKey}`, ip),
        this.redis.expire(`pv:unique:daily:${dateKey}`, 60 * 60 * 24 * 90),

        this.redis.sadd(`pv:unique:monthly:${monthKey}`, ip),
        this.redis.expire(`pv:unique:monthly:${monthKey}`, 60 * 60 * 24 * 365 * 2)
      ]);
    } catch (error) {
      console.error('[PVTracker] Error tracking page view:', error);
    }
  }

  /**
   * 今日のPV統計を取得
   */
  async getTodayStats(): Promise<{
    pv: number;
    uniqueUsers: number;
  }> {
    const dateKey = this.getDateKey(new Date());

    try {
      const [pv, uniqueUsers] = await Promise.all([
        this.redis.get(`pv:daily:${dateKey}`),
        this.redis.scard(`pv:unique:daily:${dateKey}`)
      ]);

      return {
        pv: parseInt(pv || '0', 10),
        uniqueUsers: uniqueUsers || 0
      };
    } catch (error) {
      console.error('[PVTracker] Error getting today stats:', error);
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
    const monthKey = this.getMonthKey(new Date());

    try {
      const [pv, uniqueUsers] = await Promise.all([
        this.redis.get(`pv:monthly:${monthKey}`),
        this.redis.scard(`pv:unique:monthly:${monthKey}`)
      ]);

      return {
        pv: parseInt(pv || '0', 10),
        uniqueUsers: uniqueUsers || 0
      };
    } catch (error) {
      console.error('[PVTracker] Error getting month stats:', error);
      return { pv: 0, uniqueUsers: 0 };
    }
  }

  /**
   * 累計PVを取得
   */
  async getTotalPV(): Promise<number> {
    try {
      const total = await this.redis.get('pv:total');
      return parseInt(total || '0', 10);
    } catch (error) {
      console.error('[PVTracker] Error getting total PV:', error);
      return 0;
    }
  }

  /**
   * 過去N日分の日次PVを取得
   */
  async getDailyStats(days: number = 30): Promise<Array<{
    date: string;
    pv: number;
    uniqueUsers: number;
  }>> {
    const stats: Array<{ date: string; pv: number; uniqueUsers: number }> = [];
    const now = new Date();

    try {
      for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateKey = this.getDateKey(date);

        const [pv, uniqueUsers] = await Promise.all([
          this.redis.get(`pv:daily:${dateKey}`),
          this.redis.scard(`pv:unique:daily:${dateKey}`)
        ]);

        stats.push({
          date: dateKey,
          pv: parseInt(pv || '0', 10),
          uniqueUsers: uniqueUsers || 0
        });
      }

      return stats.reverse(); // 古い順に並び替え
    } catch (error) {
      console.error('[PVTracker] Error getting daily stats:', error);
      return [];
    }
  }

  /**
   * 過去N月分の月次PVを取得
   */
  async getMonthlyStats(months: number = 12): Promise<Array<{
    month: string;
    pv: number;
    uniqueUsers: number;
  }>> {
    const stats: Array<{ month: string; pv: number; uniqueUsers: number }> = [];
    const now = new Date();

    try {
      for (let i = 0; i < months; i++) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const monthKey = this.getMonthKey(date);

        const [pv, uniqueUsers] = await Promise.all([
          this.redis.get(`pv:monthly:${monthKey}`),
          this.redis.scard(`pv:unique:monthly:${monthKey}`)
        ]);

        stats.push({
          month: monthKey,
          pv: parseInt(pv || '0', 10),
          uniqueUsers: uniqueUsers || 0
        });
      }

      return stats.reverse(); // 古い順に並び替え
    } catch (error) {
      console.error('[PVTracker] Error getting monthly stats:', error);
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
      this.getMonthlyStats(12)
    ]);

    return {
      today,
      month,
      total,
      daily,
      monthly,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * バックアップをファイルに保存
   */
  async backupToFile(): Promise<string> {
    try {
      const stats = await this.getAllStats();
      const backupDir = join(process.cwd(), 'backups');
      const filename = `pv-backup-${this.getDateKey(new Date())}.json`;
      const filepath = join(backupDir, filename);

      // ディレクトリが存在しない場合は作成
      const { mkdirSync, existsSync } = await import('fs');
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }

      writeFileSync(filepath, JSON.stringify(stats, null, 2), 'utf-8');
      console.log(`[PVTracker] Backup saved to ${filepath}`);

      return filepath;
    } catch (error) {
      console.error('[PVTracker] Error backing up to file:', error);
      throw error;
    }
  }

  /**
   * 毎日0時にバックアップを実行
   */
  private scheduleDailyBackup(): void {
    const scheduleNextBackup = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      setTimeout(() => {
        console.log('[PVTracker] Running daily backup...');
        this.backupToFile()
          .then(() => console.log('[PVTracker] Daily backup completed'))
          .catch((error) => console.error('[PVTracker] Daily backup failed:', error));

        // 次のバックアップをスケジュール
        scheduleNextBackup();
      }, msUntilMidnight);

      console.log(`[PVTracker] Next backup scheduled in ${Math.floor(msUntilMidnight / 1000 / 60)} minutes`);
    };

    scheduleNextBackup();
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
}
