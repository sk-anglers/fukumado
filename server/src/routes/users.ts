import { Router } from 'express';
import type { Request } from 'express';
import prisma from '../services/prismaService';

export const usersRouter = Router();

/**
 * GET /api/admin/users/sessions
 * 全セッション一覧を取得（管理画面用）
 */
usersRouter.get('/sessions', async (req, res) => {
  try {
    const sessionStore = req.sessionStore;

    // セッションストアから全セッションを取得
    if (sessionStore.all) {
      sessionStore.all((err, sessions) => {
        if (err) {
          console.error('[Users] Error fetching sessions:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch sessions',
            timestamp: new Date().toISOString()
          });
        }

        if (!sessions) {
          return res.json({
            success: true,
            data: {
              sessions: [],
              stats: {
                totalSessions: 0,
                authenticatedSessions: 0,
                youtubeAuthSessions: 0,
                twitchAuthSessions: 0
              }
            },
            timestamp: new Date().toISOString()
          });
        }

        // セッション情報を整形
        const sessionList = Object.entries(sessions).map(([sessionId, sessionData]: [string, any]) => {
          const session = sessionData as Express.SessionData;

          return {
            sessionId,
            authenticated: !!session.googleTokens,
            twitchAuthenticated: !!session.twitchTokens,
            googleUser: session.googleUser ? {
              id: session.googleUser.id,
              email: session.googleUser.email,
              name: session.googleUser.name
            } : null,
            twitchUser: session.twitchUser ? {
              id: session.twitchUser.id,
              login: session.twitchUser.login,
              displayName: session.twitchUser.displayName
            } : null,
            createdAt: session.createdAt || null,
            lastActivity: session.lastActivity || null,
            ipAddress: session.ipAddress || null,
            userAgent: session.userAgent || null
          };
        });

        // 統計情報を計算
        const stats = {
          totalSessions: sessionList.length,
          authenticatedSessions: sessionList.filter(s => s.authenticated).length,
          youtubeAuthSessions: sessionList.filter(s => s.googleUser).length,
          twitchAuthSessions: sessionList.filter(s => s.twitchUser).length
        };

        res.json({
          success: true,
          data: {
            sessions: sessionList,
            stats
          },
          timestamp: new Date().toISOString()
        });
      });
    } else {
      // sessionStore.all が存在しない場合は空のレスポンスを返す
      res.json({
        success: true,
        data: {
          sessions: [],
          stats: {
            totalSessions: 0,
            authenticatedSessions: 0,
            youtubeAuthSessions: 0,
            twitchAuthSessions: 0
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[Users] Error in sessions endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/users/sessions/:sessionId
 * 特定セッションを強制終了
 */
usersRouter.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionStore = req.sessionStore;

    // セッションを削除
    sessionStore.destroy(sessionId, (err) => {
      if (err) {
        console.error(`[Users] Error destroying session ${sessionId}:`, err);
        return res.status(500).json({
          success: false,
          error: 'Failed to destroy session',
          timestamp: new Date().toISOString()
        });
      }

      console.log(`[Users] Session ${sessionId} destroyed by admin`);

      res.json({
        success: true,
        data: {
          sessionId,
          destroyed: true
        },
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('[Users] Error in session delete endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/users/stats
 * ユーザー統計を取得（データベースベース）
 */
usersRouter.get('/stats', async (req, res) => {
  try {
    // データベースから総ユーザー数を取得
    const totalUsers = await prisma.user.count();

    // YouTubeユーザー数を取得
    const youtubeUsers = await prisma.user.count({
      where: {
        youtubeUserId: { not: null }
      }
    });

    // Twitchユーザー数を取得
    const twitchUsers = await prisma.user.count({
      where: {
        twitchUserId: { not: null }
      }
    });

    // アクティブセッション数を取得（現在ログイン中のユーザー）
    let activeUsers = 0;
    const sessionStore = req.sessionStore;

    await new Promise<void>((resolve) => {
      if (sessionStore.all) {
        sessionStore.all((err, sessions) => {
          if (!err && sessions) {
            activeUsers = Object.keys(sessions).length;
          }
          resolve();
        });
      } else {
        resolve();
      }
    });

    // 最近のログイン（過去24時間）をデータベースから取得
    const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
    const recentLoginUsers = await prisma.user.findMany({
      where: {
        lastLoginAt: {
          gte: oneDayAgo
        }
      },
      select: {
        youtubeUserId: true,
        twitchUserId: true,
        displayName: true,
        email: true,
        lastLoginAt: true
      },
      orderBy: {
        lastLoginAt: 'desc'
      },
      take: 10
    });

    // レスポンス形式を既存のフロントエンドに合わせる
    const recentLogins = recentLoginUsers.map(user => ({
      googleUser: user.youtubeUserId ? {
        id: user.youtubeUserId,
        email: user.email,
        name: user.displayName
      } : null,
      twitchUser: user.twitchUserId ? {
        id: user.twitchUserId,
        login: user.displayName,
        displayName: user.displayName
      } : null,
      createdAt: user.lastLoginAt?.toISOString()
    }));

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        youtubeUsers,
        twitchUsers,
        recentLogins
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Users] Error in stats endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
