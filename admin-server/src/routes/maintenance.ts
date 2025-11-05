import { Router } from 'express';
import { maintenanceService } from '../services/maintenanceService';
import { ApiResponse, MaintenanceStatus } from '../types';
import { env } from '../config/env';

export const maintenanceRouter = Router();

/**
 * GET /admin/api/maintenance/status
 * メンテナンスモード状態取得
 */
maintenanceRouter.get('/status', async (req, res) => {
  try {
    const status = await maintenanceService.getStatus();

    const response: ApiResponse<MaintenanceStatus> = {
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error getting maintenance status:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/maintenance/enable
 * メンテナンスモード有効化
 */
maintenanceRouter.post('/enable', async (req, res) => {
  try {
    const { message, generateBypass, duration } = req.body;

    if (!message || typeof message !== 'string') {
      const response: ApiResponse = {
        success: false,
        error: 'Message is required',
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    // durationのバリデーション（分単位、0=無期限）
    const maintenanceDuration = typeof duration === 'number' && duration >= 0 ? duration : 0;

    const status = await maintenanceService.enable(
      message,
      generateBypass === true,
      maintenanceDuration
    );

    const response: ApiResponse<MaintenanceStatus> = {
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error enabling maintenance mode:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/maintenance/disable
 * メンテナンスモード無効化
 */
maintenanceRouter.post('/disable', async (req, res) => {
  try {
    await maintenanceService.disable();

    const response: ApiResponse = {
      success: true,
      data: {
        enabled: false,
        disabledAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('[API] Error disabling maintenance mode:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * POST /admin/api/maintenance/migrate-severity
 * security_logs の severity 制約を修正（warn を許可）
 */
maintenanceRouter.post('/migrate-severity', async (req, res) => {
  try {
    console.log('[Admin] Proxying severity migration request to main server...');

    const response = await fetch(`${env.mainBackendUrl}/api/admin/database/migrate-severity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error || 'Migration failed');
    }

    const apiResponse: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(apiResponse);
  } catch (error) {
    console.error('[API] Error running migration:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * POST /admin/api/maintenance/migrate-audit-logs
 * audit_logs テーブルを作成
 */
maintenanceRouter.post('/migrate-audit-logs', async (req, res) => {
  try {
    console.log('[Admin] Proxying audit logs table creation request to main server...');

    const response = await fetch(`${env.mainBackendUrl}/api/admin/database/migrate-audit-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error || 'Migration failed');
    }

    const apiResponse: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(apiResponse);
  } catch (error) {
    console.error('[API] Error running migration:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * POST /admin/api/maintenance/migrate-alerts
 * alerts と alert_settings テーブルを作成
 */
maintenanceRouter.post('/migrate-alerts', async (req, res) => {
  try {
    console.log('[Admin] Proxying alerts table creation request to main server...');

    const response = await fetch(`${env.mainBackendUrl}/api/admin/database/migrate-alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error || 'Migration failed');
    }

    const apiResponse: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(apiResponse);
  } catch (error) {
    console.error('[API] Error running migration:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * GET /admin/api/maintenance/test-error/status
 * エラーテストモードの状態を取得
 */
maintenanceRouter.get('/test-error/status', async (req, res) => {
  try {
    const response = await fetch(`${env.mainBackendUrl}/api/admin/test/error/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;

    const apiResponse: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(apiResponse);
  } catch (error) {
    console.error('[API] Error getting error test status:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * POST /admin/api/maintenance/test-error/enable
 * エラーテストモードを有効化
 */
maintenanceRouter.post('/test-error/enable', async (req, res) => {
  try {
    const response = await fetch(`${env.mainBackendUrl}/api/admin/test/error/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error || 'Failed to enable error test mode');
    }

    const apiResponse: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(apiResponse);
  } catch (error) {
    console.error('[API] Error enabling error test mode:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});

/**
 * POST /admin/api/maintenance/test-error/disable
 * エラーテストモードを無効化
 */
maintenanceRouter.post('/test-error/disable', async (req, res) => {
  try {
    const response = await fetch(`${env.mainBackendUrl}/api/admin/test/error/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': env.mainApiKey
      }
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error || 'Failed to disable error test mode');
    }

    const apiResponse: ApiResponse = {
      success: true,
      data: data.data,
      timestamp: new Date().toISOString()
    };

    res.json(apiResponse);
  } catch (error) {
    console.error('[API] Error disabling error test mode:', error);
    const apiResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(apiResponse);
  }
});
