import { Router } from 'express';
import { ApiResponse } from '../types';
import { env } from '../config/env';

export const servicesRouter = Router();

/**
 * サービス情報の型定義
 */
interface ServiceStatus {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  uptime?: number;
  cpu?: number;
  memory?: number;
  lastChecked: string;
  error?: string;
}

/**
 * サービスのヘルスチェックを実行
 */
async function checkServiceHealth(name: string, url: string): Promise<ServiceStatus> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒タイムアウト

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        name,
        url,
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json() as {
      uptime?: number;
      cpu?: number;
      memory?: number;
    };

    return {
      name,
      url,
      status: 'healthy',
      responseTime,
      uptime: data.uptime || undefined,
      cpu: data.cpu || undefined,
      memory: data.memory || undefined,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      name,
      url,
      status: 'unhealthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * GET /admin/api/services/status
 * 全サービスの状態を取得
 */
servicesRouter.get('/status', async (req, res) => {
  try {
    // 監視対象のサービス一覧
    const services = [
      {
        name: 'Main Server',
        url: `${env.mainBackendUrl}/health`
      },
      {
        name: 'Admin Server',
        url: 'http://localhost:3001/admin/api/health' // 自分自身
      },
      {
        name: 'Web (Frontend)',
        url: 'https://fukumado.jp'
      },
      {
        name: 'Admin Web (Frontend)',
        url: 'https://admin.fukumado.jp'
      }
    ];

    // 全サービスのヘルスチェックを並列実行
    const statusChecks = await Promise.all(
      services.map(service => checkServiceHealth(service.name, service.url))
    );

    // 全体のサマリー
    const summary = {
      total: statusChecks.length,
      healthy: statusChecks.filter(s => s.status === 'healthy').length,
      unhealthy: statusChecks.filter(s => s.status === 'unhealthy').length,
      unknown: statusChecks.filter(s => s.status === 'unknown').length
    };

    const response: ApiResponse = {
      success: true,
      data: {
        services: statusChecks,
        summary
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[Services] Error getting service status:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/services/:serviceName/restart
 * サービスを再起動（将来実装）
 */
servicesRouter.post('/:serviceName/restart', async (req, res) => {
  try {
    const { serviceName } = req.params;

    // TODO: Render API統合
    // 現時点では未実装

    const response: ApiResponse = {
      success: false,
      error: 'Service restart is not implemented yet. Please use Render dashboard.',
      timestamp: new Date().toISOString()
    };

    res.status(501).json(response);
  } catch (error) {
    console.error('[Services] Error restarting service:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});
