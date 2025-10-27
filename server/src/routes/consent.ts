import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import { consentManager } from '../services/consentManager';

export const consentRouter = Router();

/**
 * POST /api/consent
 * 同意を記録
 */
consentRouter.post(
  '/',
  [
    body('consents').isArray().withMessage('Consents must be an array'),
    body('consents.*.type')
      .isIn(['terms', 'privacy', 'essential_cookies', 'analytics_cookies', 'marketing_cookies'])
      .withMessage('Invalid consent type'),
    body('consents.*.granted').isBoolean().withMessage('Granted must be a boolean'),
    handleValidationErrors
  ],
  (req: Request, res: Response) => {
    try {
      const sessionId = (req as any).session?.id || 'unknown';
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';
      const { consents } = req.body;

      const record = consentManager.recordConsent(
        sessionId,
        ipAddress,
        userAgent,
        consents
      );

      console.log('[Consent API] Consent recorded:', {
        sessionId: sessionId.substring(0, 8),
        consentTypes: consents.map((c: any) => c.type).join(', ')
      });

      res.status(201).json({
        success: true,
        message: 'Consent recorded successfully',
        record: {
          id: record.id,
          timestamp: record.timestamp,
          consents: record.consents
        }
      });
    } catch (error) {
      console.error('[Consent API] Error recording consent:', error);
      res.status(500).json({
        error: 'Failed to record consent'
      });
    }
  }
);

/**
 * GET /api/consent/status
 * セッションの同意状態を取得
 */
consentRouter.get('/status', (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session?.id || 'unknown';
    const status = consentManager.getConsentStatus(sessionId);
    const needs = consentManager.needsConsent(sessionId);

    res.json({
      status,
      needs,
      currentVersions: consentManager.getCurrentVersions()
    });
  } catch (error) {
    console.error('[Consent API] Error fetching consent status:', error);
    res.status(500).json({
      error: 'Failed to fetch consent status'
    });
  }
});

/**
 * POST /api/consent/revoke
 * 同意を撤回
 */
consentRouter.post(
  '/revoke',
  [
    body('types').isArray().withMessage('Types must be an array'),
    body('types.*')
      .isIn(['terms', 'privacy', 'essential_cookies', 'analytics_cookies', 'marketing_cookies'])
      .withMessage('Invalid consent type'),
    handleValidationErrors
  ],
  (req: Request, res: Response) => {
    try {
      const sessionId = (req as any).session?.id || 'unknown';
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';
      const { types } = req.body;

      const record = consentManager.revokeConsent(
        sessionId,
        ipAddress,
        userAgent,
        types
      );

      console.log('[Consent API] Consent revoked:', {
        sessionId: sessionId.substring(0, 8),
        types: types.join(', ')
      });

      res.json({
        success: true,
        message: 'Consent revoked successfully',
        record: {
          id: record.id,
          timestamp: record.timestamp,
          consents: record.consents
        }
      });
    } catch (error) {
      console.error('[Consent API] Error revoking consent:', error);
      res.status(500).json({
        error: 'Failed to revoke consent'
      });
    }
  }
);

/**
 * GET /api/consent/export
 * GDPR準拠のデータエクスポート
 */
consentRouter.get('/export', (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session?.id || 'unknown';
    const exportData = consentManager.exportConsentData(sessionId);

    console.log('[Consent API] Data exported:', {
      sessionId: sessionId.substring(0, 8),
      recordCount: exportData.records.length
    });

    res.json(exportData);
  } catch (error) {
    console.error('[Consent API] Error exporting data:', error);
    res.status(500).json({
      error: 'Failed to export consent data'
    });
  }
});

/**
 * GET /api/consent/history
 * セッションの全同意記録を取得
 */
consentRouter.get('/history', (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session?.id || 'unknown';
    const history = consentManager.getConsentHistory(sessionId);

    res.json({
      sessionId,
      total: history.length,
      history
    });
  } catch (error) {
    console.error('[Consent API] Error fetching history:', error);
    res.status(500).json({
      error: 'Failed to fetch consent history'
    });
  }
});

/**
 * GET /api/consent/stats
 * 同意統計情報を取得（管理者用）
 */
consentRouter.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = consentManager.getStats();

    res.json({
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    console.error('[Consent API] Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch consent statistics'
    });
  }
});
