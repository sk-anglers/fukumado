"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twitchConduitClient = exports.TwitchConduitClient = void 0;
const apiTracker_1 = require("../utils/apiTracker");
const env_1 = require("../config/env");
const twitchAppAuth_1 = require("./twitchAppAuth");
/**
 * Twitch EventSub Conduits APIクライアント
 *
 * Conduits APIはApp Access Tokenが必要です。
 * 公式ドキュメント: https://dev.twitch.tv/docs/eventsub/handling-conduit-events/
 */
class TwitchConduitClient {
    constructor() {
        this.baseUrl = 'https://api.twitch.tv/helix/eventsub';
    }
    /**
     * 共通ヘッダーを取得
     */
    async getHeaders() {
        const appToken = await (0, twitchAppAuth_1.getTwitchAppAccessToken)();
        const { clientId } = env_1.env.twitch;
        if (!clientId) {
            throw new Error('Twitch Client ID is required');
        }
        return {
            'Authorization': `Bearer ${appToken}`,
            'Client-Id': clientId,
            'Content-Type': 'application/json'
        };
    }
    /**
     * Conduitを作成
     *
     * @param shardCount シャード数（1-20000）
     * @returns 作成されたConduit
     */
    async createConduit(shardCount) {
        if (shardCount < 1 || shardCount > 20000) {
            throw new Error('Shard count must be between 1 and 20000');
        }
        console.log(`[Conduit Client] Creating conduit with ${shardCount} shards...`);
        const headers = await this.getHeaders();
        const response = await (0, apiTracker_1.trackedFetch)(`${this.baseUrl}/conduits`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ shard_count: shardCount }),
            service: 'twitch',
            endpoint: 'POST /eventsub/conduits'
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create conduit: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        const conduit = data.data[0];
        console.log(`[Conduit Client] Conduit created: ${conduit.id} with ${conduit.shard_count} shards`);
        return conduit;
    }
    /**
     * Conduitのシャード数を更新
     *
     * @param conduitId Conduit ID
     * @param shardCount 新しいシャード数
     * @returns 更新されたConduit
     */
    async updateConduit(conduitId, shardCount) {
        if (shardCount < 1 || shardCount > 20000) {
            throw new Error('Shard count must be between 1 and 20000');
        }
        console.log(`[Conduit Client] Updating conduit ${conduitId} to ${shardCount} shards...`);
        const headers = await this.getHeaders();
        const response = await (0, apiTracker_1.trackedFetch)(`${this.baseUrl}/conduits`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ id: conduitId, shard_count: shardCount }),
            service: 'twitch',
            endpoint: 'PATCH /eventsub/conduits'
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update conduit: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        const conduit = data.data[0];
        console.log(`[Conduit Client] Conduit updated: ${conduit.id} now has ${conduit.shard_count} shards`);
        return conduit;
    }
    /**
     * Conduit一覧を取得
     *
     * @returns Conduit一覧
     */
    async getConduits() {
        console.log('[Conduit Client] Fetching conduits...');
        const headers = await this.getHeaders();
        const response = await (0, apiTracker_1.trackedFetch)(`${this.baseUrl}/conduits`, {
            method: 'GET',
            headers,
            service: 'twitch',
            endpoint: 'GET /eventsub/conduits'
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get conduits: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log(`[Conduit Client] Found ${data.data.length} conduit(s)`);
        return data.data;
    }
    /**
     * Conduitを削除
     *
     * @param conduitId Conduit ID
     */
    async deleteConduit(conduitId) {
        console.log(`[Conduit Client] Deleting conduit ${conduitId}...`);
        const headers = await this.getHeaders();
        const response = await (0, apiTracker_1.trackedFetch)(`${this.baseUrl}/conduits?id=${conduitId}`, {
            method: 'DELETE',
            headers,
            service: 'twitch',
            endpoint: 'DELETE /eventsub/conduits'
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to delete conduit: ${response.status} - ${errorText}`);
        }
        console.log(`[Conduit Client] Conduit ${conduitId} deleted`);
    }
    /**
     * Conduitのシャードを更新（WebSocket session IDの関連付け）
     *
     * @param request シャード更新リクエスト
     * @returns 更新されたシャード一覧
     */
    async updateShards(request) {
        console.log(`[Conduit Client] Updating ${request.shards.length} shard(s) for conduit ${request.conduit_id}...`);
        const headers = await this.getHeaders();
        const response = await (0, apiTracker_1.trackedFetch)(`${this.baseUrl}/conduits/shards`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(request),
            service: 'twitch',
            endpoint: 'PATCH /eventsub/conduits/shards'
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update shards: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
            console.error(`[Conduit Client] Shard update errors:`, data.errors);
        }
        else {
            console.log(`[Conduit Client] ${data.data.length} shard(s) updated successfully`);
        }
        return data;
    }
    /**
     * Conduitのシャード一覧を取得
     *
     * @param conduitId Conduit ID
     * @param after ページネーションカーソル（オプション）
     * @returns シャード一覧
     */
    async getShards(conduitId, after) {
        const url = after
            ? `${this.baseUrl}/conduits/shards?conduit_id=${conduitId}&after=${after}`
            : `${this.baseUrl}/conduits/shards?conduit_id=${conduitId}`;
        console.log(`[Conduit Client] Fetching shards for conduit ${conduitId}...`);
        const headers = await this.getHeaders();
        const response = await (0, apiTracker_1.trackedFetch)(url, {
            method: 'GET',
            headers,
            service: 'twitch',
            endpoint: 'GET /eventsub/conduits/shards'
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get shards: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log(`[Conduit Client] Found ${data.data.length} shard(s)`);
        return data;
    }
}
exports.TwitchConduitClient = TwitchConduitClient;
// シングルトンインスタンス
exports.twitchConduitClient = new TwitchConduitClient();
//# sourceMappingURL=twitchConduitClient.js.map