import { Router } from 'express';
import { env } from '../config/env';

// serverのAPIエンドポイントURL
const SERVER_API_BASE = `${env.mainBackendUrl}/api/admin`;

export const apiMonitorRouter = Router();

/**
 * GET /admin/api/api-monitor/logs
 * API呼び出しログ一覧を取得（serverにプロキシ）
 */
apiMonitorRouter.get('/logs', async (req, res) => {
  try {
    // クエリパラメータを構築
    const params = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });

    const url = `${SERVER_API_BASE}/api-monitor/logs?${params.toString()}`;
    console.log('[API Monitor] Proxying logs request to:', url);
    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
    const data = await response.json() as any;
    console.log('[API Monitor] Logs response:', data.success ? `Success, ${data.data?.logs?.length || 0} logs` : `Failed: ${data.error}`);

    res.json(data);
  } catch (error) {
    console.error('[API Monitor] Error getting logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /admin/api/api-monitor/stats
 * API統計情報を取得（serverにプロキシ）
 */
apiMonitorRouter.get('/stats', async (req, res) => {
  try {
    const serviceParam = req.query.service ? `?service=${req.query.service}` : '';
    const url = `${SERVER_API_BASE}/api-monitor/stats${serviceParam}`;
    console.log('[API Monitor] Proxying stats request to:', url);
    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
    const data = await response.json() as any;
    console.log('[API Monitor] Stats response:', data.success ? `Success, ${data.data?.totalCalls || 0} total calls` : `Failed: ${data.error}`);

    res.json(data);
  } catch (error) {
    console.error('[API Monitor] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /admin/api/api-monitor/rate-limit
 * Twitchの最新レート制限情報を取得（serverにプロキシ）
 */
apiMonitorRouter.get('/rate-limit', async (req, res) => {
  try {
    const url = `${SERVER_API_BASE}/api-tracking/rate-limit`;
    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('[API Monitor] Error getting rate limit:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /admin/api/api-monitor/youtube-quota
 * YouTubeの本日のクォータ使用量を取得（serverにプロキシ）
 */
apiMonitorRouter.get('/youtube-quota', async (req, res) => {
  try {
    const url = `${SERVER_API_BASE}/api-tracking/youtube-quota`;
    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': env.mainApiKey
      }
    });
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('[API Monitor] Error getting YouTube quota:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /admin/api/api-monitor/recent-calls
 * 直近N分間のAPI呼び出し数を取得
 * Note: このエンドポイントはadmin-webから使用されていないため、
 * 必要に応じてserverに追加してプロキシする
 */
apiMonitorRouter.get('/recent-calls', async (req, res) => {
  try {
    const service = req.query.service as 'twitch' | 'youtube' | 'other';
    const minutes = parseInt(req.query.minutes as string) || 60;

    if (!service) {
      return res.status(400).json({
        success: false,
        error: 'service parameter is required',
        timestamp: new Date().toISOString()
      });
    }

    // TODO: serverにエンドポイント追加後、プロキシに変更
    res.json({
      success: true,
      data: {
        service,
        minutes,
        callCount: 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API Monitor] Error getting recent calls:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /admin/api/api-monitor/logs
 * APIログをクリア
 * Note: このエンドポイントはadmin-webから使用されていないため、
 * 必要に応じてserverに追加してプロキシする
 */
apiMonitorRouter.delete('/logs', async (req, res) => {
  try {
    // TODO: serverにエンドポイント追加後、プロキシに変更
    res.json({
      success: true,
      data: { cleared: false, message: 'Not implemented yet' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API Monitor] Error clearing logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});
