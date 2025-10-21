import Redis from 'ioredis';
import { env } from '../config/env';

class CacheService {
  private client: Redis;
  private connected: boolean = false;

  constructor() {
    this.client = new Redis({
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password,
      db: env.redis.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.client.on('connect', () => {
      console.log('[Redis] Connected to Redis server');
      this.connected = true;
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Connection error:', err);
      this.connected = false;
    });

    this.client.on('close', () => {
      console.log('[Redis] Connection closed');
      this.connected = false;
    });
  }

  /**
   * Redisに接続されているか確認
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * キャッシュに値を設定（TTL付き）
   * @param key キー
   * @param value 値（オブジェクトはJSON文字列化される）
   * @param ttlSeconds TTL（秒単位）
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, serialized);
      console.log(`[Redis] Set cache: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      console.error(`[Redis] Failed to set cache: ${key}`, error);
      throw error;
    }
  }

  /**
   * キャッシュから値を取得
   * @param key キー
   * @returns 値（存在しない場合はnull）
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) {
        console.log(`[Redis] Cache miss: ${key}`);
        return null;
      }
      console.log(`[Redis] Cache hit: ${key}`);
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[Redis] Failed to get cache: ${key}`, error);
      return null;
    }
  }

  /**
   * キャッシュから値を削除
   * @param key キー
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
      console.log(`[Redis] Deleted cache: ${key}`);
    } catch (error) {
      console.error(`[Redis] Failed to delete cache: ${key}`, error);
    }
  }

  /**
   * パターンに一致するキーを全て削除
   * @param pattern キーのパターン（例: "youtube:*"）
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        console.log(`[Redis] Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      console.error(`[Redis] Failed to delete pattern: ${pattern}`, error);
    }
  }

  /**
   * Redis接続をクローズ
   */
  async close(): Promise<void> {
    await this.client.quit();
    console.log('[Redis] Connection closed gracefully');
  }
}

// シングルトンインスタンス
export const cacheService = new CacheService();
