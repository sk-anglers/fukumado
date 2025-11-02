"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.priorityManager = exports.PriorityManager = void 0;
/**
 * チャンネル優先度管理クラス
 *
 * 重複度ベースの優先度判定を行う
 * EventSubの使用率に応じて動的に閾値を調整
 * - 使用率80%以上 → 閾値50人
 * - 使用率60-79% → 閾値30人
 * - 使用率40-59% → 閾値20人
 * - 使用率20-39% → 閾値10人
 * - 使用率20%未満 → 閾値5人
 */
class PriorityManager {
    constructor() {
        // プラットフォーム別のチャンネル視聴者マップ
        // Map<channelId, Set<userId>>
        this.youtubeChannelViewers = new Map();
        this.twitchChannelViewers = new Map();
        // ユーザー別のチャンネルリスト
        // Map<userId, UserChannels>
        this.userChannelsMap = new Map();
        // 前回の優先度（変更検出用）
        this.previousPriorities = new Map();
        // 優先度変更イベントハンドラー
        this.changeHandlers = new Set();
        // 動的閾値管理
        this.currentThreshold = 10; // デフォルト10人
        this.eventSubUsage = null;
        this.lastThresholdUpdate = new Date();
        this.thresholdMonitorInterval = null;
        this.accessToken = null;
        console.log('[PriorityManager] Initialized with dynamic threshold');
    }
    /**
     * アクセストークンを設定（EventSub使用状況取得に必要）
     */
    setAccessToken(token) {
        this.accessToken = token;
        console.log('[PriorityManager] Access token set');
    }
    /**
     * 動的閾値モニタリングを開始
     */
    startDynamicThresholdMonitoring() {
        if (this.thresholdMonitorInterval) {
            console.log('[PriorityManager] Threshold monitoring already running');
            return;
        }
        console.log('[PriorityManager] Starting dynamic threshold monitoring (every 5 minutes)');
        // 初回実行
        this.updateThreshold();
        // 5分ごとに更新
        this.thresholdMonitorInterval = setInterval(() => {
            this.updateThreshold();
        }, 5 * 60 * 1000);
    }
    /**
     * 動的閾値モニタリングを停止
     */
    stopDynamicThresholdMonitoring() {
        if (this.thresholdMonitorInterval) {
            clearInterval(this.thresholdMonitorInterval);
            this.thresholdMonitorInterval = null;
            console.log('[PriorityManager] Threshold monitoring stopped');
        }
    }
    /**
     * EventSub使用状況を取得
     */
    async fetchEventSubUsage() {
        if (!this.accessToken) {
            console.warn('[PriorityManager] No access token available for EventSub usage check');
            return null;
        }
        try {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': process.env.TWITCH_CLIENT_ID || ''
                }
            });
            if (!response.ok) {
                console.error('[PriorityManager] Failed to fetch EventSub usage:', response.status);
                return null;
            }
            const data = await response.json();
            const total = data.total || 0;
            const totalCost = data.total_cost || 0;
            const maxTotalCost = data.max_total_cost || 10000;
            const usageRate = maxTotalCost > 0 ? (totalCost / maxTotalCost) * 100 : 0;
            return {
                total,
                totalCost,
                maxTotalCost,
                usageRate
            };
        }
        catch (error) {
            console.error('[PriorityManager] Error fetching EventSub usage:', error);
            return null;
        }
    }
    /**
     * 使用率に応じて閾値を計算
     */
    calculateDynamicThreshold(usageRate) {
        if (usageRate >= 80) {
            return { threshold: 50, reason: '使用率80%以上のため閾値を50人に引き上げ' };
        }
        else if (usageRate >= 60) {
            return { threshold: 30, reason: '使用率60-79%のため閾値を30人に設定' };
        }
        else if (usageRate >= 40) {
            return { threshold: 20, reason: '使用率40-59%のため閾値を20人に設定' };
        }
        else if (usageRate >= 20) {
            return { threshold: 10, reason: '使用率20-39%のため閾値を10人に設定（デフォルト）' };
        }
        else {
            return { threshold: 5, reason: '使用率20%未満のため閾値を5人に引き下げ' };
        }
    }
    /**
     * 閾値を更新
     */
    async updateThreshold() {
        const usage = await this.fetchEventSubUsage();
        if (!usage) {
            console.log('[PriorityManager] Using default threshold:', this.currentThreshold);
            return;
        }
        this.eventSubUsage = usage;
        const { threshold, reason } = this.calculateDynamicThreshold(usage.usageRate);
        if (threshold !== this.currentThreshold) {
            const oldThreshold = this.currentThreshold;
            this.currentThreshold = threshold;
            this.lastThresholdUpdate = new Date();
            console.log(`[PriorityManager] Threshold changed: ${oldThreshold} → ${threshold} (${reason})`);
            console.log(`[PriorityManager] EventSub usage: ${usage.totalCost}/${usage.maxTotalCost} (${usage.usageRate.toFixed(2)}%)`);
            // 閾値変更により優先度が変わる可能性があるため再計算
            this.detectAndNotifyChanges();
        }
    }
    /**
     * 現在の閾値情報を取得
     */
    getThresholdInfo() {
        const { reason } = this.calculateDynamicThreshold(this.eventSubUsage?.usageRate || 0);
        return {
            currentThreshold: this.currentThreshold,
            eventSubUsage: this.eventSubUsage || {
                total: 0,
                totalCost: 0,
                maxTotalCost: 10000,
                usageRate: 0
            },
            lastUpdated: this.lastThresholdUpdate,
            thresholdReason: reason
        };
    }
    /**
     * ユーザーのチャンネルリストを登録
     */
    registerUser(userId, channels) {
        console.log(`[PriorityManager] Registering user: ${userId}, YouTube: ${channels.youtube.length}, Twitch: ${channels.twitch.length}`);
        // 既存の登録を削除
        this.unregisterUser(userId);
        // 新しいチャンネルリストを保存
        this.userChannelsMap.set(userId, {
            userId,
            youtubeChannels: channels.youtube,
            twitchChannels: channels.twitch
        });
        // YouTubeチャンネルを登録
        for (const channelId of channels.youtube) {
            if (!this.youtubeChannelViewers.has(channelId)) {
                this.youtubeChannelViewers.set(channelId, new Set());
            }
            this.youtubeChannelViewers.get(channelId).add(userId);
        }
        // Twitchチャンネルを登録
        for (const channelId of channels.twitch) {
            if (!this.twitchChannelViewers.has(channelId)) {
                this.twitchChannelViewers.set(channelId, new Set());
            }
            this.twitchChannelViewers.get(channelId).add(userId);
        }
        // 優先度を再計算して変更を検出
        this.detectAndNotifyChanges();
    }
    /**
     * ユーザーの登録を解除
     */
    unregisterUser(userId) {
        const userChannels = this.userChannelsMap.get(userId);
        if (!userChannels) {
            console.log(`[PriorityManager] User not found: ${userId}`);
            return;
        }
        console.log(`[PriorityManager] Unregistering user: ${userId}`);
        // YouTubeチャンネルから削除
        for (const channelId of userChannels.youtubeChannels) {
            const viewers = this.youtubeChannelViewers.get(channelId);
            if (viewers) {
                viewers.delete(userId);
                if (viewers.size === 0) {
                    this.youtubeChannelViewers.delete(channelId);
                }
            }
        }
        // Twitchチャンネルから削除
        for (const channelId of userChannels.twitchChannels) {
            const viewers = this.twitchChannelViewers.get(channelId);
            if (viewers) {
                viewers.delete(userId);
                if (viewers.size === 0) {
                    this.twitchChannelViewers.delete(channelId);
                }
            }
        }
        this.userChannelsMap.delete(userId);
        // 優先度を再計算して変更を検出
        this.detectAndNotifyChanges();
    }
    /**
     * 優先度を計算（動的閾値を使用）
     */
    calculatePriority(viewerCount) {
        // currentThreshold人以上が視聴 → リアルタイム（EventSub）
        // currentThreshold人未満が視聴 → 遅延許容（60秒ポーリング）
        return viewerCount >= this.currentThreshold ? 'realtime' : 'delayed';
    }
    /**
     * 全チャンネルの優先度を計算
     */
    calculatePriorities() {
        const priorities = [];
        // YouTubeチャンネルの優先度
        Array.from(this.youtubeChannelViewers.entries()).forEach(([channelId, viewers]) => {
            const userCount = viewers.size;
            const priority = this.calculatePriority(userCount);
            priorities.push({
                channelId,
                userCount,
                priority,
                userIds: Array.from(viewers),
                platform: 'youtube'
            });
        });
        // Twitchチャンネルの優先度
        Array.from(this.twitchChannelViewers.entries()).forEach(([channelId, viewers]) => {
            const userCount = viewers.size;
            const priority = this.calculatePriority(userCount);
            priorities.push({
                channelId,
                userCount,
                priority,
                userIds: Array.from(viewers),
                platform: 'twitch'
            });
        });
        // 視聴者数の降順でソート
        return priorities.sort((a, b) => b.userCount - a.userCount);
    }
    /**
     * 優先度の変更を検出して通知
     */
    detectAndNotifyChanges() {
        const currentPriorities = this.calculatePriorities();
        const currentPriorityMap = new Map();
        // 現在の優先度をマップに変換
        for (const { channelId, priority, platform } of currentPriorities) {
            const key = `${platform}:${channelId}`;
            currentPriorityMap.set(key, priority);
        }
        // 変更を検出
        const toRealtime = [];
        const toDelayed = [];
        // 新しい優先度と前回の優先度を比較
        Array.from(currentPriorityMap.entries()).forEach(([key, currentPriority]) => {
            const previousPriority = this.previousPriorities.get(key);
            if (previousPriority && previousPriority !== currentPriority) {
                if (currentPriority === 'realtime') {
                    toRealtime.push(key);
                    console.log(`[PriorityManager] Priority changed to REALTIME: ${key}`);
                }
                else {
                    toDelayed.push(key);
                    console.log(`[PriorityManager] Priority changed to DELAYED: ${key}`);
                }
            }
        });
        // 削除されたチャンネルを検出
        Array.from(this.previousPriorities.keys()).forEach((key) => {
            if (!currentPriorityMap.has(key)) {
                console.log(`[PriorityManager] Channel removed: ${key}`);
            }
        });
        // 前回の優先度を更新
        this.previousPriorities = currentPriorityMap;
        // 変更があればイベントを通知
        if (toRealtime.length > 0 || toDelayed.length > 0) {
            const event = {
                type: 'priority_changed',
                changes: { toRealtime, toDelayed },
                timestamp: new Date().toISOString()
            };
            this.notifyChange(event);
        }
    }
    /**
     * チャンネルを優先度別に分類
     */
    classifyChannels() {
        const priorities = this.calculatePriorities();
        const classification = {
            realtime: { youtube: [], twitch: [] },
            delayed: { youtube: [], twitch: [] }
        };
        for (const { channelId, priority, platform } of priorities) {
            if (priority === 'realtime') {
                classification.realtime[platform].push(channelId);
            }
            else {
                classification.delayed[platform].push(channelId);
            }
        }
        return classification;
    }
    /**
     * 統計情報を取得
     */
    getStats() {
        const priorities = this.calculatePriorities();
        const realtimeChannels = [];
        const delayedChannels = [];
        for (const { channelId, userCount, priority, platform } of priorities) {
            const stats = {
                channelId,
                platform,
                viewerCount: userCount,
                priority
            };
            if (priority === 'realtime') {
                realtimeChannels.push(stats);
            }
            else {
                delayedChannels.push(stats);
            }
        }
        // 視聴者数上位10チャンネル
        const topChannels = [...priorities]
            .sort((a, b) => b.userCount - a.userCount)
            .slice(0, 10)
            .map(p => ({
            channelId: p.channelId,
            platform: p.platform,
            viewerCount: p.userCount,
            priority: p.priority
        }));
        return {
            totalChannels: priorities.length,
            realtimeChannels: realtimeChannels.length,
            delayedChannels: delayedChannels.length,
            totalUsers: this.userChannelsMap.size,
            channelsByPriority: {
                realtime: realtimeChannels,
                delayed: delayedChannels
            },
            topChannels
        };
    }
    /**
     * 優先度変更イベントハンドラーを登録
     */
    onChange(handler) {
        this.changeHandlers.add(handler);
        console.log(`[PriorityManager] Change handler added. Total handlers: ${this.changeHandlers.size}`);
        return () => {
            this.changeHandlers.delete(handler);
            console.log(`[PriorityManager] Change handler removed. Total handlers: ${this.changeHandlers.size}`);
        };
    }
    /**
     * 変更を通知
     */
    notifyChange(event) {
        console.log(`[PriorityManager] Priority changes detected - To Realtime: ${event.changes.toRealtime.length}, To Delayed: ${event.changes.toDelayed.length}`);
        this.changeHandlers.forEach(handler => {
            try {
                handler(event);
            }
            catch (error) {
                console.error('[PriorityManager] Error in change handler:', error);
            }
        });
    }
    /**
     * 特定のチャンネルの優先度を取得
     */
    getChannelPriority(channelId, platform) {
        const viewers = platform === 'youtube'
            ? this.youtubeChannelViewers.get(channelId)
            : this.twitchChannelViewers.get(channelId);
        if (!viewers) {
            return null;
        }
        return this.calculatePriority(viewers.size);
    }
    /**
     * 登録されている全ユーザーIDを取得
     */
    getUserIds() {
        return Array.from(this.userChannelsMap.keys());
    }
    /**
     * リアルタイム優先度のチャンネル数を取得
     */
    getRealtimeChannelCount() {
        const classification = this.classifyChannels();
        return classification.realtime.youtube.length + classification.realtime.twitch.length;
    }
    /**
     * 遅延許容のチャンネル数を取得
     */
    getDelayedChannelCount() {
        const classification = this.classifyChannels();
        return classification.delayed.youtube.length + classification.delayed.twitch.length;
    }
}
exports.PriorityManager = PriorityManager;
// シングルトンインスタンス
exports.priorityManager = new PriorityManager();
//# sourceMappingURL=priorityManager.js.map