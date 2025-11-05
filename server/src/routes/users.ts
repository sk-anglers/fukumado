import { Router } from 'express';
import type { Request } from 'express';
import prisma from '../services/prismaService';

export const usersRouter = Router();

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

/**
 * GET /api/admin/users/search
 * ユーザー検索
 */
usersRouter.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
      return res.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });
    }

    // メールアドレス、displayName、YouTubeユーザーID、TwitchユーザーIDで検索
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { youtubeUserId: { contains: query, mode: 'insensitive' } },
          { twitchUserId: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        youtubeUserId: true,
        twitchUserId: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // 最大50件
    });

    res.json({
      success: true,
      data: users,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Users] Error in search endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * ユーザー削除
 */
usersRouter.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        youtubeUserId: true,
        twitchUserId: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // ユーザーを削除（関連データはCascadeで自動削除される）
    await prisma.user.delete({
      where: { id: userId }
    });

    console.log(`[Users] User deleted by admin:`, {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      youtubeUserId: user.youtubeUserId,
      twitchUserId: user.twitchUserId
    });

    res.json({
      success: true,
      data: {
        userId: user.id,
        displayName: user.displayName
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Users] Error in delete endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
