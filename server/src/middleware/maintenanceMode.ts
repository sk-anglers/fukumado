import { Request, Response, NextFunction } from 'express';
import { maintenanceService } from '../services/maintenanceService';

/**
 * メンテナンスモードミドルウェア
 * メンテナンスフラグをチェックし、有効な場合は503を返す
 * バイパストークンを持っている場合は通過を許可
 */
export const maintenanceMode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // ヘルスチェックエンドポイントは常に許可
    if (req.path === '/health') {
      return next();
    }

    // 管理APIエンドポイントは常に許可
    if (req.path.startsWith('/api/admin/maintenance')) {
      return next();
    }

    // バイパストークンをチェック（クエリパラメータ）
    const bypassToken = req.query.bypass as string | undefined;
    if (bypassToken) {
      const isValid = await maintenanceService.isValidBypassToken(bypassToken);
      if (isValid) {
        console.log(`[Maintenance] Bypass token valid: ${bypassToken}`);
        return next();
      }
    }

    // メンテナンスモードが有効かチェック
    const status = await maintenanceService.getStatus();
    if (!status.enabled) {
      // メンテナンスモード無効
      return next();
    }

    // メンテナンスモード中 - 503エラーを返す
    res.status(503).json({
      error: 'Service Unavailable',
      message: status.message || 'サービスは現在メンテナンス中です。しばらくお待ちください。',
      enabledAt: status.enabledAt,
      duration: status.duration,
      scheduledEndAt: status.scheduledEndAt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Maintenance] Error checking maintenance mode:', error);
    // エラー時はメンテナンスモードを無効として扱う（サービス継続優先）
    next();
  }
};
