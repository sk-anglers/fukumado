import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

/**
 * セキュリティヘッダーミドルウェア（Helmet）
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.twitch.tv', 'https://id.twitch.tv', 'wss://eventsub.wss.twitch.tv'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * レート制限 - API全般
 * 1分間に60リクエストまで
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 60, // 最大60リクエスト
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.warn(`[Security] Rate limit exceeded: ${req.ip} - ${req.path}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * レート制限 - 認証エンドポイント
 * 1分間に10リクエストまで（認証は厳しく）
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 10, // 最大10リクエスト
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
  handler: (req: Request, res: Response) => {
    console.warn(`[Security] Auth rate limit exceeded: ${req.ip} - ${req.path}`);
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * レート制限 - WebSocket関連
 * 1分間に30リクエストまで
 */
export const websocketRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 30, // 最大30リクエスト
  message: { error: 'Too many WebSocket requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.warn(`[Security] WebSocket rate limit exceeded: ${req.ip} - ${req.path}`);
    res.status(429).json({
      error: 'Too many WebSocket requests, please try again later.',
      retryAfter: 60,
    });
  },
});

/**
 * IPブロックリスト管理
 */
class IPBlocklist {
  private blockedIPs: Map<string, { until: Date; reason: string }> = new Map();
  private violationCount: Map<string, number> = new Map();

  /**
   * IPをブロック
   */
  public block(ip: string, durationMs: number, reason: string): void {
    const until = new Date(Date.now() + durationMs);
    this.blockedIPs.set(ip, { until, reason });
    console.warn(`[Security] Blocked IP: ${ip} until ${until.toISOString()} - Reason: ${reason}`);
  }

  /**
   * IPがブロックされているか確認
   */
  public isBlocked(ip: string): boolean {
    const block = this.blockedIPs.get(ip);
    if (!block) {
      return false;
    }

    // ブロック期限が過ぎていれば削除
    if (block.until < new Date()) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * 違反を記録し、必要に応じて自動ブロック
   */
  public recordViolation(ip: string, type: string): void {
    const count = (this.violationCount.get(ip) || 0) + 1;
    this.violationCount.set(ip, count);

    console.warn(`[Security] Violation recorded: ${ip} - Type: ${type} - Count: ${count}`);

    // 違反回数に応じて自動ブロック
    if (count >= 10) {
      // 10回以上の違反 → 1時間ブロック
      this.block(ip, 60 * 60 * 1000, `Multiple violations (${count})`);
      this.violationCount.delete(ip);
    } else if (count >= 5) {
      // 5回以上の違反 → 10分ブロック
      this.block(ip, 10 * 60 * 1000, `Repeated violations (${count})`);
    }

    // 違反カウントは5分後にリセット
    setTimeout(() => {
      const currentCount = this.violationCount.get(ip) || 0;
      if (currentCount > 0) {
        this.violationCount.set(ip, currentCount - 1);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * ブロックされたIPの統計を取得
   */
  public getStats(): { blockedCount: number; violationCount: number } {
    return {
      blockedCount: this.blockedIPs.size,
      violationCount: this.violationCount.size,
    };
  }

  /**
   * ブロックリストをクリア（テスト用）
   */
  public clear(): void {
    this.blockedIPs.clear();
    this.violationCount.clear();
  }
}

export const ipBlocklist = new IPBlocklist();

/**
 * IPブロックチェックミドルウェア
 */
export const checkBlockedIP = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (ipBlocklist.isBlocked(ip)) {
    console.warn(`[Security] Blocked IP attempted access: ${ip} - ${req.path}`);
    res.status(403).json({
      error: 'Access denied. Your IP has been temporarily blocked due to suspicious activity.',
    });
    return;
  }

  next();
};

/**
 * リクエストサイズ制限の検証
 */
export const validateRequestSize = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = req.get('content-length');

  if (contentLength && parseInt(contentLength) > 100 * 1024) {
    // 100KB以上
    const ip = req.ip || 'unknown';
    console.warn(`[Security] Large request rejected: ${ip} - Size: ${contentLength} bytes`);
    ipBlocklist.recordViolation(ip, 'large_request');
    res.status(413).json({ error: 'Request too large' });
    return;
  }

  next();
};
