"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicChannelAllocator = exports.DynamicChannelAllocator = void 0;
const twitchEventSubManager_1 = require("./twitchEventSubManager");
const twitchEventSubWebhookService_1 = require("./twitchEventSubWebhookService");
const priorityManager_1 = require("./priorityManager");
/**
 * 動的チャンネル割り当て管理クラス
 *
 * 優先度に応じてチャンネルを最適な方式に自動割り当て
 * - realtime優先度: EventSub WebSocket（容量があれば）→ Webhook（フォールバック）
 * - delayed優先度: StreamSync 60秒ポーリング
 */
class DynamicChannelAllocator {
    constructor() {
        // チャンネルID → 割り当て情報
        this.allocations = new Map();
        // EventSub容量の閾値（90%で警告）
        this.capacityWarningThreshold = 0.9;
        // Webhook設定が有効かどうか
        this.webhookEnabled = false;
        // アクセストークン（EventSub/Webhook用）
        this.twitchAccessToken = null;
        this.twitchClientId = null;
        console.log('[DynamicChannelAllocator] Initialized');
        // PriorityManagerの変更イベントを監視
        priorityManager_1.priorityManager.onChange((event) => {
            this.handlePriorityChange(event);
        });
    }
    /**
     * Twitch認証情報を設定
     */
    setTwitchCredentials(accessToken, clientId) {
        console.log('[DynamicChannelAllocator] Setting Twitch credentials');
        this.twitchAccessToken = accessToken;
        this.twitchClientId = clientId;
    }
    /**
     * Webhook設定を有効化
     */
    enableWebhook(webhookUrl, webhookSecret) {
        console.log('[DynamicChannelAllocator] Enabling Webhook fallback');
        this.webhookEnabled = true;
    }
    /**
     * 優先度変更イベントを処理
     */
    async handlePriorityChange(event) {
        console.log('[DynamicChannelAllocator] Handling priority change event');
        // realtime に昇格したチャンネルを処理
        if (event.changes.toRealtime.length > 0) {
            await this.allocateRealtimeChannels(event.changes.toRealtime);
        }
        // delayed に降格したチャンネルを処理
        if (event.changes.toDelayed.length > 0) {
            await this.deallocateRealtimeChannels(event.changes.toDelayed);
        }
    }
    /**
     * リアルタイムチャンネルを割り当て
     * 視聴者数の多い順に優先的にEventSubに割り当てる
     */
    async allocateRealtimeChannels(channelKeys) {
        console.log(`[DynamicChannelAllocator] Allocating ${channelKeys.length} realtime channels`);
        // PriorityManagerから視聴者数情報を取得
        const allPriorities = priorityManager_1.priorityManager.calculatePriorities();
        const priorityMap = new Map();
        // channelKey → 視聴者数のマップを作成
        for (const p of allPriorities) {
            const key = `${p.platform}:${p.channelId}`;
            priorityMap.set(key, p.userCount);
        }
        // 視聴者数の多い順にソート
        const sortedKeys = channelKeys.sort((a, b) => {
            const countA = priorityMap.get(a) || 0;
            const countB = priorityMap.get(b) || 0;
            return countB - countA; // 降順（視聴者数が多い順）
        });
        console.log(`[DynamicChannelAllocator] Sorted channels by viewer count (top 5):`);
        sortedKeys.slice(0, 5).forEach((key, index) => {
            const viewerCount = priorityMap.get(key) || 0;
            console.log(`  ${index + 1}. ${key}: ${viewerCount} viewers`);
        });
        // 視聴者数の多い順に割り当て
        for (const key of sortedKeys) {
            const [platform, channelId] = this.parseChannelKey(key);
            const viewerCount = priorityMap.get(key) || 0;
            if (platform !== 'twitch') {
                // 現在はTwitchのみEventSubに対応
                console.log(`[DynamicChannelAllocator] Skipping ${platform} channel: ${channelId} (EventSub not supported)`);
                continue;
            }
            try {
                const method = await this.determineAllocationMethod();
                switch (method) {
                    case 'eventsub':
                        console.log(`[DynamicChannelAllocator] Allocating ${channelId} to EventSub (${viewerCount} viewers)`);
                        await this.allocateToEventSub(channelId, platform);
                        break;
                    case 'webhook':
                        console.log(`[DynamicChannelAllocator] Allocating ${channelId} to Webhook (${viewerCount} viewers)`);
                        await this.allocateToWebhook(channelId, platform);
                        break;
                    case 'polling':
                        console.warn(`[DynamicChannelAllocator] No capacity for EventSub/Webhook, keeping channel ${channelId} on polling (${viewerCount} viewers)`);
                        this.allocations.set(key, {
                            channelId,
                            platform,
                            method: 'polling',
                            priority: 'realtime',
                            allocatedAt: new Date()
                        });
                        break;
                }
            }
            catch (error) {
                console.error(`[DynamicChannelAllocator] Failed to allocate channel ${channelId}:`, error);
            }
        }
        this.logAllocationStats();
    }
    /**
     * リアルタイムチャンネルの割り当てを解除
     */
    async deallocateRealtimeChannels(channelKeys) {
        console.log(`[DynamicChannelAllocator] Deallocating ${channelKeys.length} channels from realtime`);
        for (const key of channelKeys) {
            const allocation = this.allocations.get(key);
            if (!allocation) {
                console.log(`[DynamicChannelAllocator] Channel ${key} not found in allocations`);
                continue;
            }
            const { channelId, platform, method } = allocation;
            try {
                switch (method) {
                    case 'eventsub':
                        await this.deallocateFromEventSub(channelId, platform);
                        break;
                    case 'webhook':
                        await this.deallocateFromWebhook(channelId, platform);
                        break;
                    case 'polling':
                        // ポーリングは何もしない（元々ポーリング中）
                        console.log(`[DynamicChannelAllocator] Channel ${channelId} was on polling, no deallocation needed`);
                        break;
                }
                // 割り当て情報を更新（delayed + polling）
                this.allocations.set(key, {
                    channelId,
                    platform,
                    method: 'polling',
                    priority: 'delayed',
                    allocatedAt: new Date()
                });
                console.log(`[DynamicChannelAllocator] Channel ${channelId} moved to polling (delayed priority)`);
            }
            catch (error) {
                console.error(`[DynamicChannelAllocator] Failed to deallocate channel ${channelId}:`, error);
            }
        }
        this.logAllocationStats();
    }
    /**
     * 割り当て方式を決定
     */
    async determineAllocationMethod() {
        // EventSubの容量を確認
        const capacity = twitchEventSubManager_1.twitchEventSubManager.getCapacity();
        if (capacity.available > 0) {
            // EventSubに空きがある
            return 'eventsub';
        }
        // EventSubが満杯
        console.warn('[DynamicChannelAllocator] EventSub is at capacity, checking Webhook availability');
        if (this.webhookEnabled) {
            // Webhookが有効
            return 'webhook';
        }
        // EventSubもWebhookも使えない → ポーリング継続
        console.warn('[DynamicChannelAllocator] No EventSub/Webhook capacity, falling back to polling');
        return 'polling';
    }
    /**
     * EventSubに割り当て
     */
    async allocateToEventSub(channelId, platform) {
        console.log(`[DynamicChannelAllocator] Allocating ${platform}:${channelId} to EventSub`);
        // EventSubManagerにサブスクライブ
        await twitchEventSubManager_1.twitchEventSubManager.subscribeToUsers([channelId]);
        // 割り当て情報を記録
        const key = `${platform}:${channelId}`;
        this.allocations.set(key, {
            channelId,
            platform,
            method: 'eventsub',
            priority: 'realtime',
            allocatedAt: new Date()
        });
        console.log(`[DynamicChannelAllocator] Successfully allocated ${channelId} to EventSub`);
    }
    /**
     * EventSubから割り当て解除
     */
    async deallocateFromEventSub(channelId, platform) {
        console.log(`[DynamicChannelAllocator] Deallocating ${platform}:${channelId} from EventSub`);
        // EventSubManagerからアンサブスクライブ
        await twitchEventSubManager_1.twitchEventSubManager.unsubscribeFromUsers([channelId]);
        console.log(`[DynamicChannelAllocator] Successfully deallocated ${channelId} from EventSub`);
    }
    /**
     * Webhookに割り当て
     */
    async allocateToWebhook(channelId, platform) {
        console.log(`[DynamicChannelAllocator] Allocating ${platform}:${channelId} to Webhook`);
        // Webhookサービスにサブスクライブ
        await twitchEventSubWebhookService_1.twitchEventSubWebhookService.subscribeToUsers([channelId]);
        // 割り当て情報を記録
        const key = `${platform}:${channelId}`;
        this.allocations.set(key, {
            channelId,
            platform,
            method: 'webhook',
            priority: 'realtime',
            allocatedAt: new Date()
        });
        console.log(`[DynamicChannelAllocator] Successfully allocated ${channelId} to Webhook`);
    }
    /**
     * Webhookから割り当て解除
     */
    async deallocateFromWebhook(channelId, platform) {
        console.log(`[DynamicChannelAllocator] Deallocating ${platform}:${channelId} from Webhook`);
        // Webhookサービスからアンサブスクライブ
        await twitchEventSubWebhookService_1.twitchEventSubWebhookService.unsubscribeFromUsers([channelId]);
        console.log(`[DynamicChannelAllocator] Successfully deallocated ${channelId} from Webhook`);
    }
    /**
     * チャンネルキーをパース
     */
    parseChannelKey(key) {
        const [platform, channelId] = key.split(':');
        return [platform, channelId];
    }
    /**
     * 統計情報を取得
     */
    getStats() {
        const allocations = Array.from(this.allocations.values());
        const byMethod = {
            eventsub: allocations.filter(a => a.method === 'eventsub').length,
            webhook: allocations.filter(a => a.method === 'webhook').length,
            polling: allocations.filter(a => a.method === 'polling').length
        };
        const byPriority = {
            realtime: allocations.filter(a => a.priority === 'realtime').length,
            delayed: allocations.filter(a => a.priority === 'delayed').length
        };
        const eventSubCapacity = twitchEventSubManager_1.twitchEventSubManager.getCapacity();
        return {
            total: allocations.length,
            byMethod,
            byPriority,
            eventSubCapacity,
            allocations: allocations.sort((a, b) => b.allocatedAt.getTime() - a.allocatedAt.getTime())
        };
    }
    /**
     * 割り当て状況をログ出力
     */
    logAllocationStats() {
        const stats = this.getStats();
        console.log('[DynamicChannelAllocator] ===== Allocation Stats =====');
        console.log(`[DynamicChannelAllocator] Total Channels: ${stats.total}`);
        console.log(`[DynamicChannelAllocator] EventSub: ${stats.byMethod.eventsub}, Webhook: ${stats.byMethod.webhook}, Polling: ${stats.byMethod.polling}`);
        console.log(`[DynamicChannelAllocator] Realtime: ${stats.byPriority.realtime}, Delayed: ${stats.byPriority.delayed}`);
        console.log(`[DynamicChannelAllocator] EventSub Capacity: ${stats.eventSubCapacity.used}/${stats.eventSubCapacity.total} (${stats.eventSubCapacity.percentage.toFixed(1)}%)`);
        // 容量警告
        if (stats.eventSubCapacity.percentage >= this.capacityWarningThreshold * 100) {
            console.warn(`[DynamicChannelAllocator] ⚠️ EventSub capacity at ${stats.eventSubCapacity.percentage.toFixed(1)}%! Consider enabling Webhook fallback.`);
        }
        console.log('[DynamicChannelAllocator] ================================');
    }
    /**
     * 全チャンネルを再割り当て（手動実行用）
     * 視聴者数の多いチャンネルから優先的にEventSubに割り当てる
     */
    async rebalance() {
        console.log('[DynamicChannelAllocator] Rebalancing all channels...');
        // 現在の優先度情報を取得（視聴者数順にソート済み）
        const priorities = priorityManager_1.priorityManager.calculatePriorities();
        console.log(`[DynamicChannelAllocator] Total channels: ${priorities.length}`);
        console.log(`[DynamicChannelAllocator] Top channels by viewer count:`);
        priorities.slice(0, 5).forEach((p, index) => {
            console.log(`  ${index + 1}. ${p.platform}:${p.channelId} - ${p.userCount} viewers (${p.priority})`);
        });
        // 既存の割り当てをクリア
        this.allocations.clear();
        // リアルタイム優先度のチャンネルを再割り当て（視聴者数順）
        const realtimeChannels = priorities
            .filter(p => p.priority === 'realtime')
            .map(p => `${p.platform}:${p.channelId}`);
        console.log(`[DynamicChannelAllocator] Realtime channels to allocate: ${realtimeChannels.length}`);
        if (realtimeChannels.length > 0) {
            await this.allocateRealtimeChannels(realtimeChannels);
        }
        // 遅延許容のチャンネルはポーリングに割り当て
        const delayedChannels = priorities.filter(p => p.priority === 'delayed');
        for (const { platform, channelId } of delayedChannels) {
            const key = `${platform}:${channelId}`;
            this.allocations.set(key, {
                channelId,
                platform,
                method: 'polling',
                priority: 'delayed',
                allocatedAt: new Date()
            });
        }
        console.log('[DynamicChannelAllocator] Rebalance completed');
        this.logAllocationStats();
    }
    /**
     * 特定のチャンネルの割り当て情報を取得
     */
    getAllocation(channelId, platform) {
        const key = `${platform}:${channelId}`;
        return this.allocations.get(key) || null;
    }
}
exports.DynamicChannelAllocator = DynamicChannelAllocator;
// シングルトンインスタンス
exports.dynamicChannelAllocator = new DynamicChannelAllocator();
//# sourceMappingURL=dynamicChannelAllocator.js.map