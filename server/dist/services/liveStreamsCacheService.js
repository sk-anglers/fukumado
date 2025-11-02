"use strict";
/**
 * 配信情報キャッシュサービス
 * Twitch APIへの負荷を軽減するため、配信情報をメモリ上にキャッシュします
 * Conduitsイベント（stream.online/offline）と連携して即時更新を実現
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveStreamsCacheService = exports.LiveStreamsCacheService = void 0;
/**
 * LRU (Least Recently Used) キャッシュの実装
 */
class LRUCache {
    constructor(maxSize = 1000) {
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
            console.log(`[Live Streams Cache] Cache MISS: ${key}`);
            return null;
        }
        // TTLチェック
        const now = Date.now();
        const age = now - entry.timestamp.getTime();
        if (age > entry.ttl) {
            // 期限切れ
            this.cache.delete(key);
            this.misses++;
            console.log(`[Live Streams Cache] Cache EXPIRED: ${key} (age: ${Math.round(age / 1000)}s)`);
            return null;
        }
        // ヒット
        entry.hits++;
        entry.lastAccessed = new Date();
        this.hits++;
        console.log(`[Live Streams Cache] Cache HIT: ${key} (hits: ${entry.hits}, age: ${Math.round(age / 1000)}s)`);
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
                console.log(`[Live Streams Cache] Evicted oldest entry: ${oldestKey}`);
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
        console.log(`[Live Streams Cache] Cached: ${key} (TTL: ${Math.round(ttl / 1000)}s, size: ${this.cache.size}/${this.maxSize})`);
    }
    /**
     * キャッシュから削除
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            console.log(`[Live Streams Cache] Deleted: ${key}`);
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
        console.log(`[Live Streams Cache] Cleared ${size} entries`);
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
            console.log(`[Live Streams Cache] Cleanup: removed ${removed} expired entries`);
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
 * 配信情報キャッシュ管理サービス
 */
class LiveStreamsCacheService {
    constructor(maxCacheSize = 1000) {
        this.cleanupInterval = null;
        // キャッシュTTL設定
        this.LIVE_STREAM_TTL = 3 * 60 * 1000; // 3分（配信詳細情報）
        this.CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分ごとにクリーンアップ
        this.cache = new LRUCache(maxCacheSize);
        console.log('[Live Streams Cache Service] Initialized with max size:', maxCacheSize);
        this.startPeriodicCleanup();
    }
    /**
     * 配信情報を取得（キャッシュ優先）
     */
    getLiveStream(userId) {
        return this.cache.get(`stream:${userId}`);
    }
    /**
     * 配信情報をキャッシュに保存
     */
    setLiveStream(userId, stream) {
        this.cache.set(`stream:${userId}`, stream, this.LIVE_STREAM_TTL);
    }
    /**
     * 配信開始時にキャッシュに追加（Conduitsイベント用）
     */
    addLiveStream(stream) {
        console.log(`[Live Streams Cache] Stream ONLINE: ${stream.displayName} (${stream.userId})`);
        this.setLiveStream(stream.userId, stream);
    }
    /**
     * 配信終了時にキャッシュから削除（Conduitsイベント用）
     */
    removeLiveStream(userId) {
        console.log(`[Live Streams Cache] Stream OFFLINE: ${userId}`);
        this.cache.delete(`stream:${userId}`);
    }
    /**
     * 特定の配信のキャッシュを削除
     */
    invalidateStream(userId) {
        return this.cache.delete(`stream:${userId}`);
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
        let totalHits = 0;
        let oldestEntry = null;
        let newestEntry = null;
        for (const [key, entry] of this.cache.entries()) {
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
            console.log('[Live Streams Cache Service] Running periodic cleanup...');
            const removed = this.cache.cleanup();
            const stats = this.getStats();
            console.log('[Live Streams Cache Service] Cleanup complete:', {
                removed,
                remaining: stats.totalEntries,
                hitRate: `${stats.hitRate.toFixed(2)}%`
            });
        }, this.CLEANUP_INTERVAL);
        console.log('[Live Streams Cache Service] Periodic cleanup scheduled (every 5 minutes)');
    }
    /**
     * クリーンアップを停止（テスト用）
     */
    stopPeriodicCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('[Live Streams Cache Service] Periodic cleanup stopped');
        }
    }
    /**
     * 手動でクリーンアップを実行
     */
    manualCleanup() {
        return this.cache.cleanup();
    }
}
exports.LiveStreamsCacheService = LiveStreamsCacheService;
// シングルトンインスタンス
exports.liveStreamsCacheService = new LiveStreamsCacheService(1000);
//# sourceMappingURL=liveStreamsCacheService.js.map