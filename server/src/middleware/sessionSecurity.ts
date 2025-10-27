import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * セッション情報の拡張
 */
interface SessionData {
  userAgent?: string;
  ipAddress?: string;
  createdAt?: number;
  lastActivity?: number;
  csrfToken?: string;
}

/**
 * CSRFトークン生成
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * セッション初期化ミドルウェア
 * 新しいセッションが作成されたときにセキュリティ情報を記録
 */
export const initializeSession = (req: Request, res: Response, next: NextFunction): void => {
  const session = (req as any).session;

  if (!session) {
    next();
    return;
  }

  // 新しいセッションの場合、セキュリティ情報を記録
  if (!session.security) {
    session.security = {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip || req.socket.remoteAddress,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      csrfToken: generateCSRFToken()
    } as SessionData;

    console.log('[Session Security] New session initialized:', {
      sessionId: (req as any).sessionID,
      ip: session.security.ipAddress,
      userAgent: session.security.userAgent?.substring(0, 50)
    });
  } else {
    // 既存セッションの最終アクティビティを更新
    session.security.lastActivity = Date.now();
  }

  next();
};

/**
 * セッションハイジャック検出ミドルウェア
 * User-AgentとIPアドレスの変更を検出
 */
export const detectSessionHijacking = (req: Request, res: Response, next: NextFunction): void => {
  const session = (req as any).session;

  if (!session || !session.security) {
    next();
    return;
  }

  const currentUserAgent = req.get('user-agent');
  const currentIP = req.ip || req.socket.remoteAddress;
  const sessionData = session.security as SessionData;

  // User-Agentの検証
  if (sessionData.userAgent && currentUserAgent !== sessionData.userAgent) {
    console.warn('[Session Security] User-Agent mismatch detected:', {
      sessionId: (req as any).sessionID,
      expected: sessionData.userAgent?.substring(0, 50),
      actual: currentUserAgent?.substring(0, 50),
      ip: currentIP
    });

    // セッションを破棄
    session.destroy((err: any) => {
      if (err) {
        console.error('[Session Security] Failed to destroy session:', err);
      }
    });

    res.status(403).json({
      error: 'Session hijacking detected. Please log in again.'
    });
    return;
  }

  // IPアドレスの検証（警告のみ、破棄はしない）
  // モバイルネットワークやVPNの場合、IPが変わることがあるため
  if (sessionData.ipAddress && currentIP !== sessionData.ipAddress) {
    console.warn('[Session Security] IP address change detected:', {
      sessionId: (req as any).sessionID,
      expected: sessionData.ipAddress,
      actual: currentIP,
      userAgent: currentUserAgent?.substring(0, 50)
    });

    // IPアドレスを更新（ログアウトはさせない）
    sessionData.ipAddress = currentIP;
  }

  next();
};

/**
 * セッションタイムアウトチェックミドルウェア
 * 最終アクティビティから一定時間経過したセッションを無効化
 */
export const checkSessionTimeout = (
  maxInactiveMinutes: number = 30
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as any).session;

    if (!session || !session.security) {
      next();
      return;
    }

    const sessionData = session.security as SessionData;
    const now = Date.now();
    const lastActivity = sessionData.lastActivity || 0;
    const inactiveMs = now - lastActivity;
    const maxInactiveMs = maxInactiveMinutes * 60 * 1000;

    if (inactiveMs > maxInactiveMs) {
      console.warn('[Session Security] Session timeout:', {
        sessionId: (req as any).sessionID,
        inactiveMinutes: Math.floor(inactiveMs / 60000),
        maxInactiveMinutes
      });

      // セッションを破棄
      session.destroy((err: any) => {
        if (err) {
          console.error('[Session Security] Failed to destroy session:', err);
        }
      });

      res.status(401).json({
        error: 'Session expired due to inactivity. Please log in again.'
      });
      return;
    }

    // 最終アクティビティを更新
    sessionData.lastActivity = now;

    next();
  };
};

/**
 * セッション固定攻撃対策
 * ログイン成功時にセッションIDを再生成
 */
export const regenerateSession = (req: Request): Promise<void> => {
  return new Promise((resolve, reject) => {
    const session = (req as any).session;

    if (!session) {
      resolve();
      return;
    }

    // 古いセッションIDを保存
    const oldSessionId = (req as any).sessionID;

    // セッションを再生成
    session.regenerate((err: any) => {
      if (err) {
        console.error('[Session Security] Failed to regenerate session:', err);
        reject(err);
        return;
      }

      const newSessionId = (req as any).sessionID;

      console.log('[Session Security] Session regenerated:', {
        oldSessionId: oldSessionId?.substring(0, 8),
        newSessionId: newSessionId?.substring(0, 8)
      });

      // セキュリティ情報を再設定
      session.security = {
        userAgent: req.get('user-agent'),
        ipAddress: req.ip || req.socket.remoteAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        csrfToken: generateCSRFToken()
      } as SessionData;

      resolve();
    });
  });
};

/**
 * CSRF保護ミドルウェア
 * POSTリクエストでCSRFトークンを検証
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // GET、HEAD、OPTIONSリクエストはスキップ
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const session = (req as any).session;

  if (!session || !session.security) {
    // セッションがない場合はスキップ（認証が必要なエンドポイントでは別途チェック）
    next();
    return;
  }

  const sessionData = session.security as SessionData;
  const tokenFromHeader = req.get('x-csrf-token');
  const tokenFromBody = req.body?.csrfToken;

  const providedToken = tokenFromHeader || tokenFromBody;

  if (!providedToken) {
    console.warn('[Session Security] CSRF token missing:', {
      sessionId: (req as any).sessionID,
      method: req.method,
      path: req.path
    });

    res.status(403).json({
      error: 'CSRF token missing'
    });
    return;
  }

  if (providedToken !== sessionData.csrfToken) {
    console.warn('[Session Security] CSRF token mismatch:', {
      sessionId: (req as any).sessionID,
      method: req.method,
      path: req.path
    });

    res.status(403).json({
      error: 'Invalid CSRF token'
    });
    return;
  }

  next();
};

/**
 * CSRFトークンをレスポンスに含める
 */
export const includeCSRFToken = (req: Request, res: Response, next: NextFunction): void => {
  const session = (req as any).session;

  if (session && session.security) {
    const sessionData = session.security as SessionData;
    res.setHeader('X-CSRF-Token', sessionData.csrfToken || '');
  }

  next();
};

/**
 * セキュアセッションCookie設定
 */
export const secureSessionCookieOptions = {
  httpOnly: true, // JavaScriptからアクセス不可
  secure: process.env.NODE_ENV === 'production', // HTTPS必須（本番環境のみ）
  sameSite: 'strict' as const, // CSRF対策
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7日間
  path: '/'
};

/**
 * セッション統計情報を取得
 */
export class SessionStats {
  private activeSessions: Map<string, SessionData> = new Map();

  /**
   * セッション情報を記録
   */
  public recordSession(sessionId: string, data: SessionData): void {
    this.activeSessions.set(sessionId, data);
  }

  /**
   * セッション情報を削除
   */
  public removeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  /**
   * 統計情報を取得
   */
  public getStats(): {
    totalActiveSessions: number;
    oldestSessionAge: number;
    averageSessionAge: number;
  } {
    const now = Date.now();
    let totalAge = 0;
    let oldestAge = 0;

    for (const data of this.activeSessions.values()) {
      const age = now - (data.createdAt || now);
      totalAge += age;

      if (age > oldestAge) {
        oldestAge = age;
      }
    }

    return {
      totalActiveSessions: this.activeSessions.size,
      oldestSessionAge: Math.floor(oldestAge / 1000 / 60), // 分単位
      averageSessionAge: this.activeSessions.size > 0
        ? Math.floor(totalAge / this.activeSessions.size / 1000 / 60)
        : 0
    };
  }

  /**
   * 期限切れセッションをクリーンアップ
   */
  public cleanup(maxAgeMinutes: number = 60): number {
    const now = Date.now();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    let removedCount = 0;

    for (const [sessionId, data] of this.activeSessions) {
      const lastActivity = data.lastActivity || data.createdAt || 0;
      const age = now - lastActivity;

      if (age > maxAgeMs) {
        this.activeSessions.delete(sessionId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[Session Stats] Cleaned up ${removedCount} expired sessions`);
    }

    return removedCount;
  }
}

// シングルトンインスタンス
export const sessionStats = new SessionStats();

// 定期的なクリーンアップ（10分ごと）
setInterval(() => {
  sessionStats.cleanup(60); // 60分以上非アクティブなセッションを削除
}, 10 * 60 * 1000);
