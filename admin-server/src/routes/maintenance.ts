import { Router } from 'express';
import { maintenanceService } from '../services/maintenanceService';
import { ApiResponse, MaintenanceStatus } from '../types';

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
