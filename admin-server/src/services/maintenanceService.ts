import { MaintenanceStatus } from '../types';
import { env } from '../config/env';

class MaintenanceService {
  /**
   * メンテナンスモードを有効化
   * 本サービスのAPIを呼び出す
   */
  async enable(message: string, generateBypass: boolean = false, duration: number = 0): Promise<MaintenanceStatus> {
    try {
      const response = await fetch(`${env.mainBackendUrl}/api/admin/maintenance/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': env.mainApiKey
        },
        body: JSON.stringify({ message, generateBypass, duration })
      });

      if (!response.ok) {
        throw new Error('Failed to enable maintenance mode');
      }

      const result = await response.json() as { success: boolean; data: MaintenanceStatus };

      if (!result.success || !result.data) {
        throw new Error('Invalid response from main service');
      }

      console.log('[Maintenance] Maintenance mode enabled via main service');
      return result.data;
    } catch (error) {
      console.error('[Maintenance] Error enabling maintenance mode:', error);
      throw error;
    }
  }

  /**
   * メンテナンスモードを無効化
   * 本サービスのAPIを呼び出す
   */
  async disable(): Promise<void> {
    try {
      const response = await fetch(`${env.mainBackendUrl}/api/admin/maintenance/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': env.mainApiKey
        }
      });

      if (!response.ok) {
        throw new Error('Failed to disable maintenance mode');
      }

      console.log('[Maintenance] Maintenance mode disabled via main service');
    } catch (error) {
      console.error('[Maintenance] Error disabling maintenance mode:', error);
      throw error;
    }
  }

  /**
   * メンテナンスモードの状態を取得
   * 本サービスのAPIを呼び出す
   */
  async getStatus(): Promise<MaintenanceStatus> {
    try {
      const response = await fetch(`${env.mainBackendUrl}/api/admin/maintenance/status`, {
        headers: {
          'X-Admin-API-Key': env.mainApiKey
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get maintenance status');
      }

      const result = await response.json() as { success: boolean; data: MaintenanceStatus };

      if (!result.success || !result.data) {
        throw new Error('Invalid response from main service');
      }

      return result.data;
    } catch (error) {
      console.error('[Maintenance] Error getting status:', error);
      // エラー時はメンテナンスモード無効として返す
      return {
        enabled: false,
        message: ''
      };
    }
  }
}

// シングルトンインスタンス
export const maintenanceService = new MaintenanceService();
