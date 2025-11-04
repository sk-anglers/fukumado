import { Request, Response, NextFunction } from 'express';
import { PVTrackerService } from '../services/pvTrackerService';

/**
 * ボット判定用のUser-Agentパターン
 */
const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /googlebot/i,
  /bingbot/i,
  /yandex/i,
  /baiduspider/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slack/i,
  /discord/i,
  /whatsapp/i,
  /telegram/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
];

/**
 * User-Agentからボットを判定
 */
function isBot(userAgent: string | undefined): boolean {
  if (!userAgent) return true; // User-Agentがない場合はボット扱い

  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * クライアントのIPアドレスを取得
 */
function getClientIP(req: Request): string {
  // Renderのリバースプロキシ経由の場合
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  // 直接接続の場合
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * PVカウントミドルウェアを作成
 */
export function createPVCounterMiddleware(pvTracker: PVTrackerService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // API呼び出しは除外（/api/、/auth/など）
      if (req.path.startsWith('/api/') ||
          req.path.startsWith('/auth/') ||
          req.path.startsWith('/chat')) {
        return next();
      }

      // 静的ファイルは除外（拡張子がある場合）
      const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
      if (hasExtension && !req.path.endsWith('.html')) {
        return next();
      }

      // User-Agentをチェック
      const userAgent = req.headers['user-agent'];
      if (isBot(userAgent)) {
        console.log('[PVCounter] Bot detected:', userAgent);
        return next();
      }

      // IPアドレスを取得
      const ip = getClientIP(req);

      // PVをカウント（非同期で実行、エラーでもブロックしない）
      pvTracker.trackPageView(
        ip,
        req.path,
        req.headers['referer'],
        userAgent,
        undefined, // userId (セッションから取得可能だが後で実装)
        undefined  // deviceType (User-Agentから判定可能だが後で実装)
      ).catch((error) => {
        console.error('[PVCounter] Error tracking page view:', error);
      });

      console.log('[PVCounter] Page view tracked:', {
        path: req.path,
        ip: ip.substring(0, 10) + '...', // IPの一部のみログ
        userAgent: userAgent?.substring(0, 50)
      });
    } catch (error) {
      console.error('[PVCounter] Middleware error:', error);
    }

    next();
  };
}
