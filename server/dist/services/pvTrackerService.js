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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PVTrackerService = void 0;
const prismaService_1 = __importDefault(require("./prismaService"));
const crypto_1 = require("crypto");
/**
 * PV計測サービス（PostgreSQL版）
 * PageViewテーブルを使用してページビューを記録・集計
 */
class PVTrackerService {
    /**
     * PVをカウント
     */
    async trackPageView(ip, path, referrer, userAgent, userId, deviceType) {
        try {
            const ipHash = this.hashIP(ip);
            await prismaService_1.default.pageView.create({
                data: {
                    ipHash,
                    path,
                    referrer: referrer || null,
                    userAgent: userAgent || null,
                    userId: userId || null,
                    deviceType: deviceType || null,
                },
            });
        }
        catch (error) {
            console.error('[PVTrackerService] Error tracking page view:', error);
        }
    }
    /**
     * 今日のPV統計を取得
     */
    async getTodayStats() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const [pvCount, uniqueCount] = await Promise.all([
                // 総PV数
                prismaService_1.default.pageView.count({
                    where: {
                        createdAt: {
                            gte: today,
                        },
                    },
                }),
                // ユニークユーザー数（IPハッシュでカウント）
                prismaService_1.default.pageView.findMany({
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
        }
        catch (error) {
            console.error('[PVTrackerService] Error getting today stats:', error);
            return { pv: 0, uniqueUsers: 0 };
        }
    }
    /**
     * 今月のPV統計を取得
     */
    async getMonthStats() {
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const [pvCount, uniqueCount] = await Promise.all([
                prismaService_1.default.pageView.count({
                    where: {
                        createdAt: {
                            gte: startOfMonth,
                        },
                    },
                }),
                prismaService_1.default.pageView.findMany({
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
        }
        catch (error) {
            console.error('[PVTrackerService] Error getting month stats:', error);
            return { pv: 0, uniqueUsers: 0 };
        }
    }
    /**
     * 累計PVを取得
     */
    async getTotalPV() {
        try {
            const total = await prismaService_1.default.pageView.count();
            return total;
        }
        catch (error) {
            console.error('[PVTrackerService] Error getting total PV:', error);
            return 0;
        }
    }
    /**
     * 過去N日分の日次PVを取得
     */
    async getDailyStats(days = 30) {
        try {
            const stats = [];
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
                    prismaService_1.default.pageView.count({
                        where: {
                            createdAt: {
                                gte: startOfDay,
                                lte: endOfDay,
                            },
                        },
                    }),
                    prismaService_1.default.pageView.findMany({
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
        }
        catch (error) {
            console.error('[PVTrackerService] Error getting daily stats:', error);
            return [];
        }
    }
    /**
     * 過去N月分の月次PVを取得
     */
    async getMonthlyStats(months = 12) {
        try {
            const stats = [];
            const now = new Date();
            for (let i = 0; i < months; i++) {
                const date = new Date(now);
                date.setMonth(date.getMonth() - i);
                const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
                const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
                const monthKey = this.getMonthKey(date);
                const [pvCount, uniqueIPs] = await Promise.all([
                    prismaService_1.default.pageView.count({
                        where: {
                            createdAt: {
                                gte: startOfMonth,
                                lte: endOfMonth,
                            },
                        },
                    }),
                    prismaService_1.default.pageView.findMany({
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
        }
        catch (error) {
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
    async backupToFile() {
        const { writeFileSync, mkdirSync, existsSync } = await Promise.resolve().then(() => __importStar(require('fs')));
        const { join } = await Promise.resolve().then(() => __importStar(require('path')));
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
        }
        catch (error) {
            console.error('[PVTrackerService] Error backing up to file:', error);
            throw error;
        }
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
    /**
     * IPアドレスをハッシュ化（プライバシー保護）
     */
    hashIP(ip) {
        return (0, crypto_1.createHash)('sha256').update(ip).digest('hex').substring(0, 64);
    }
}
exports.PVTrackerService = PVTrackerService;
//# sourceMappingURL=pvTrackerService.js.map