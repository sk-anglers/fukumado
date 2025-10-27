import Redis from 'ioredis';
import { env } from '../config/env';

class RedisClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private retryAttempts: number = 0;
  private maxRetries: number = 3;
  private hasLoggedWarning: boolean = false;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      this.client = new Redis(env.redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: false, // オフライン時はコマンドをキューに入れない
        lazyConnect: true, // 遅延接続（必要になるまで接続しない）
        retryStrategy: (times: number) => {
          this.retryAttempts = times;

          // 最大リトライ回数を超えたら諦める
          if (times > this.maxRetries) {
            if (!this.hasLoggedWarning) {
              console.warn('[Redis] Max retries reached. Redis features will be disabled. App will continue without Redis.');
              this.hasLoggedWarning = true;
            }
            return null; // nullを返すとリトライを停止
          }

          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.retryAttempts = 0;
        console.log('[Redis] Connected successfully');
      });

      this.client.on('error', (err) => {
        // 初回のエラーのみログ出力
        if (this.retryAttempts <= 1 && !this.hasLoggedWarning) {
          console.warn('[Redis] Redis is not available. Redis features are disabled, but the app will continue to work.');
          console.warn('[Redis] To enable Redis features, start Redis server on localhost:6379');
        }
        this.isConnected = false;
      });

      this.client.on('close', () => {
        if (this.isConnected) {
          console.log('[Redis] Connection closed');
        }
        this.isConnected = false;
      });

      // 初回接続を試みる（失敗しても続行）
      this.client.connect().catch(() => {
        // 接続失敗は無視（警告は既に出力済み）
      });
    } catch (error) {
      console.warn('[Redis] Failed to initialize Redis client. Redis features disabled.');
      this.client = null;
      this.isConnected = false;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      console.log('[Redis] Disconnected');
    }
  }

  // ヘルパーメソッド

  async get(key: string): Promise<string | null> {
    if (!this.isReady()) {
      // Redis未接続時は静かにnullを返す
      return null;
    }
    try {
      return await this.client!.get(key);
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.isReady()) {
      // Redis未接続時は静かにfalseを返す
      return false;
    }
    try {
      if (ttl) {
        await this.client!.setex(key, ttl, value);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }
    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }
    try {
      await this.client!.hset(key, field, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    if (!this.isReady()) {
      return null;
    }
    try {
      return await this.client!.hgetall(key);
    } catch (error) {
      return null;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isReady()) {
      return [];
    }
    try {
      return await this.client!.keys(pattern);
    } catch (error) {
      return [];
    }
  }

  async lpush(key: string, value: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }
    try {
      await this.client!.lpush(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.isReady()) {
      return [];
    }
    try {
      return await this.client!.lrange(key, start, stop);
    } catch (error) {
      return [];
    }
  }

  async ltrim(key: string, start: number, stop: number): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }
    try {
      await this.client!.ltrim(key, start, stop);
      return true;
    } catch (error) {
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }
    try {
      await this.client!.expire(key, seconds);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// シングルトンインスタンス
export const redisClient = new RedisClient();
