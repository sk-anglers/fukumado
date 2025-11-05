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
