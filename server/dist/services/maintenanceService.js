"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maintenanceService = void 0;
const cacheService_1 = require("./cacheService");
const crypto_1 = require("crypto");
const events_1 = require("events");
class MaintenanceService extends events_1.EventEmitter {
    constructor() {
        super();
        // メモリストレージ（ローカル環境用）
        this.memoryEnabled = false;
        this.memoryMessage = '';
        this.memoryEnabledAt = null;
        this.memoryDuration = 0; // 0=無期限
        this.memoryScheduledEndAt = null;
        this.memoryBypassTokens = new Map();
        this.autoDisableTimer = null;
    }
    /**
     * メンテナンスモードを有効化
     */
    async enable(message, generateBypass = false, duration = 0) {
        try {
            const enabledAt = new Date().toISOString();
            // 終了予定時刻を計算（duration > 0の場合）
            let scheduledEndAt;
            if (duration > 0) {
                scheduledEndAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
            }
            // メモリに保存
            this.memoryEnabled = true;
            this.memoryMessage = message;
            this.memoryEnabledAt = enabledAt;
            this.memoryDuration = duration;
            this.memoryScheduledEndAt = scheduledEndAt || null;
            // 既存の自動解除タイマーをクリア
            if (this.autoDisableTimer) {
                clearTimeout(this.autoDisableTimer);
                this.autoDisableTimer = null;
            }
            // 自動解除タイマーをセット（duration > 0の場合）
            if (duration > 0) {
                this.autoDisableTimer = setTimeout(async () => {
                    console.log('[Maintenance] Auto-disabling maintenance mode');
                    await this.disable();
                }, duration * 60 * 1000);
                console.log(`[Maintenance] Auto-disable scheduled for ${scheduledEndAt}`);
            }
            let bypassToken;
            let expiresAt;
            if (generateBypass) {
                bypassToken = (0, crypto_1.randomBytes)(16).toString('hex');
                const expirationDate = new Date(Date.now() + 3600 * 1000); // 1時間
                expiresAt = expirationDate.toISOString();
                // メモリに保存
                this.memoryBypassTokens.set(bypassToken, { expiresAt });
                // 有効期限後に自動削除
                setTimeout(() => {
                    this.memoryBypassTokens.delete(bypassToken);
                }, 3600 * 1000);
                console.log(`[Maintenance] Bypass token generated: ${bypassToken} (expires: ${expiresAt})`);
            }
            // Redisにも保存（接続している場合のみ）
            if (cacheService_1.cacheService.isConnected()) {
                const ttl = duration > 0 ? duration * 60 : 86400;
                await cacheService_1.cacheService.set('admin:maintenance:enabled', 'true', ttl);
                await cacheService_1.cacheService.set('admin:maintenance:message', message, ttl);
                await cacheService_1.cacheService.set('admin:maintenance:duration', duration.toString(), ttl);
                if (scheduledEndAt) {
                    await cacheService_1.cacheService.set('admin:maintenance:scheduledEndAt', scheduledEndAt, ttl);
                }
                if (bypassToken && expiresAt) {
                    await cacheService_1.cacheService.set(`admin:maintenance:bypass:${bypassToken}`, 'true', 3600);
                }
            }
            console.log(`[Maintenance] Maintenance mode enabled (duration: ${duration === 0 ? 'unlimited' : duration + ' minutes'})`);
            // イベントを発火（WebSocket通知用）
            this.emit('statusChanged', {
                enabled: true,
                message,
                enabledAt,
                duration,
                scheduledEndAt
            });
            return {
                enabled: true,
                message,
                enabledAt,
                duration,
                scheduledEndAt,
                bypassToken,
                expiresAt
            };
        }
        catch (error) {
            console.error('[Maintenance] Error enabling maintenance mode:', error);
            throw error;
        }
    }
    /**
     * メンテナンスモードを無効化
     */
    async disable() {
        try {
            // 自動解除タイマーをクリア
            if (this.autoDisableTimer) {
                clearTimeout(this.autoDisableTimer);
                this.autoDisableTimer = null;
            }
            // メモリをクリア
            this.memoryEnabled = false;
            this.memoryMessage = '';
            this.memoryEnabledAt = null;
            this.memoryDuration = 0;
            this.memoryScheduledEndAt = null;
            this.memoryBypassTokens.clear();
            // Redisもクリア（接続している場合のみ）
            if (cacheService_1.cacheService.isConnected()) {
                await cacheService_1.cacheService.delete('admin:maintenance:enabled');
                await cacheService_1.cacheService.delete('admin:maintenance:message');
                await cacheService_1.cacheService.delete('admin:maintenance:duration');
                await cacheService_1.cacheService.delete('admin:maintenance:scheduledEndAt');
            }
            console.log('[Maintenance] Maintenance mode disabled');
            // イベントを発火（WebSocket通知用）
            this.emit('statusChanged', {
                enabled: false
            });
        }
        catch (error) {
            console.error('[Maintenance] Error disabling maintenance mode:', error);
            throw error;
        }
    }
    /**
     * メンテナンスモードの状態を取得
     */
    async getStatus() {
        try {
            // まずRedisから取得を試みる
            if (cacheService_1.cacheService.isConnected()) {
                const enabled = await cacheService_1.cacheService.get('admin:maintenance:enabled');
                const message = await cacheService_1.cacheService.get('admin:maintenance:message');
                const durationStr = await cacheService_1.cacheService.get('admin:maintenance:duration');
                const scheduledEndAt = await cacheService_1.cacheService.get('admin:maintenance:scheduledEndAt');
                if (enabled === 'true') {
                    return {
                        enabled: true,
                        message: message || '',
                        duration: durationStr ? parseInt(durationStr, 10) : 0,
                        scheduledEndAt: scheduledEndAt || undefined
                    };
                }
            }
            // Redis未接続時またはRedisに無い場合はメモリから返す
            return {
                enabled: this.memoryEnabled,
                message: this.memoryMessage,
                enabledAt: this.memoryEnabledAt || undefined,
                duration: this.memoryDuration,
                scheduledEndAt: this.memoryScheduledEndAt || undefined
            };
        }
        catch (error) {
            console.error('[Maintenance] Error getting status:', error);
            // エラー時もメモリから返す
            return {
                enabled: this.memoryEnabled,
                message: this.memoryMessage,
                enabledAt: this.memoryEnabledAt || undefined,
                duration: this.memoryDuration,
                scheduledEndAt: this.memoryScheduledEndAt || undefined
            };
        }
    }
    /**
     * Bypassトークンが有効かチェック
     */
    async isValidBypassToken(token) {
        try {
            // まずRedisから確認
            if (cacheService_1.cacheService.isConnected()) {
                const value = await cacheService_1.cacheService.get(`admin:maintenance:bypass:${token}`);
                if (value === 'true') {
                    return true;
                }
            }
            // Redis未接続時またはRedisにない場合はメモリから確認
            const tokenData = this.memoryBypassTokens.get(token);
            if (tokenData) {
                const isExpired = new Date(tokenData.expiresAt) < new Date();
                if (isExpired) {
                    // 有効期限切れの場合は削除
                    this.memoryBypassTokens.delete(token);
                    return false;
                }
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('[Maintenance] Error checking bypass token:', error);
            return false;
        }
    }
    /**
     * メンテナンスモードが有効かチェック（高速版）
     */
    isEnabled() {
        return this.memoryEnabled;
    }
    /**
     * メッセージを取得（高速版）
     */
    getMessage() {
        return this.memoryMessage;
    }
}
// シングルトンインスタンス
exports.maintenanceService = new MaintenanceService();
//# sourceMappingURL=maintenanceService.js.map