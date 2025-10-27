import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * IP制限ミドルウェア
 * 許可されたIPアドレスからのアクセスのみを許可
 */
export const ipFilter = (req: Request, res: Response, next: NextFunction): void => {
  const allowedIPs = env.allowedIPs;

  // IP制限が設定されていない場合はスキップ
  if (allowedIPs.length === 0) {
    return next();
  }

  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';

  // IPv6形式のlocalhostを処理
  const normalizedIP = clientIP.replace(/^::ffff:/, '');

  // localhostは常に許可
  if (normalizedIP === '127.0.0.1' || normalizedIP === 'localhost' || normalizedIP === '::1') {
    return next();
  }

  if (allowedIPs.includes(normalizedIP)) {
    console.log(`[IPFilter] Access allowed from IP: ${normalizedIP}`);
    return next();
  }

  console.warn(`[IPFilter] Access denied from IP: ${normalizedIP}`);
  res.status(403).json({
    success: false,
    error: 'Access forbidden: IP address not allowed',
    timestamp: new Date().toISOString()
  });
};
