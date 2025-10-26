import Redis from 'ioredis';
import { env } from '../config/env';

class CacheService {
  private client: Redis | null = null;
  private connected: boolean = false;
  private retryAttempts: number = 0;
  private maxRetries: number = 3;
  private hasLoggedWarning: boolean = false;

  constructor() {
    try {
      this.client = new Redis({
        host: env.redis.host,
        port: env.redis.port,
        password: env.redis.password,
        db: env.redis.db,
        retryStrategy: (times) => {
          this.retryAttempts = times;

          // 最大リトライ回数を超えたら諦める
          if (times > this.maxRetries) {
            if (!this.hasLoggedWarning) {
              console.warn('[Redis] Max retries reached. Redis will be disabled. App will continue without caching.');
              this.hasLoggedWarning = true;
            }
            return null; // nullを返すとリトライを停止
          }

          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false, // オフライン時はコマンドをキューに入れない
        lazyConnect: true // 遅延接続（必要になるまで接続しない）
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected to Redis server');
        this.connected = true;
        this.retryAttempts = 0;
      });

      this.client.on('error', (err) => {
        // 初回のエラーのみログ出力
        if (this.retryAttempts <= 1 && !this.hasLoggedWarning) {
          console.warn('[Redis] Redis is not available. Caching is disabled, but the app will continue to work.');
          console.warn('[Redis] To enable caching, start Redis server on localhost:6379');
        }
        this.connected = false;
      });

      this.client.on('close', () => {
        if (this.connected) {
          console.log('[Redis] Connection closed');
        }
        this.connected = false;
      });

      // 初回接続を試みる（失敗しても続行）
      this.client.connect().catch(() => {
        // 接続失敗は無視（警告は既に出力済み）
      });
    } catch (error) {
      console.warn('[Redis] Failed to initialize Redis client. Caching disabled.');
      this.client = null;
    }
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
    if (!this.client || !this.connected) {
      // Redisが利用できない場合は静かに無視
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, serialized);
      console.log(`[Redis] Set cache: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      console.error(`[Redis] Failed to set cache: ${key}`, error);
      // エラーは投げない（キャッシュは必須ではないため）
    }
  }

  /**
   * キャッシュから値を取得
   * @param key キー
   * @returns 値（存在しない場合はnull）
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.connected) {
      // Redisが利用できない場合はnullを返す
      return null;
    }

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
    if (!this.client || !this.connected) {
      return;
    }

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
    if (!this.client || !this.connected) {
      return;
    }

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
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
      console.log('[Redis] Connection closed gracefully');
    } catch (error) {
      // クローズ時のエラーは無視
    }
  }
}

// シングルトンインスタンス
export const cacheService = new CacheService();
