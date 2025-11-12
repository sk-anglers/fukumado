import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const announcementsRouter = Router();

/**
 * GET /api/admin/announcements
 * 全お知らせ一覧取得（有効/無効含む）
 */
announcementsRouter.get('/', async (req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: [
        { isActive: 'desc' },
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: announcements,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Announcements API] Error fetching announcements:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/announcements/:id
 * お知らせ詳細取得
 */
announcementsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const announcementId = BigInt(id);

    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId }
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: 'Announcement not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: announcement,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Announcements API] Error fetching announcement:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/announcements
 * お知らせ作成
 */
announcementsRouter.post('/', async (req, res) => {
  try {
    const { type, title, content, link, linkText, priority, isActive, startAt, endAt } = req.body;

    // バリデーション
    if (!type || !title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Type, title, and content are required',
        timestamp: new Date().toISOString()
      });
    }

    const announcement = await prisma.announcement.create({
      data: {
        type,
        title,
        content,
        link: link || null,
        linkText: linkText || null,
        priority: priority || 0,
        isActive: isActive !== undefined ? isActive : true,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null
      }
    });

    res.json({
      success: true,
      data: announcement,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Announcements API] Error creating announcement:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/admin/announcements/:id
 * お知らせ更新
 */
announcementsRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const announcementId = BigInt(id);
    const { type, title, content, link, linkText, priority, isActive, startAt, endAt } = req.body;

    // バリデーション
    if (!type || !title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Type, title, and content are required',
        timestamp: new Date().toISOString()
      });
    }

    const announcement = await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        type,
        title,
        content,
        link: link || null,
        linkText: linkText || null,
        priority: priority !== undefined ? priority : 0,
        isActive: isActive !== undefined ? isActive : true,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null
      }
    });

    res.json({
      success: true,
      data: announcement,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Announcements API] Error updating announcement:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/announcements/:id
 * お知らせ削除
 */
announcementsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const announcementId = BigInt(id);

    await prisma.announcement.delete({
      where: { id: announcementId }
    });

    res.json({
      success: true,
      message: 'Announcement deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Announcements API] Error deleting announcement:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/admin/announcements/:id/toggle
 * 有効/無効切替
 */
announcementsRouter.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const announcementId = BigInt(id);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean',
        timestamp: new Date().toISOString()
      });
    }

    const announcement = await prisma.announcement.update({
      where: { id: announcementId },
      data: { isActive }
    });

    res.json({
      success: true,
      data: announcement,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Announcements API] Error toggling active status:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});
