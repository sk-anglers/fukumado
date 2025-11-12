import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const helpRouter = Router();

/**
 * GET /api/admin/help/articles
 * 全ヘルプ記事一覧取得（公開/非公開含む）
 */
helpRouter.get('/articles', async (req, res) => {
  try {
    const { category } = req.query;

    const where: any = {};

    // カテゴリフィルター
    if (category && typeof category === 'string') {
      where.category = category;
    }

    const articles = await prisma.helpArticle.findMany({
      where,
      orderBy: [
        { isPublished: 'desc' },
        { order: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: articles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Help API] Error fetching articles:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/help/articles/:id
 * ヘルプ記事詳細取得
 */
helpRouter.get('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const articleId = BigInt(id);

    const article = await prisma.helpArticle.findUnique({
      where: { id: articleId }
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
    console.error('[Admin Help API] Error fetching article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/help/articles
 * ヘルプ記事作成
 */
helpRouter.post('/articles', async (req, res) => {
  try {
    const { category, title, content, order, isPublished } = req.body;

    // バリデーション
    if (!category || !title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Category, title, and content are required',
        timestamp: new Date().toISOString()
      });
    }

    const article = await prisma.helpArticle.create({
      data: {
        category,
        title,
        content,
        order: order || 0,
        isPublished: isPublished || false
      }
    });

    res.json({
      success: true,
      data: article,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Help API] Error creating article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/admin/help/articles/:id
 * ヘルプ記事更新
 */
helpRouter.put('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const articleId = BigInt(id);
    const { category, title, content, order, isPublished } = req.body;

    // バリデーション
    if (!category || !title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Category, title, and content are required',
        timestamp: new Date().toISOString()
      });
    }

    const article = await prisma.helpArticle.update({
      where: { id: articleId },
      data: {
        category,
        title,
        content,
        order: order !== undefined ? order : 0,
        isPublished: isPublished !== undefined ? isPublished : false
      }
    });

    res.json({
      success: true,
      data: article,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Help API] Error updating article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/help/articles/:id
 * ヘルプ記事削除
 */
helpRouter.delete('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const articleId = BigInt(id);

    await prisma.helpArticle.delete({
      where: { id: articleId }
    });

    res.json({
      success: true,
      message: 'Article deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Help API] Error deleting article:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/admin/help/articles/:id/publish
 * 公開/非公開切替
 */
helpRouter.put('/articles/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const articleId = BigInt(id);
    const { isPublished } = req.body;

    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isPublished must be a boolean',
        timestamp: new Date().toISOString()
      });
    }

    const article = await prisma.helpArticle.update({
      where: { id: articleId },
      data: { isPublished }
    });

    res.json({
      success: true,
      data: article,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Help API] Error toggling publish status:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
});
