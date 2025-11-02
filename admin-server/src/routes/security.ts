import { Router } from 'express';
import { securityMonitor } from '../services/securityMonitor';
import { ApiResponse, SecurityMetrics } from '../types';
import { env } from '../config/env';

export const securityRouter = Router();

/**
 * 本サービスのAPIを呼び出すヘルパー関数
 */
async function fetchMainServiceAPI<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const url = `${env.mainBackendUrl}${endpoint}`;
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey,
        ...options?.headers
      },
      ...options
    });

    if (!response.ok) {
      console.error(`[Main Service API] Error fetching ${endpoint}: ${response.statusText}`);
      return null;
    }

    return await response.json() as T;
  } catch (error) {
    console.error(`[Main Service API] Failed to fetch ${endpoint}:`, error);
    return null;
  }
}

/**
 * GET /admin/api/security/metrics
 * セキュリティメトリクス取得
 */
securityRouter.get('/metrics', async (req, res) => {
  try {
    const metrics = await securityMonitor.getSecurityMetrics();

    const response: ApiResponse<SecurityMetrics> = {
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting security metrics:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/security/block-ip
 * IPをブロック
 */
securityRouter.post('/block-ip', async (req, res) => {
  try {
    const { ip, permanent, reason } = req.body;

    if (!ip || typeof ip !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'IP address is required',
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    await securityMonitor.blockIP(
      ip,
      permanent === true,
      reason || 'Blocked by administrator'
    );

    const response: ApiResponse = {
      success: true,
      data: {
        ip,
        blocked: true,
        permanent: permanent === true,
        blockedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error blocking IP:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/security/blocked-ips
 * ブロックされているIPリストを取得（本サービスから）
 */
securityRouter.get('/blocked-ips', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        blockedIPs: Array<{ ip: string; until: Date; reason: string }>;
        count: number;
      };
      timestamp: string;
    }>('/api/admin/security/blocked-ips');

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch blocked IPs from main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    res.json(data);
  } catch (error) {
    console.error('[API] Error getting blocked IPs:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/security/unblock-ip
 * IPブロック解除（本サービスにproxy）
 */
securityRouter.post('/unblock-ip', async (req, res) => {
  try {
    const { ip } = req.body;

    if (!ip || typeof ip !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'IP address is required',
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        ip: string;
        wasBlocked: boolean;
        message: string;
      };
      timestamp: string;
    }>('/api/admin/security/unblock-ip', {
      method: 'POST',
      body: JSON.stringify({ ip })
    });

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to unblock IP on main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    res.json(data);
  } catch (error) {
    console.error('[API] Error unblocking IP:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/security/clear-all-blocks
 * すべてのIPブロックを解除（本サービスにproxy）
 */
securityRouter.post('/clear-all-blocks', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        message: string;
      };
      timestamp: string;
    }>('/api/admin/security/clear-all-blocks', {
      method: 'POST',
      body: JSON.stringify({})
    });

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to clear all blocks on main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    res.json(data);
  } catch (error) {
    console.error('[API] Error clearing all blocks:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/security/whitelisted-ips
 * ホワイトリストに登録されているIPリスト取得（本サービスから）
 */
securityRouter.get('/whitelisted-ips', async (req, res) => {
  try {
    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        whitelistedIPs: string[];
        count: number;
      };
      timestamp: string;
    }>('/api/admin/security/whitelisted-ips');

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to fetch whitelisted IPs from main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    res.json(data);
  } catch (error) {
    console.error('[API] Error getting whitelisted IPs:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/security/whitelist-ip
 * IPをホワイトリストに追加（本サービスにproxy）
 */
securityRouter.post('/whitelist-ip', async (req, res) => {
  try {
    const { ip } = req.body;

    if (!ip || typeof ip !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'IP address is required',
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        ip: string;
        whitelisted: boolean;
        message: string;
      };
      timestamp: string;
    }>('/api/admin/security/whitelist-ip', {
      method: 'POST',
      body: JSON.stringify({ ip })
    });

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to whitelist IP on main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    res.json(data);
  } catch (error) {
    console.error('[API] Error whitelisting IP:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/security/remove-from-whitelist
 * IPをホワイトリストから削除（本サービスにproxy）
 */
securityRouter.post('/remove-from-whitelist', async (req, res) => {
  try {
    const { ip } = req.body;

    if (!ip || typeof ip !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'IP address is required',
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    const data = await fetchMainServiceAPI<{
      success: boolean;
      data: {
        ip: string;
        wasWhitelisted: boolean;
        message: string;
      };
      timestamp: string;
    }>('/api/admin/security/remove-from-whitelist', {
      method: 'POST',
      body: JSON.stringify({ ip })
    });

    if (!data) {
      const response: ApiResponse = {
        success: false,
        error: 'Failed to remove IP from whitelist on main service',
        timestamp: new Date().toISOString()
      };
      return res.status(500).json(response);
    }

    res.json(data);
  } catch (error) {
    console.error('[API] Error removing IP from whitelist:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/security/main-service/stats
 * 本サービスのセキュリティ統計を取得
 */
securityRouter.get('/main-service/stats', async (req, res) => {
  try {
    const stats = await fetchMainServiceAPI('/api/security/stats');

    const response: ApiResponse = {
      success: stats !== null,
      data: stats || undefined,
      error: stats === null ? 'Failed to fetch main service security stats' : undefined,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting main service stats:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/security/main-service/health
 * 本サービスのセキュリティヘルスチェック
 */
securityRouter.get('/main-service/health', async (req, res) => {
  try {
    const health = await fetchMainServiceAPI('/api/security/health');

    const response: ApiResponse = {
      success: health !== null,
      data: health || undefined,
      error: health === null ? 'Failed to fetch main service health' : undefined,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting main service health:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/security/main-service/alerts
 * 本サービスの異常検知アラートを取得
 */
securityRouter.get('/main-service/alerts', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const alerts = await fetchMainServiceAPI(`/api/security/alerts?limit=${limit}`);

    const response: ApiResponse = {
      success: alerts !== null,
      data: alerts || undefined,
      error: alerts === null ? 'Failed to fetch main service alerts' : undefined,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting main service alerts:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/security/main-service/sessions
 * 本サービスのセッション統計を取得
 */
securityRouter.get('/main-service/sessions', async (req, res) => {
  try {
    const sessions = await fetchMainServiceAPI('/api/security/sessions');

    const response: ApiResponse = {
      success: sessions !== null,
      data: sessions || undefined,
      error: sessions === null ? 'Failed to fetch main service sessions' : undefined,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting main service sessions:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/security/main-service/websocket
 * 本サービスのWebSocket統計を取得
 */
securityRouter.get('/main-service/websocket', async (req, res) => {
  try {
    const websocket = await fetchMainServiceAPI('/api/security/websocket-connections');

    const response: ApiResponse = {
      success: websocket !== null,
      data: websocket || undefined,
      error: websocket === null ? 'Failed to fetch main service websocket stats' : undefined,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting main service websocket stats:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /admin/api/security/main-service/summary
 * 本サービスのセキュリティサマリーを取得
 */
securityRouter.get('/main-service/summary', async (req, res) => {
  try {
    const summary = await fetchMainServiceAPI('/api/security/report/summary');

    const response: ApiResponse = {
      success: summary !== null,
      data: summary || undefined,
      error: summary === null ? 'Failed to fetch main service summary' : undefined,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting main service summary:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});
