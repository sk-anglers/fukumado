import { Router } from 'express';
import { redisClient } from '../services/redisClient';

export const healthRouter = Router();

/**
 * GET /admin/api/health
 * ヘルスチェックエンドポイント（認証不要）
 */
healthRouter.get('/', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redisClient.isReady() ? 'connected' : 'disconnected'
  };

  res.json(health);
});
