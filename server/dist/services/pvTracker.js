"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PVTracker = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * PV計測サービス
 * Redisを使用して日次・月次・累計PVを記録
 */
class PVTracker {
    constructor(redisClient) {
        this.redis = redisClient;
        // 毎日0時にバックアップを実行
        this.scheduleDailyBackup();
    }
    /**
     * PVをカウント
     */
    async trackPageView(ip) {
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
        }
        catch (error) {
            console.error('[PVTracker] Error tracking page view:', error);
        }
    }
    /**
     * 今日のPV統計を取得
     */
    async getTodayStats() {
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
        }
        catch (error) {
            console.error('[PVTracker] Error getting today stats:', error);
            return { pv: 0, uniqueUsers: 0 };
        }
    }
    /**
     * 今月のPV統計を取得
     */
    async getMonthStats() {
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
        }
        catch (error) {
            console.error('[PVTracker] Error getting month stats:', error);
            return { pv: 0, uniqueUsers: 0 };
        }
    }
    /**
     * 累計PVを取得
     */
    async getTotalPV() {
        try {
            const total = await this.redis.get('pv:total');
            return parseInt(total || '0', 10);
        }
        catch (error) {
            console.error('[PVTracker] Error getting total PV:', error);
            return 0;
        }
    }
    /**
     * 過去N日分の日次PVを取得
     */
    async getDailyStats(days = 30) {
        const stats = [];
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
        }
        catch (error) {
            console.error('[PVTracker] Error getting daily stats:', error);
            return [];
        }
    }
    /**
     * 過去N月分の月次PVを取得
     */
    async getMonthlyStats(months = 12) {
        const stats = [];
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
        }
        catch (error) {
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
    async backupToFile() {
        try {
            const stats = await this.getAllStats();
            const backupDir = (0, path_1.join)(process.cwd(), 'backups');
            const filename = `pv-backup-${this.getDateKey(new Date())}.json`;
            const filepath = (0, path_1.join)(backupDir, filename);
            // ディレクトリが存在しない場合は作成
            const { mkdirSync, existsSync } = await Promise.resolve().then(() => __importStar(require('fs')));
            if (!existsSync(backupDir)) {
                mkdirSync(backupDir, { recursive: true });
            }
            (0, fs_1.writeFileSync)(filepath, JSON.stringify(stats, null, 2), 'utf-8');
            console.log(`[PVTracker] Backup saved to ${filepath}`);
            return filepath;
        }
        catch (error) {
            console.error('[PVTracker] Error backing up to file:', error);
            throw error;
        }
    }
    /**
     * 毎日0時にバックアップを実行
     */
    scheduleDailyBackup() {
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
    getDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * 月キーを取得 (YYYY-MM)
     */
    getMonthKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }
}
exports.PVTracker = PVTracker;
//# sourceMappingURL=pvTracker.js.map