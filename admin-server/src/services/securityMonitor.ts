import { redisClient } from './redisClient';
import { Alert, IPInfo, SecurityMetrics, REDIS_KEYS, TTL } from '../types';
import { randomBytes } from 'crypto';

class SecurityMonitor {
  // Redis未接続時のメモリストレージ
  private memoryBlockedIPs: Map<string, { ip: string; reason: string; blockedAt: string; permanent: boolean }> = new Map();
  private memoryAlerts: Alert[] = [];
  private memoryWhitelist: Set<string> = new Set();
  /**
   * アクセスログを記録
   */
  async logAccess(ip: string, endpoint: string, userAgent: string): Promise<void> {
    try {
      const timestamp = Date.now();
      const key = REDIS_KEYS.SECURITY_ACCESS_LOG(ip, timestamp);

      await redisClient.hset(key, 'endpoint', endpoint);
      await redisClient.hset(key, 'userAgent', userAgent);
      await redisClient.hset(key, 'timestamp', new Date().toISOString());
      await redisClient.expire(key, TTL.SECURITY_LOG);

      // 疑わしいアクティビティを検知
      await this.detectSuspiciousActivity(ip);
    } catch (error) {
      console.error('[SecurityMonitor] Error logging access:', error);
    }
  }

  /**
   * 疑わしいアクティビティ検知
   */
  private async detectSuspiciousActivity(ip: string): Promise<void> {
    try {
      // 過去1分間のアクセス数をカウント
      const oneMinuteAgo = Date.now() - 60000;
      const keys = await redisClient.keys(`admin:security:access_log:${ip}:*`);

      const recentKeys = keys.filter(key => {
        const timestamp = parseInt(key.split(':').pop() || '0', 10);
        return timestamp >= oneMinuteAgo;
      });

      const accessCount = recentKeys.length;

      // 短時間に大量アクセス（100回/分）
      if (accessCount > 100) {
        await this.flagSuspicious(ip, 'High request rate', 80);
        await this.createAlert('warning', `Suspicious activity from ${ip}: ${accessCount} requests/min`);
      }
    } catch (error) {
      console.error('[SecurityMonitor] Error detecting suspicious activity:', error);
    }
  }

  /**
   * IPを疑わしいとマーク
   */
  async flagSuspicious(ip: string, reason: string, score: number): Promise<void> {
    try {
      const key = REDIS_KEYS.SECURITY_SUSPICIOUS(ip);
      await redisClient.hset(key, 'reason', reason);
      await redisClient.hset(key, 'score', score.toString());
      await redisClient.hset(key, 'flaggedAt', new Date().toISOString());
      await redisClient.expire(key, TTL.SECURITY_LOG);

      console.log(`[SecurityMonitor] IP ${ip} flagged as suspicious: ${reason} (score: ${score})`);
    } catch (error) {
      console.error('[SecurityMonitor] Error flagging suspicious IP:', error);
    }
  }

  /**
   * IPをブロック
   */
  async blockIP(ip: string, permanent: boolean, reason: string): Promise<void> {
    try {
      const blockedAt = new Date().toISOString();

      // メモリに保存
      this.memoryBlockedIPs.set(ip, {
        ip,
        reason,
        blockedAt,
        permanent
      });

      // Redisにも保存（接続している場合のみ）
      if (redisClient.isReady()) {
        const key = permanent
          ? REDIS_KEYS.SECURITY_BLOCKED_PERMANENT(ip)
          : REDIS_KEYS.SECURITY_BLOCKED_TEMP(ip);

        const data = JSON.stringify({
          reason,
          blockedAt
        });

        await redisClient.set(key, data);

        if (!permanent) {
          await redisClient.expire(key, TTL.SECURITY_TEMP_BLOCK);
        }
      }

      await this.createAlert('error', `IP ${ip} blocked: ${reason}`);
      console.log(`[SecurityMonitor] IP ${ip} blocked (permanent: ${permanent}): ${reason}`);
    } catch (error) {
      console.error('[SecurityMonitor] Error blocking IP:', error);
      throw error;
    }
  }

  /**
   * IPブロック解除
   */
  async unblockIP(ip: string): Promise<void> {
    try {
      // メモリから削除
      this.memoryBlockedIPs.delete(ip);

      // Redisからも削除（接続している場合のみ）
      if (redisClient.isReady()) {
        await redisClient.del(REDIS_KEYS.SECURITY_BLOCKED_PERMANENT(ip));
        await redisClient.del(REDIS_KEYS.SECURITY_BLOCKED_TEMP(ip));
      }

      console.log(`[SecurityMonitor] IP ${ip} unblocked`);
    } catch (error) {
      console.error('[SecurityMonitor] Error unblocking IP:', error);
      throw error;
    }
  }

  /**
   * ホワイトリスト追加
   */
  async whitelistIP(ip: string): Promise<void> {
    try {
      // メモリに追加
      this.memoryWhitelist.add(ip);

      // Redisにも追加（接続している場合のみ）
      if (redisClient.isReady()) {
        await redisClient.set(
          REDIS_KEYS.SECURITY_WHITELIST(ip),
          new Date().toISOString()
        );
      }

      console.log(`[SecurityMonitor] IP ${ip} added to whitelist`);
    } catch (error) {
      console.error('[SecurityMonitor] Error whitelisting IP:', error);
      throw error;
    }
  }

  /**
   * ホワイトリストから削除
   */
  async removeFromWhitelist(ip: string): Promise<void> {
    try {
      // メモリから削除
      this.memoryWhitelist.delete(ip);

      // Redisからも削除（接続している場合のみ）
      if (redisClient.isReady()) {
        await redisClient.del(REDIS_KEYS.SECURITY_WHITELIST(ip));
      }

      console.log(`[SecurityMonitor] IP ${ip} removed from whitelist`);
    } catch (error) {
      console.error('[SecurityMonitor] Error removing from whitelist:', error);
      throw error;
    }
  }

  /**
   * アラート作成
   */
  private async createAlert(type: Alert['type'], message: string): Promise<void> {
    try {
      const alert: Alert = {
        id: `alert_${Date.now()}_${randomBytes(4).toString('hex')}`,
        type,
        message,
        timestamp: new Date().toISOString()
      };

      // メモリに追加（最新100件保持）
      this.memoryAlerts.unshift(alert); // 先頭に追加
      if (this.memoryAlerts.length > 100) {
        this.memoryAlerts = this.memoryAlerts.slice(0, 100);
      }

      // Redisにも追加（接続している場合のみ）
      if (redisClient.isReady()) {
        await redisClient.lpush(REDIS_KEYS.SECURITY_ALERTS, JSON.stringify(alert));
        await redisClient.ltrim(REDIS_KEYS.SECURITY_ALERTS, 0, 99); // 最新100件保持
      }

      console.log(`[SecurityMonitor] Alert created: [${type}] ${message}`);
    } catch (error) {
      console.error('[SecurityMonitor] Error creating alert:', error);
    }
  }

  /**
   * セキュリティメトリクスを取得
   */
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    try {
      // Redis接続時
      if (redisClient.isReady()) {
        // ユニークIP数をカウント（過去1時間）
        const oneHourAgo = Date.now() - 3600000;
        const allAccessKeys = await redisClient.keys('admin:security:access_log:*');
        const recentIPs = new Set<string>();

        for (const key of allAccessKeys) {
          const timestamp = parseInt(key.split(':').pop() || '0', 10);
          if (timestamp >= oneHourAgo) {
            const ip = key.split(':')[3]; // admin:security:access_log:IP:timestamp
            recentIPs.add(ip);
          }
        }

        // ブロック中IP数
        const blockedPermanentKeys = await redisClient.keys('admin:security:blocked:permanent:*');
        const blockedTempKeys = await redisClient.keys('admin:security:blocked:temp:*');
        const blockedCount = blockedPermanentKeys.length + blockedTempKeys.length;

        // 疑わしいIP数（スコア50以上）
        const suspiciousKeys = await redisClient.keys('admin:security:suspicious:*');
        let suspiciousCount = 0;
        for (const key of suspiciousKeys) {
          const data = await redisClient.hgetall(key);
          if (data && parseInt(data.score || '0', 10) >= 50) {
            suspiciousCount++;
          }
        }

        // ホワイトリストIP数
        const whitelistKeys = await redisClient.keys('admin:security:whitelist:*');
        const whitelistCount = whitelistKeys.length;

        // 最近のアラート
        const alertsData = await redisClient.lrange(REDIS_KEYS.SECURITY_ALERTS, 0, 9);
        const recentAlerts: Alert[] = alertsData.map(data => JSON.parse(data));

        // アクセス上位IP（簡易版 - 実際はもっと詳細に集計）
        const topIPs: IPInfo[] = [];

        return {
          totalUniqueIPs: recentIPs.size,
          blockedIPs: blockedCount,
          suspiciousIPs: suspiciousCount,
          whitelistIPs: whitelistCount,
          recentAlerts,
          topIPs
        };
      }

      // Redis未接続時はメモリから返す
      return {
        totalUniqueIPs: 0,
        blockedIPs: this.memoryBlockedIPs.size,
        suspiciousIPs: 0,
        whitelistIPs: this.memoryWhitelist.size,
        recentAlerts: this.memoryAlerts.slice(0, 10),
        topIPs: []
      };
    } catch (error) {
      console.error('[SecurityMonitor] Error getting security metrics:', error);
      // エラー時もメモリから返す
      return {
        totalUniqueIPs: 0,
        blockedIPs: this.memoryBlockedIPs.size,
        suspiciousIPs: 0,
        whitelistIPs: this.memoryWhitelist.size,
        recentAlerts: this.memoryAlerts.slice(0, 10),
        topIPs: []
      };
    }
  }
}

// シングルトンインスタンス
export const securityMonitor = new SecurityMonitor();
