import { body, query, param, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * バリデーション結果をチェックするミドルウェア
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.warn('[Validation] Validation failed:', {
      ip: req.ip,
      path: req.path,
      errors: errors.array()
    });

    res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }

  next();
};

/**
 * チャンネルID検証ルール
 */
export const validateChannelId = (): ValidationChain => {
  return param('channelId')
    .trim()
    .notEmpty().withMessage('Channel ID is required')
    .isLength({ min: 1, max: 100 }).withMessage('Channel ID must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Channel ID contains invalid characters');
};

/**
 * ユーザーID検証ルール
 */
export const validateUserId = (): ValidationChain => {
  return param('userId')
    .trim()
    .notEmpty().withMessage('User ID is required')
    .isLength({ min: 1, max: 100 }).withMessage('User ID must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('User ID contains invalid characters');
};

/**
 * プラットフォーム検証ルール
 */
export const validatePlatform = (location: 'query' | 'body' = 'query'): ValidationChain => {
  const validator = location === 'query' ? query('platform') : body('platform');

  return validator
    .optional()
    .trim()
    .isIn(['youtube', 'twitch']).withMessage('Platform must be either "youtube" or "twitch"');
};

/**
 * 日付検証ルール
 */
export const validateDateRange = (): ValidationChain[] => {
  return [
    query('startDate')
      .optional()
      .isISO8601().withMessage('Start date must be a valid ISO 8601 date')
      .toDate(),

    query('endDate')
      .optional()
      .isISO8601().withMessage('End date must be a valid ISO 8601 date')
      .toDate()
      .custom((endDate, { req }) => {
        if (req.query?.startDate && endDate) {
          const startDate = new Date(req.query.startDate as string);
          if (endDate < startDate) {
            throw new Error('End date must be after start date');
          }
        }
        return true;
      })
  ];
};

/**
 * ページネーション検証ルール
 */
export const validatePagination = (): ValidationChain[] => {
  return [
    query('page')
      .optional()
      .isInt({ min: 1, max: 10000 }).withMessage('Page must be between 1 and 10000')
      .toInt(),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
      .toInt()
  ];
};

/**
 * チャンネルリスト検証ルール（リクエストボディ）
 */
export const validateChannelList = (): ValidationChain[] => {
  return [
    body('channels')
      .isArray({ min: 0, max: 200 }).withMessage('Channels must be an array with max 200 items')
      .custom((channels) => {
        // 各チャンネルIDが文字列で、適切な形式かチェック
        if (!Array.isArray(channels)) {
          return false;
        }

        for (const channel of channels) {
          if (typeof channel !== 'string') {
            throw new Error('All channel IDs must be strings');
          }
          if (channel.length > 100) {
            throw new Error('Channel ID too long (max 100 characters)');
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(channel)) {
            throw new Error('Channel ID contains invalid characters');
          }
        }

        return true;
      })
  ];
};

/**
 * WebSocket購読リクエスト検証ルール
 */
export const validateSubscribeRequest = (): ValidationChain[] => {
  return [
    body('youtubeChannels')
      .optional()
      .isArray({ max: 200 }).withMessage('YouTube channels must be an array with max 200 items'),

    body('twitchChannels')
      .optional()
      .isArray({ max: 200 }).withMessage('Twitch channels must be an array with max 200 items'),

    body('sessionId')
      .optional()
      .isString().withMessage('Session ID must be a string')
      .isLength({ max: 200 }).withMessage('Session ID too long')
  ];
};

/**
 * 検索クエリ検証ルール
 */
export const validateSearchQuery = (): ValidationChain => {
  return query('q')
    .trim()
    .notEmpty().withMessage('Search query is required')
    .isLength({ min: 1, max: 200 }).withMessage('Search query must be between 1 and 200 characters')
    // SQLインジェクション対策: 危険な文字を拒否
    .matches(/^[^;<>'"\\]+$/).withMessage('Search query contains invalid characters');
};

/**
 * 汎用的な文字列サニタイゼーション
 */
export const sanitizeString = (field: string, location: 'body' | 'query' = 'body'): ValidationChain => {
  const validator = location === 'body' ? body(field) : query(field);

  return validator
    .trim()
    .escape() // HTMLエスケープ
    .isLength({ max: 1000 }).withMessage(`${field} is too long (max 1000 characters)`);
};

/**
 * URL検証ルール
 */
export const validateUrl = (field: string): ValidationChain => {
  return body(field)
    .optional()
    .trim()
    .isURL({
      protocols: ['http', 'https'],
      require_protocol: true
    }).withMessage(`${field} must be a valid HTTP/HTTPS URL`)
    .isLength({ max: 2000 }).withMessage(`${field} is too long`);
};

/**
 * Email検証ルール（将来的な通知機能用）
 */
export const validateEmail = (field: string = 'email'): ValidationChain => {
  return body(field)
    .trim()
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
    .isLength({ max: 200 }).withMessage('Email is too long');
};

/**
 * 数値範囲検証ルール
 */
export const validateNumberRange = (
  field: string,
  min: number,
  max: number,
  location: 'query' | 'body' = 'query'
): ValidationChain => {
  const validator = location === 'query' ? query(field) : body(field);

  return validator
    .optional()
    .isInt({ min, max }).withMessage(`${field} must be between ${min} and ${max}`)
    .toInt();
};

/**
 * Boolean検証ルール
 */
export const validateBoolean = (field: string, location: 'query' | 'body' = 'query'): ValidationChain => {
  const validator = location === 'query' ? query(field) : body(field);

  return validator
    .optional()
    .isBoolean().withMessage(`${field} must be a boolean`)
    .toBoolean();
};
