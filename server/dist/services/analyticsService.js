"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const prismaService_1 = __importDefault(require("./prismaService"));
const crypto_1 = require("crypto");
/**
 * アナリティクストラッキングサービス（PostgreSQL版）
 * AnalyticsEventテーブルを使用してイベントデータを記録・集計
 */
class AnalyticsService {
    /**
     * イベントを記録
     */
    async trackEvent(event, ip) {
        console.log('[AnalyticsService] trackEvent called:', {
            eventType: event.type,
            ip: ip.substring(0, 10) + '...',
        });
        try {
            const ipHash = this.hashIP(ip);
            await prismaService_1.default.analyticsEvent.create({
                data: {
                    eventType: event.type,
                    eventData: event.data, // JSON型
                    userId: event.userId || null,
                    sessionId: event.sessionId || null,
                    ipHash,
                    userAgent: event.userAgent || null,
                    deviceType: event.deviceType || null,
                    screenWidth: event.screenWidth || null,
                    screenHeight: event.screenHeight || null,
                },
            });
            console.log('[AnalyticsService] Event recorded successfully');
        }
        catch (error) {
            console.error('[AnalyticsService] Error tracking event:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                eventType: event.type,
            });
        }
    }
    /**
     * 統計データを取得
     */
    async getStats(days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);
            // 全イベント取得
            const events = await prismaService_1.default.analyticsEvent.findMany({
                where: {
                    createdAt: {
                        gte: startDate,
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            // 総イベント数
            const totalEvents = events.length;
            // ユニークユーザー数（IPハッシュ）
            const uniqueIPsSet = new Set(events.map((e) => e.ipHash));
            const uniqueUsers = uniqueIPsSet.size;
            // セッション数（session_startイベントをカウント）
            const totalSessions = events.filter((e) => e.eventType === 'session_start').length;
            // レイアウト統計
            const layoutSlots = {};
            const layoutPreset = {};
            // デバイス統計
            const deviceDistribution = {};
            const screenSizesMap = new Map();
            // ボタン統計
            const buttonClicks = {};
            // 機能統計
            const featureUsage = {};
            const platformUsage = {};
            // 配信操作統計
            const streamActions = {};
            const streamPlatforms = {};
            // 認証統計
            const authLogins = {};
            const authLogouts = {};
            // セッション時間の配列
            const sessionDurations = [];
            // イベントを集計
            for (const event of events) {
                const data = event.eventData;
                switch (event.eventType) {
                    case 'layout_change':
                        if (data.slotsCount !== undefined) {
                            layoutSlots[data.slotsCount] = (layoutSlots[data.slotsCount] || 0) + 1;
                        }
                        if (data.preset) {
                            layoutPreset[data.preset] = (layoutPreset[data.preset] || 0) + 1;
                        }
                        break;
                    case 'button_click':
                        if (data.buttonType) {
                            buttonClicks[data.buttonType] = (buttonClicks[data.buttonType] || 0) + 1;
                        }
                        break;
                    case 'feature_use':
                        if (data.featureType) {
                            featureUsage[data.featureType] = (featureUsage[data.featureType] || 0) + 1;
                        }
                        if (data.platform) {
                            platformUsage[data.platform] = (platformUsage[data.platform] || 0) + 1;
                        }
                        break;
                    case 'stream_action':
                        if (data.actionType) {
                            streamActions[data.actionType] = (streamActions[data.actionType] || 0) + 1;
                        }
                        if (data.platform) {
                            streamPlatforms[data.platform] = (streamPlatforms[data.platform] || 0) + 1;
                        }
                        break;
                    case 'auth_action':
                        if (data.platform && data.action === 'login' && data.success) {
                            authLogins[data.platform] = (authLogins[data.platform] || 0) + 1;
                        }
                        if (data.platform && data.action === 'logout' && data.success) {
                            authLogouts[data.platform] = (authLogouts[data.platform] || 0) + 1;
                        }
                        break;
                    case 'session_end':
                        if (data.duration !== undefined) {
                            sessionDurations.push(data.duration);
                        }
                        break;
                }
                // デバイス情報
                if (event.deviceType) {
                    deviceDistribution[event.deviceType] =
                        (deviceDistribution[event.deviceType] || 0) + 1;
                }
                // 画面サイズ
                if (event.screenWidth && event.screenHeight) {
                    const sizeKey = `${event.screenWidth}x${event.screenHeight}`;
                    screenSizesMap.set(sizeKey, (screenSizesMap.get(sizeKey) || 0) + 1);
                }
            }
            // 画面サイズデータの変換
            const screenSizesArray = Array.from(screenSizesMap.entries()).map(([size, count]) => {
                const [width, height] = size.split('x').map(Number);
                return { width, height, count };
            });
            // 平均セッション時間
            const averageDuration = sessionDurations.length > 0
                ? sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length
                : 0;
            // 日次統計
            const dailyStats = await this.getDailyStats(days);
            return {
                total: {
                    events: totalEvents,
                    sessions: totalSessions,
                    uniqueUsers,
                },
                layout: {
                    slotsDistribution: layoutSlots,
                    presetDistribution: layoutPreset,
                },
                device: {
                    distribution: deviceDistribution,
                    screenSizes: screenSizesArray,
                },
                buttons: {
                    clicks: buttonClicks,
                },
                features: {
                    usage: featureUsage,
                    platformUsage: platformUsage,
                },
                streams: {
                    actions: streamActions,
                    platformActions: streamPlatforms,
                },
                auth: {
                    logins: authLogins,
                    logouts: authLogouts,
                },
                sessions: {
                    averageDuration,
                    averagePageViews: 0, // TODO: PageViewとの連携
                },
                timeline: {
                    daily: dailyStats,
                },
            };
        }
        catch (error) {
            console.error('[AnalyticsService] Error getting stats:', error);
            throw error;
        }
    }
    /**
     * 日次統計を取得
     */
    async getDailyStats(days) {
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
            const [eventCount, uniqueIPs, sessionEvents] = await Promise.all([
                // 総イベント数
                prismaService_1.default.analyticsEvent.count({
                    where: {
                        createdAt: {
                            gte: startOfDay,
                            lte: endOfDay,
                        },
                    },
                }),
                // ユニークユーザー数
                prismaService_1.default.analyticsEvent.findMany({
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
                // セッション数（session_startイベント）
                prismaService_1.default.analyticsEvent.count({
                    where: {
                        createdAt: {
                            gte: startOfDay,
                            lte: endOfDay,
                        },
                        eventType: 'session_start',
                    },
                }),
            ]);
            stats.push({
                date: dateKey,
                events: eventCount,
                sessions: sessionEvents,
                uniqueUsers: uniqueIPs.length,
            });
        }
        return stats.reverse();
    }
    /**
     * IPアドレスをハッシュ化（プライバシー保護）
     */
    hashIP(ip) {
        return (0, crypto_1.createHash)('sha256').update(ip).digest('hex').substring(0, 64);
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
}
exports.AnalyticsService = AnalyticsService;
//# sourceMappingURL=analyticsService.js.map