import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const announcementsRouter = Router();

// BigIntをStringに変換するヘルパー関数
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      serialized[key] = serializeBigInt(obj[key]);
    }
    return serialized;
  }
  return obj;
};

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
        forceDisplayVersion: true,
        startAt: true,
        endAt: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      data: serializeBigInt(announcements),
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

/**
 * PUT /api/announcements/:id/force-display
 * 強制表示（forceDisplayVersionをインクリメント）
 * 全ユーザーの画面に再度お知らせを表示
 */
announcementsRouter.put('/:id/force-display', async (req, res) => {
  try {
    const { id } = req.params;
    const announcementId = BigInt(id);

    // 現在のお知らせを取得
    const current = await prisma.announcement.findUnique({
      where: { id: announcementId }
    });

    if (!current) {
      return res.status(404).json({
        success: false,
        error: 'Announcement not found',
        timestamp: new Date().toISOString()
      });
    }

    // forceDisplayVersionをインクリメント
    const announcement = await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        forceDisplayVersion: current.forceDisplayVersion + 1
      }
    });

    res.json({
      success: true,
      data: serializeBigInt(announcement),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Announcements API] Error forcing display:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});
