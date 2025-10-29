"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheRouter = void 0;
const express_1 = require("express");
const cacheService_1 = require("../services/cacheService");
exports.cacheRouter = (0, express_1.Router)();
/**
 * Redis接続状態とサーバー情報を取得
 * GET /api/admin/cache/info
 */
exports.cacheRouter.get('/info', async (req, res) => {
    try {
        const connected = cacheService_1.cacheService.isConnected();
        if (!connected) {
            return res.json({
                success: true,
                data: {
                    connected: false,
                    info: null
                }
            });
        }
        // @ts-ignore - cacheServiceのclientにアクセス
        const client = cacheService_1.cacheService['client'];
        if (!client) {
            return res.json({
                success: true,
                data: {
                    connected: false,
                    info: null
                }
            });
        }
        // Redis INFOコマンドで統計情報を取得
        const info = await client.info();
        const dbSize = await client.dbsize();
        const memory = await client.info('memory');
        // メモリ情報を解析
        const memoryLines = memory.split('\r\n');
        const usedMemory = memoryLines.find((line) => line.startsWith('used_memory:'))?.split(':')[1];
        const usedMemoryHuman = memoryLines.find((line) => line.startsWith('used_memory_human:'))?.split(':')[1];
        const maxMemory = memoryLines.find((line) => line.startsWith('maxmemory:'))?.split(':')[1];
        const maxMemoryHuman = memoryLines.find((line) => line.startsWith('maxmemory_human:'))?.split(':')[1];
        // Stats情報を解析
        const statsLines = info.split('\r\n');
        const totalConnectionsReceived = statsLines.find((line) => line.startsWith('total_connections_received:'))?.split(':')[1];
        const totalCommandsProcessed = statsLines.find((line) => line.startsWith('total_commands_processed:'))?.split(':')[1];
        const uptime = statsLines.find((line) => line.startsWith('uptime_in_seconds:'))?.split(':')[1];
        res.json({
            success: true,
            data: {
                connected: true,
                info: {
                    dbSize,
                    memory: {
                        used: usedMemory,
                        usedHuman: usedMemoryHuman,
                        max: maxMemory,
                        maxHuman: maxMemoryHuman
                    },
                    stats: {
                        totalConnectionsReceived: totalConnectionsReceived ? parseInt(totalConnectionsReceived) : 0,
                        totalCommandsProcessed: totalCommandsProcessed ? parseInt(totalCommandsProcessed) : 0,
                        uptimeSeconds: uptime ? parseInt(uptime) : 0
                    }
                }
            }
        });
    }
    catch (error) {
        console.error('Failed to get cache info:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message
        });
    }
});
/**
 * キーのリストを取得（パターンフィルタ付き）
 * GET /api/admin/cache/keys?pattern=*&limit=100
 */
exports.cacheRouter.get('/keys', async (req, res) => {
    try {
        const connected = cacheService_1.cacheService.isConnected();
        if (!connected) {
            return res.json({
                success: true,
                data: {
                    keys: [],
                    total: 0,
                    pattern: req.query.pattern || '*'
                }
            });
        }
        // @ts-ignore
        const client = cacheService_1.cacheService['client'];
        if (!client) {
            return res.json({
                success: true,
                data: {
                    keys: [],
                    total: 0,
                    pattern: req.query.pattern || '*'
                }
            });
        }
        const pattern = req.query.pattern || '*';
        const limit = parseInt(req.query.limit) || 100;
        // KEYSコマンドでキーを取得（本番環境では大量のキーがある場合はSCANを使用すべき）
        const keys = await client.keys(pattern);
        // 制限を適用
        const limitedKeys = keys.slice(0, limit);
        // 各キーのTTLを取得
        const keysWithTtl = await Promise.all(limitedKeys.map(async (key) => {
            const ttl = await client.ttl(key);
            const type = await client.type(key);
            const size = await client.memory('USAGE', key).catch(() => null);
            return {
                key,
                ttl: ttl === -1 ? null : ttl, // -1は永続キー
                type,
                size
            };
        }));
        res.json({
            success: true,
            data: {
                keys: keysWithTtl,
                total: keys.length,
                pattern,
                limit
            }
        });
    }
    catch (error) {
        console.error('Failed to get keys:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message
        });
    }
});
/**
 * 特定のキーの値を取得
 * GET /api/admin/cache/key/:key
 */
exports.cacheRouter.get('/key/:key', async (req, res) => {
    try {
        const connected = cacheService_1.cacheService.isConnected();
        if (!connected) {
            return res.status(503).json({
                success: false,
                error: 'Redis is not connected'
            });
        }
        const { key } = req.params;
        // @ts-ignore
        const client = cacheService_1.cacheService['client'];
        if (!client) {
            return res.status(503).json({
                success: false,
                error: 'Redis client is not available'
            });
        }
        const value = await client.get(key);
        const ttl = await client.ttl(key);
        const type = await client.type(key);
        if (value === null) {
            return res.status(404).json({
                success: false,
                error: 'Key not found'
            });
        }
        // JSON文字列ならパース
        let parsedValue = value;
        try {
            parsedValue = JSON.parse(value);
        }
        catch {
            // パースできない場合はそのまま
        }
        res.json({
            success: true,
            data: {
                key,
                value: parsedValue,
                ttl: ttl === -1 ? null : ttl,
                type
            }
        });
    }
    catch (error) {
        console.error('Failed to get key:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message
        });
    }
});
/**
 * 特定のキーを削除
 * DELETE /api/admin/cache/key/:key
 */
exports.cacheRouter.delete('/key/:key', async (req, res) => {
    try {
        const { key } = req.params;
        await cacheService_1.cacheService.delete(key);
        res.json({
            success: true,
            message: `Key "${key}" deleted successfully`
        });
    }
    catch (error) {
        console.error('Failed to delete key:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message
        });
    }
});
/**
 * パターンに一致するキーを一括削除
 * DELETE /api/admin/cache/pattern
 * Body: { pattern: "youtube:*" }
 */
exports.cacheRouter.delete('/pattern', async (req, res) => {
    try {
        const { pattern } = req.body;
        if (!pattern || typeof pattern !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Pattern is required'
            });
        }
        await cacheService_1.cacheService.deletePattern(pattern);
        res.json({
            success: true,
            message: `Keys matching pattern "${pattern}" deleted successfully`
        });
    }
    catch (error) {
        console.error('Failed to delete pattern:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message
        });
    }
});
/**
 * 全キャッシュをフラッシュ
 * POST /api/admin/cache/flush
 */
exports.cacheRouter.post('/flush', async (req, res) => {
    try {
        const connected = cacheService_1.cacheService.isConnected();
        if (!connected) {
            return res.status(503).json({
                success: false,
                error: 'Redis is not connected'
            });
        }
        // @ts-ignore
        const client = cacheService_1.cacheService['client'];
        if (!client) {
            return res.status(503).json({
                success: false,
                error: 'Redis client is not available'
            });
        }
        await client.flushdb();
        res.json({
            success: true,
            message: 'All cache flushed successfully'
        });
    }
    catch (error) {
        console.error('Failed to flush cache:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message
        });
    }
});
//# sourceMappingURL=cache.js.map