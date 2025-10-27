import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Basic認証ミドルウェア
 * HTTP Basic認証でユーザー名とパスワードを検証
 */
export const basicAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Fukumado Admin Dashboard"');
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (username === env.adminUsername && password === env.adminPassword) {
      // 認証成功
      console.log(`[Auth] User authenticated: ${username} from IP: ${req.ip}`);
      return next();
    }

    // 認証失敗
    console.warn(`[Auth] Authentication failed for user: ${username} from IP: ${req.ip}`);
    res.setHeader('WWW-Authenticate', 'Basic realm="Fukumado Admin Dashboard"');
    res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth] Error parsing credentials:', error);
    res.setHeader('WWW-Authenticate', 'Basic realm="Fukumado Admin Dashboard"');
    res.status(401).json({
      success: false,
      error: 'Invalid authentication format',
      timestamp: new Date().toISOString()
    });
  }
};
