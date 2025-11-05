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
    let sessionList: any[] = [];
    let stats = {
      totalSessions: 0,
      authenticatedSessions: 0,
      youtubeAuthSessions: 0,
      twitchAuthSessions: 0
    };

    // Prismaでセッションを取得（エラーハンドリング付き）
    try {
      const now = new Date();
      const sessions = await prisma.session.findMany({
        where: {
          expire: {
            gt: now
          }
        },
        orderBy: {
          expire: 'desc'
        }
      });

      sessionList = sessions
        .filter((session) => {
          if (!session.sess || typeof session.sess !== 'object') {
            console.warn(`[Users] Invalid session data for sid: ${session.sid}`);
            return false;
          }
          return true;
        })
        .map((session) => {
          const sessionData = session.sess as any;

          return {
            sessionId: session.sid,
            authenticated: !!sessionData?.googleTokens,
            twitchAuthenticated: !!sessionData?.twitchTokens,
            googleUser: sessionData?.googleUser ? {
              id: sessionData.googleUser.id,
              email: sessionData.googleUser.email,
              name: sessionData.googleUser.name
            } : null,
            twitchUser: sessionData?.twitchUser ? {
              id: sessionData.twitchUser.id,
              login: sessionData.twitchUser.login,
              displayName: sessionData.twitchUser.displayName
            } : null,
            createdAt: sessionData?.createdAt || null,
            lastActivity: sessionData?.lastActivity || null,
            ipAddress: sessionData?.ipAddress || null,
            userAgent: sessionData?.userAgent || null
          };
        });

      stats = {
        totalSessions: sessionList.length,
        authenticatedSessions: sessionList.filter(s => s.authenticated).length,
        youtubeAuthSessions: sessionList.filter(s => s.googleUser).length,
        twitchAuthSessions: sessionList.filter(s => s.twitchUser).length
      };
    } catch (sessionError) {
      console.error('[Users] Error fetching sessions from Prisma:', sessionError);
      // セッションテーブルにアクセスできない場合は空の結果を返す
      sessionList = [];
      stats = {
        totalSessions: 0,
        authenticatedSessions: 0,
        youtubeAuthSessions: 0,
        twitchAuthSessions: 0
      };
    }

    res.json({
      success: true,
      data: {
        sessions: sessionList,
        stats
      },
      timestamp: new Date().toISOString()
    });
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

    // YouTubeユーザー数（YouTubeは未実装なので0固定）
    const youtubeUsers = 0;

    // Twitchユーザー数を取得
    const twitchUsers = await prisma.user.count({
      where: {
        twitchUserId: { not: null }
      }
    });

    // アクティブセッション数を取得（エラーハンドリング付き）
    let activeUsers = 0;
    try {
      const now = new Date();
      activeUsers = await prisma.session.count({
        where: {
          expire: {
            gt: now
          }
        }
      });
    } catch (sessionError) {
      console.warn('[Users] Could not count sessions from Prisma:', sessionError);
      activeUsers = 0;
    }

    // 最近のログイン（過去24時間）をデータベースから取得
    // YouTubeは未実装なので、Twitchユーザーのみ取得
    const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
    const recentLoginUsers = await prisma.user.findMany({
      where: {
        lastLoginAt: {
          gte: oneDayAgo
        },
        twitchUserId: {
          not: null
        }
      },
      select: {
        twitchUserId: true,
        displayName: true,
        lastLoginAt: true
      },
      orderBy: {
        lastLoginAt: 'desc'
      },
      take: 10
    });

    // レスポンス形式を既存のフロントエンドに合わせる
    const recentLogins = recentLoginUsers.map(user => ({
      googleUser: null, // YouTubeは未実装
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
