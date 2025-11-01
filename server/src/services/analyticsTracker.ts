import Redis from 'ioredis';
import type {
  AnalyticsEvent,
  AnalyticsStats,
  EventType,
  LayoutPreset,
  DeviceType,
  ButtonType,
  FeatureType,
  StreamActionType,
  Platform
} from '../types/analytics';

/**
 * アナリティクストラッキングサービス
 * Redisを使用してイベントデータを記録・集計
 */
export class AnalyticsTracker {
  private redis: Redis;
  private readonly RETENTION_DAYS = 90; // データ保持期間（日）

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * イベントを記録
   */
  async trackEvent(event: AnalyticsEvent, ip: string): Promise<void> {
    const dateKey = this.getDateKey(new Date());
    const hourKey = this.getHourKey(new Date());

    try {
      // イベントをJSON形式で保存（リスト）
      const eventData = JSON.stringify({
        ...event,
        ip: this.hashIP(ip)
      });

      await Promise.all([
        // イベントログを保存（最新1000件まで）
        this.redis.lpush(`analytics:events:${event.type}`, eventData),
        this.redis.ltrim(`analytics:events:${event.type}`, 0, 999),

        // イベント総数をカウント
        this.redis.incr(`analytics:count:total`),
        this.redis.incr(`analytics:count:daily:${dateKey}`),
        this.redis.expire(`analytics:count:daily:${dateKey}`, 60 * 60 * 24 * this.RETENTION_DAYS),

        // 時間別カウント
        this.redis.incr(`analytics:count:hourly:${hourKey}`),
        this.redis.expire(`analytics:count:hourly:${hourKey}`, 60 * 60 * 24 * 7), // 7日間保持

        // ユニークユーザー（IPハッシュ）
        this.redis.sadd(`analytics:unique:daily:${dateKey}`, this.hashIP(ip)),
        this.redis.expire(`analytics:unique:daily:${dateKey}`, 60 * 60 * 24 * this.RETENTION_DAYS)
      ]);

      // イベントタイプ別の集計
      await this.aggregateEvent(event, dateKey);

    } catch (error) {
      console.error('[AnalyticsTracker] Error tracking event:', error);
    }
  }

  /**
   * イベントタイプ別の集計処理
   */
  private async aggregateEvent(event: AnalyticsEvent, dateKey: string): Promise<void> {
    const ttl = 60 * 60 * 24 * this.RETENTION_DAYS;

    switch (event.type) {
      case 'layout_change': {
        const { slotsCount, preset } = event.data;
        await Promise.all([
          // 分割数別カウント
          this.redis.hincrby(`analytics:layout:slots`, slotsCount.toString(), 1),
          this.redis.hincrby(`analytics:layout:slots:daily:${dateKey}`, slotsCount.toString(), 1),
          this.redis.expire(`analytics:layout:slots:daily:${dateKey}`, ttl),

          // プリセット別カウント
          this.redis.hincrby(`analytics:layout:preset`, preset, 1),
          this.redis.hincrby(`analytics:layout:preset:daily:${dateKey}`, preset, 1),
          this.redis.expire(`analytics:layout:preset:daily:${dateKey}`, ttl)
        ]);
        break;
      }

      case 'button_click': {
        const { buttonType } = event.data;
        await Promise.all([
          this.redis.hincrby(`analytics:buttons`, buttonType, 1),
          this.redis.hincrby(`analytics:buttons:daily:${dateKey}`, buttonType, 1),
          this.redis.expire(`analytics:buttons:daily:${dateKey}`, ttl)
        ]);
        break;
      }

      case 'feature_use': {
        const { featureType, platform } = event.data;
        const promises = [
          this.redis.hincrby(`analytics:features`, featureType, 1),
          this.redis.hincrby(`analytics:features:daily:${dateKey}`, featureType, 1),
          this.redis.expire(`analytics:features:daily:${dateKey}`, ttl)
        ];

        if (platform) {
          promises.push(
            this.redis.hincrby(`analytics:platforms`, platform, 1),
            this.redis.hincrby(`analytics:platforms:daily:${dateKey}`, platform, 1),
            this.redis.expire(`analytics:platforms:daily:${dateKey}`, ttl)
          );
        }

        await Promise.all(promises);
        break;
      }

      case 'stream_action': {
        const { actionType, platform } = event.data;
        await Promise.all([
          this.redis.hincrby(`analytics:streams:actions`, actionType, 1),
          this.redis.hincrby(`analytics:streams:actions:daily:${dateKey}`, actionType, 1),
          this.redis.expire(`analytics:streams:actions:daily:${dateKey}`, ttl),

          this.redis.hincrby(`analytics:streams:platforms`, platform, 1),
          this.redis.hincrby(`analytics:streams:platforms:daily:${dateKey}`, platform, 1),
          this.redis.expire(`analytics:streams:platforms:daily:${dateKey}`, ttl)
        ]);
        break;
      }

      case 'auth_action': {
        const { platform, action, success } = event.data;
        if (success) {
          const key = action === 'login' ? 'logins' : 'logouts';
          await Promise.all([
            this.redis.hincrby(`analytics:auth:${key}`, platform, 1),
            this.redis.hincrby(`analytics:auth:${key}:daily:${dateKey}`, platform, 1),
            this.redis.expire(`analytics:auth:${key}:daily:${dateKey}`, ttl)
          ]);
        }
        break;
      }

      case 'session_start':
      case 'session_end': {
        // セッション統計は別途処理
        await this.redis.incr(`analytics:sessions:daily:${dateKey}`);
        await this.redis.expire(`analytics:sessions:daily:${dateKey}`, ttl);

        if (event.type === 'session_end' && event.data.duration) {
          // セッション時間を記録
          await this.redis.lpush(
            `analytics:sessions:durations:${dateKey}`,
            event.data.duration.toString()
          );
          await this.redis.ltrim(`analytics:sessions:durations:${dateKey}`, 0, 9999);
          await this.redis.expire(`analytics:sessions:durations:${dateKey}`, ttl);
        }
        break;
      }
    }

    // デバイス情報の集計
    if (event.deviceType) {
      await Promise.all([
        this.redis.hincrby(`analytics:devices`, event.deviceType, 1),
        this.redis.hincrby(`analytics:devices:daily:${dateKey}`, event.deviceType, 1),
        this.redis.expire(`analytics:devices:daily:${dateKey}`, ttl)
      ]);
    }

    // 画面サイズの記録
    if (event.screenWidth && event.screenHeight) {
      const sizeKey = `${event.screenWidth}x${event.screenHeight}`;
      await Promise.all([
        this.redis.hincrby(`analytics:screen_sizes`, sizeKey, 1),
        this.redis.hincrby(`analytics:screen_sizes:daily:${dateKey}`, sizeKey, 1),
        this.redis.expire(`analytics:screen_sizes:daily:${dateKey}`, ttl)
      ]);
    }
  }

  /**
   * 統計データを取得
   */
  async getStats(days: number = 30): Promise<AnalyticsStats> {
    try {
      const [
        totalEvents,
        layoutSlots,
        layoutPreset,
        devices,
        screenSizes,
        buttons,
        features,
        platforms,
        streamActions,
        streamPlatforms,
        authLogins,
        authLogouts,
        dailyStats
      ] = await Promise.all([
        this.redis.get(`analytics:count:total`),
        this.redis.hgetall(`analytics:layout:slots`),
        this.redis.hgetall(`analytics:layout:preset`),
        this.redis.hgetall(`analytics:devices`),
        this.redis.hgetall(`analytics:screen_sizes`),
        this.redis.hgetall(`analytics:buttons`),
        this.redis.hgetall(`analytics:features`),
        this.redis.hgetall(`analytics:platforms`),
        this.redis.hgetall(`analytics:streams:actions`),
        this.redis.hgetall(`analytics:streams:platforms`),
        this.redis.hgetall(`analytics:auth:logins`),
        this.redis.hgetall(`analytics:auth:logouts`),
        this.getDailyStats(days)
      ]);

      // 画面サイズデータの変換
      const screenSizesArray = Object.entries(screenSizes).map(([size, count]) => {
        const [width, height] = size.split('x').map(Number);
        return { width, height, count: parseInt(count, 10) };
      });

      return {
        total: {
          events: parseInt(totalEvents || '0', 10),
          sessions: dailyStats.reduce((sum, day) => sum + day.sessions, 0),
          uniqueUsers: dailyStats.reduce((sum, day) => sum + day.uniqueUsers, 0)
        },
        layout: {
          slotsDistribution: this.convertToNumberRecord(layoutSlots),
          presetDistribution: layoutPreset as Record<LayoutPreset, number>
        },
        device: {
          distribution: devices as Record<DeviceType, number>,
          screenSizes: screenSizesArray
        },
        buttons: {
          clicks: buttons as Record<ButtonType, number>
        },
        features: {
          usage: features as Record<FeatureType, number>,
          platformUsage: platforms as Record<Platform, number>
        },
        streams: {
          actions: streamActions as Record<StreamActionType, number>,
          platformActions: streamPlatforms as Record<Platform, number>
        },
        auth: {
          logins: authLogins as Record<Platform, number>,
          logouts: authLogouts as Record<Platform, number>
        },
        sessions: {
          averageDuration: await this.getAverageSessionDuration(days),
          averagePageViews: 0 // TODO: ページビュー追跡を実装
        },
        timeline: {
          daily: dailyStats
        }
      };
    } catch (error) {
      console.error('[AnalyticsTracker] Error getting stats:', error);
      throw error;
    }
  }

  /**
   * 日次統計を取得
   */
  private async getDailyStats(days: number): Promise<Array<{
    date: string;
    events: number;
    sessions: number;
    uniqueUsers: number;
  }>> {
    const stats = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = this.getDateKey(date);

      const [events, sessions, uniqueUsers] = await Promise.all([
        this.redis.get(`analytics:count:daily:${dateKey}`),
        this.redis.get(`analytics:sessions:daily:${dateKey}`),
        this.redis.scard(`analytics:unique:daily:${dateKey}`)
      ]);

      stats.push({
        date: dateKey,
        events: parseInt(events || '0', 10),
        sessions: parseInt(sessions || '0', 10),
        uniqueUsers: uniqueUsers || 0
      });
    }

    return stats.reverse();
  }

  /**
   * 平均セッション時間を計算
   */
  private async getAverageSessionDuration(days: number): Promise<number> {
    const now = new Date();
    let totalDuration = 0;
    let count = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = this.getDateKey(date);

      const durations = await this.redis.lrange(`analytics:sessions:durations:${dateKey}`, 0, -1);
      durations.forEach(duration => {
        totalDuration += parseInt(duration, 10);
        count++;
      });
    }

    return count > 0 ? totalDuration / count : 0;
  }

  /**
   * 文字列レコードを数値レコードに変換
   */
  private convertToNumberRecord(record: Record<string, string>): Record<number, number> {
    const result: Record<number, number> = {};
    Object.entries(record).forEach(([key, value]) => {
      result[parseInt(key, 10)] = parseInt(value, 10);
    });
    return result;
  }

  /**
   * IPアドレスをハッシュ化（プライバシー保護）
   */
  private hashIP(ip: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
  }

  /**
   * 日付キーを取得 (YYYY-MM-DD)
   */
  private getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 時間キーを取得 (YYYY-MM-DD-HH)
   */
  private getHourKey(date: Date): string {
    const dateKey = this.getDateKey(date);
    const hour = String(date.getHours()).padStart(2, '0');
    return `${dateKey}-${hour}`;
  }
}
