"use strict";
/**
 * エモートキャッシュサービス
 * Twitch APIへの負荷を軽減するため、エモート情報をメモリ上にキャッシュします
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emoteCacheService = exports.EmoteCacheService = void 0;
/**
 * LRU (Least Recently Used) キャッシュの実装
 */
class LRUCache {
    constructor(maxSize = 500) {
        this.cache = new Map();
        this.hits = 0;
        this.misses = 0;
        this.maxSize = maxSize;
    }
    /**
     * キャッシュから取得
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            console.log(`[Emote Cache] Cache MISS: ${key}`);
            return null;
        }
        // TTLチェック
        const now = Date.now();
        const age = now - entry.timestamp.getTime();
        if (age > entry.ttl) {
            // 期限切れ
            this.cache.delete(key);
            this.misses++;
            console.log(`[Emote Cache] Cache EXPIRED: ${key} (age: ${Math.round(age / 1000)}s)`);
            return null;
        }
        // ヒット
        entry.hits++;
        entry.lastAccessed = new Date();
        this.hits++;
        console.log(`[Emote Cache] Cache HIT: ${key} (hits: ${entry.hits}, age: ${Math.round(age / 1000)}s)`);
        // LRU: アクセスされたエントリを末尾に移動
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }
    /**
     * キャッシュに保存
     */
    set(key, data, ttl) {
        // 最大サイズを超える場合、最も古いエントリを削除（LRU）
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
                console.log(`[Emote Cache] Evicted oldest entry: ${oldestKey}`);
            }
        }
        const entry = {
            data,
            timestamp: new Date(),
            ttl,
            hits: 0,
            lastAccessed: new Date()
        };
        this.cache.set(key, entry);
        console.log(`[Emote Cache] Cached: ${key} (TTL: ${Math.round(ttl / 1000)}s, size: ${this.cache.size}/${this.maxSize})`);
    }
    /**
     * キャッシュから削除
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            console.log(`[Emote Cache] Deleted: ${key}`);
        }
        return deleted;
    }
    /**
     * キャッシュをクリア
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        console.log(`[Emote Cache] Cleared ${size} entries`);
    }
    /**
     * 期限切れエントリをクリーンアップ
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            const age = now - entry.timestamp.getTime();
            if (age > entry.ttl) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            console.log(`[Emote Cache] Cleanup: removed ${removed} expired entries`);
        }
        return removed;
    }
    /**
     * 統計情報を取得
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? (this.hits / total) * 100 : 0
        };
    }
    /**
     * すべてのエントリを取得
     */
    entries() {
        return this.cache.entries();
    }
    /**
     * キャッシュサイズを取得
     */
    get size() {
        return this.cache.size;
    }
}
/**
 * エモートキャッシュ管理サービス
 */
class EmoteCacheService {
    constructor(maxCacheSize = 500) {
        this.cleanupInterval = null;
        // キャッシュTTL設定
        this.GLOBAL_EMOTES_TTL = 24 * 60 * 60 * 1000; // 24時間
        this.CHANNEL_EMOTES_TTL = 24 * 60 * 60 * 1000; // 24時間
        this.CLEANUP_INTERVAL = 60 * 60 * 1000; // 1時間ごとにクリーンアップ
        this.cache = new LRUCache(maxCacheSize);
        console.log('[Emote Cache Service] Initialized with max size:', maxCacheSize);
        this.startPeriodicCleanup();
    }
    /**
     * グローバルエモートを取得（キャッシュ優先）
     */
    getGlobalEmotes() {
        return this.cache.get('global');
    }
    /**
     * グローバルエモートをキャッシュに保存
     */
    setGlobalEmotes(emotes) {
        this.cache.set('global', emotes, this.GLOBAL_EMOTES_TTL);
    }
    /**
     * チャンネルエモートを取得（キャッシュ優先）
     */
    getChannelEmotes(broadcasterId) {
        const key = `channel:${broadcasterId}`;
        return this.cache.get(key);
    }
    /**
     * チャンネルエモートをキャッシュに保存
     */
    setChannelEmotes(broadcasterId, emotes) {
        const key = `channel:${broadcasterId}`;
        this.cache.set(key, emotes, this.CHANNEL_EMOTES_TTL);
    }
    /**
     * 特定のチャンネルのキャッシュを削除
     */
    invalidateChannelEmotes(broadcasterId) {
        const key = `channel:${broadcasterId}`;
        return this.cache.delete(key);
    }
    /**
     * グローバルエモートのキャッシュを削除
     */
    invalidateGlobalEmotes() {
        return this.cache.delete('global');
    }
    /**
     * すべてのキャッシュをクリア
     */
    clearAll() {
        this.cache.clear();
    }
    /**
     * キャッシュ統計情報を取得
     */
    getStats() {
        const basicStats = this.cache.getStats();
        let globalEmotesCached = false;
        let channelEmotesCached = 0;
        let totalHits = 0;
        let oldestEntry = null;
        let newestEntry = null;
        for (const [key, entry] of this.cache.entries()) {
            if (key === 'global') {
                globalEmotesCached = true;
            }
            else if (key.startsWith('channel:')) {
                channelEmotesCached++;
            }
            totalHits += entry.hits;
            if (!oldestEntry || entry.timestamp < oldestEntry) {
                oldestEntry = entry.timestamp;
            }
            if (!newestEntry || entry.timestamp > newestEntry) {
                newestEntry = entry.timestamp;
            }
        }
        return {
            totalEntries: this.cache.size,
            globalEmotesCached,
            channelEmotesCached,
            totalHits,
            totalMisses: basicStats.misses,
            hitRate: basicStats.hitRate,
            oldestEntry,
            newestEntry,
            cacheSize: basicStats.size,
            maxCacheSize: basicStats.maxSize
        };
    }
    /**
     * 定期的なクリーンアップを開始
     */
    startPeriodicCleanup() {
        this.cleanupInterval = setInterval(() => {
            console.log('[Emote Cache Service] Running periodic cleanup...');
            const removed = this.cache.cleanup();
            const stats = this.getStats();
            console.log('[Emote Cache Service] Cleanup complete:', {
                removed,
                remaining: stats.totalEntries,
                hitRate: `${stats.hitRate.toFixed(2)}%`
            });
        }, this.CLEANUP_INTERVAL);
        console.log('[Emote Cache Service] Periodic cleanup scheduled (every 1 hour)');
    }
    /**
     * クリーンアップを停止（テスト用）
     */
    stopPeriodicCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('[Emote Cache Service] Periodic cleanup stopped');
        }
    }
    /**
     * 手動でクリーンアップを実行
     */
    manualCleanup() {
        return this.cache.cleanup();
    }
}
exports.EmoteCacheService = EmoteCacheService;
// シングルトンインスタンス
exports.emoteCacheService = new EmoteCacheService(500);
//# sourceMappingURL=emoteCacheService.js.map