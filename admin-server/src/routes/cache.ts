import { Router, Request, Response } from 'express';

export const cacheRouter = Router();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

/**
 * Redis接続状態とサーバー情報を取得
 * GET /admin/api/cache/info
 */
cacheRouter.get('/info', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/admin/cache/info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Failed to fetch cache info:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

/**
 * キーのリストを取得
 * GET /admin/api/cache/keys?pattern=*&limit=100
 */
cacheRouter.get('/keys', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    if (req.query.pattern) params.append('pattern', req.query.pattern as string);
    if (req.query.limit) params.append('limit', req.query.limit as string);

    const url = `${SERVER_URL}/api/admin/cache/keys?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Failed to fetch cache keys:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

/**
 * 特定のキーの値を取得
 * GET /admin/api/cache/key/:key
 */
cacheRouter.get('/key/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const response = await fetch(`${SERVER_URL}/api/admin/cache/key/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Failed to fetch cache key:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

/**
 * 特定のキーを削除
 * DELETE /admin/api/cache/key/:key
 */
cacheRouter.delete('/key/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const response = await fetch(`${SERVER_URL}/api/admin/cache/key/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Failed to delete cache key:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

/**
 * パターンに一致するキーを一括削除
 * DELETE /admin/api/cache/pattern
 */
cacheRouter.delete('/pattern', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/admin/cache/pattern`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Failed to delete cache pattern:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

/**
 * 全キャッシュをフラッシュ
 * POST /admin/api/cache/flush
 */
cacheRouter.post('/flush', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/admin/cache/flush`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Failed to flush cache:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});
