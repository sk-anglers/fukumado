import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const helpRouter = Router();

/**
 * GET /api/help/articles
 * 公開済みヘルプ記事一覧取得（カテゴリ別、表示順でソート）
 */
helpRouter.get('/articles', async (req, res) => {
  try {
    const { category } = req.query;

    const where: any = {
      isPublished: true
    };

    // カテゴリフィルター
    if (category && typeof category === 'string') {
      where.category = category;
    }

    const articles = await prisma.helpArticle.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        category: true,
        title: true,
        order: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: articles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Help API] Error fetching articles:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/help/articles/:id
 * ヘルプ記事詳細取得
 */
helpRouter.get('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const articleId = BigInt(id);

    const article = await prisma.helpArticle.findUnique({
      where: {
        id: articleId,
        isPublished: true
      }
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: article,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Help API] Error fetching article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/help/articles/:id/view
 * 閲覧カウント増加
 */
helpRouter.post('/articles/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const articleId = BigInt(id);

    const article = await prisma.helpArticle.update({
      where: {
        id: articleId
      },
      data: {
        viewCount: {
          increment: 1
        }
      },
      select: {
        id: true,
        viewCount: true
      }
    });

    res.json({
      success: true,
      data: article,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Help API] Error incrementing view count:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});
