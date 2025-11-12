import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const announcementsRouter = Router();

/**
 * GET /api/announcements
 * 有効なお知らせ一覧取得（表示期間内、優先度順）
 */
announcementsRouter.get('/', async (req, res) => {
  try {
    const now = new Date();

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          // 開始日時が未設定 または 開始日時が過去
          { startAt: null },
          { startAt: { lte: now } }
        ],
        AND: [
          // 終了日時が未設定 または 終了日時が未来
          {
            OR: [
              { endAt: null },
              { endAt: { gte: now } }
            ]
          }
        ]
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        link: true,
        linkText: true,
        priority: true,
        startAt: true,
        endAt: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      data: announcements,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Announcements API] Error fetching announcements:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});
