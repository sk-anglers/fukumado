import { Router } from 'express';
import { SecurityLogService } from '../services/securityLogService';

const securityLogService = new SecurityLogService();

export const logsRouter = Router();

/**
 * GET /api/admin/logs/access
 * アクセスログ取得
 */
logsRouter.get('/access', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const method = req.query.method as string | undefined;
    const statusCode = req.query.statusCode ? parseInt(req.query.statusCode as string) : undefined;
    const searchPath = req.query.searchPath as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await securityLogService.getAccessLogs({
      limit,
      offset,
      method,
      statusCode,
      searchPath,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Logs] Error getting access logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/logs/error
 * エラーログ取得
 */
logsRouter.get('/error', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const level = req.query.level as 'error' | 'warn' | undefined;
    const searchMessage = req.query.searchMessage as string | undefined;

    const result = await securityLogService.getErrorLogs({
      limit,
      offset,
      level,
      searchMessage
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Logs] Error getting error logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/logs/security
 * セキュリティログ取得
 */
logsRouter.get('/security', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as 'block' | 'rate_limit' | 'anomaly' | 'auth_failed' | 'websocket' | undefined;
    const searchIp = req.query.searchIp as string | undefined;

    const result = await securityLogService.getSecurityLogs({
      limit,
      offset,
      type,
      searchIp
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Logs] Error getting security logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/logs/summary
 * ログサマリー取得
 */
logsRouter.get('/summary', async (req, res) => {
  try {
    const summary = await securityLogService.getSummary();

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Logs] Error getting log summary:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/logs/:type
 * ログクリア
 */
logsRouter.delete('/:type', async (req, res) => {
  try {
    const type = req.params.type as 'access' | 'error' | 'security' | 'all';

    if (!['access', 'error', 'security', 'all'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid log type',
        timestamp: new Date().toISOString()
      });
    }

    await securityLogService.clearLogs(type);
    console.log(`[Logs] Cleared ${type} logs`);

    res.json({
      success: true,
      data: { type, cleared: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Logs] Error clearing logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
