"use strict";
/**
 * Alert Service
 * アラート・通知の管理サービス
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertService = void 0;
const prismaService_1 = __importDefault(require("./prismaService"));
class AlertService {
    /**
     * アラートを作成
     */
    async createAlert(input) {
        try {
            // アラート設定を確認
            const setting = await prismaService_1.default.alertSetting.findUnique({
                where: { type: input.type }
            });
            // 設定が無効の場合はアラートを作成しない
            if (setting && !setting.enabled) {
                console.log(`[AlertService] Alert type "${input.type}" is disabled, skipping`);
                return;
            }
            await prismaService_1.default.alert.create({
                data: {
                    type: input.type,
                    severity: input.severity,
                    title: input.title,
                    message: input.message,
                    details: input.details || undefined
                }
            });
            console.log(`[AlertService] Alert created: ${input.type} - ${input.title}`);
        }
        catch (error) {
            console.error('[AlertService] Failed to create alert:', error);
        }
    }
    /**
     * アラート一覧を取得
     */
    async getAlerts(options) {
        const { limit = 50, offset = 0, type, severity, acknowledged, resolved } = options;
        const where = {};
        if (type)
            where.type = type;
        if (severity)
            where.severity = severity;
        if (acknowledged !== undefined)
            where.acknowledged = acknowledged;
        if (resolved !== undefined)
            where.resolved = resolved;
        const [alerts, total] = await Promise.all([
            prismaService_1.default.alert.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: limit
            }),
            prismaService_1.default.alert.count({ where })
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
    async getUnreadCount() {
        return prismaService_1.default.alert.count({
            where: {
                acknowledged: false,
                resolved: false
            }
        });
    }
    /**
     * アラートを確認済みにする
     */
    async acknowledgeAlert(id, acknowledgedBy) {
        await prismaService_1.default.alert.update({
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
    async resolveAlert(id) {
        await prismaService_1.default.alert.update({
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
        return prismaService_1.default.alertSetting.findMany({
            orderBy: { type: 'asc' }
        });
    }
    /**
     * アラート設定を更新
     */
    async updateSetting(type, data) {
        await prismaService_1.default.alertSetting.update({
            where: { type },
            data
        });
        console.log(`[AlertService] Setting for "${type}" updated`);
    }
    /**
     * 古いアラートをクリーンアップ
     */
    async cleanup(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const result = await prismaService_1.default.alert.deleteMany({
            where: {
                createdAt: { lt: cutoffDate },
                resolved: true
            }
        });
        console.log(`[AlertService] Cleaned up ${result.count} alerts older than ${days} days`);
        return result.count;
    }
}
exports.alertService = new AlertService();
//# sourceMappingURL=alertService.js.map