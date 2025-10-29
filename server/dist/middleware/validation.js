"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBoolean = exports.validateNumberRange = exports.validateEmail = exports.validateUrl = exports.sanitizeString = exports.validateSearchQuery = exports.validateSubscribeRequest = exports.validateChannelList = exports.validatePagination = exports.validateDateRange = exports.validatePlatform = exports.validateUserId = exports.validateChannelId = exports.handleValidationErrors = void 0;
const express_validator_1 = require("express-validator");
/**
 * バリデーション結果をチェックするミドルウェア
 */
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
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
exports.handleValidationErrors = handleValidationErrors;
/**
 * チャンネルID検証ルール
 */
const validateChannelId = () => {
    return (0, express_validator_1.param)('channelId')
        .trim()
        .notEmpty().withMessage('Channel ID is required')
        .isLength({ min: 1, max: 100 }).withMessage('Channel ID must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Channel ID contains invalid characters');
};
exports.validateChannelId = validateChannelId;
/**
 * ユーザーID検証ルール
 */
const validateUserId = () => {
    return (0, express_validator_1.param)('userId')
        .trim()
        .notEmpty().withMessage('User ID is required')
        .isLength({ min: 1, max: 100 }).withMessage('User ID must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9_-]+$/).withMessage('User ID contains invalid characters');
};
exports.validateUserId = validateUserId;
/**
 * プラットフォーム検証ルール
 */
const validatePlatform = (location = 'query') => {
    const validator = location === 'query' ? (0, express_validator_1.query)('platform') : (0, express_validator_1.body)('platform');
    return validator
        .optional()
        .trim()
        .isIn(['youtube', 'twitch']).withMessage('Platform must be either "youtube" or "twitch"');
};
exports.validatePlatform = validatePlatform;
/**
 * 日付検証ルール
 */
const validateDateRange = () => {
    return [
        (0, express_validator_1.query)('startDate')
            .optional()
            .isISO8601().withMessage('Start date must be a valid ISO 8601 date')
            .toDate(),
        (0, express_validator_1.query)('endDate')
            .optional()
            .isISO8601().withMessage('End date must be a valid ISO 8601 date')
            .toDate()
            .custom((endDate, { req }) => {
            if (req.query?.startDate && endDate) {
                const startDate = new Date(req.query.startDate);
                if (endDate < startDate) {
                    throw new Error('End date must be after start date');
                }
            }
            return true;
        })
    ];
};
exports.validateDateRange = validateDateRange;
/**
 * ページネーション検証ルール
 */
const validatePagination = () => {
    return [
        (0, express_validator_1.query)('page')
            .optional()
            .isInt({ min: 1, max: 10000 }).withMessage('Page must be between 1 and 10000')
            .toInt(),
        (0, express_validator_1.query)('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
            .toInt()
    ];
};
exports.validatePagination = validatePagination;
/**
 * チャンネルリスト検証ルール（リクエストボディ）
 */
const validateChannelList = () => {
    return [
        (0, express_validator_1.body)('channels')
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
exports.validateChannelList = validateChannelList;
/**
 * WebSocket購読リクエスト検証ルール
 */
const validateSubscribeRequest = () => {
    return [
        (0, express_validator_1.body)('youtubeChannels')
            .optional()
            .isArray({ max: 200 }).withMessage('YouTube channels must be an array with max 200 items'),
        (0, express_validator_1.body)('twitchChannels')
            .optional()
            .isArray({ max: 200 }).withMessage('Twitch channels must be an array with max 200 items'),
        (0, express_validator_1.body)('sessionId')
            .optional()
            .isString().withMessage('Session ID must be a string')
            .isLength({ max: 200 }).withMessage('Session ID too long')
    ];
};
exports.validateSubscribeRequest = validateSubscribeRequest;
/**
 * 検索クエリ検証ルール
 */
const validateSearchQuery = () => {
    return (0, express_validator_1.query)('q')
        .trim()
        .notEmpty().withMessage('Search query is required')
        .isLength({ min: 1, max: 200 }).withMessage('Search query must be between 1 and 200 characters')
        // SQLインジェクション対策: 危険な文字を拒否
        .matches(/^[^;<>'"\\]+$/).withMessage('Search query contains invalid characters');
};
exports.validateSearchQuery = validateSearchQuery;
/**
 * 汎用的な文字列サニタイゼーション
 */
const sanitizeString = (field, location = 'body') => {
    const validator = location === 'body' ? (0, express_validator_1.body)(field) : (0, express_validator_1.query)(field);
    return validator
        .trim()
        .escape() // HTMLエスケープ
        .isLength({ max: 1000 }).withMessage(`${field} is too long (max 1000 characters)`);
};
exports.sanitizeString = sanitizeString;
/**
 * URL検証ルール
 */
const validateUrl = (field) => {
    return (0, express_validator_1.body)(field)
        .optional()
        .trim()
        .isURL({
        protocols: ['http', 'https'],
        require_protocol: true
    }).withMessage(`${field} must be a valid HTTP/HTTPS URL`)
        .isLength({ max: 2000 }).withMessage(`${field} is too long`);
};
exports.validateUrl = validateUrl;
/**
 * Email検証ルール（将来的な通知機能用）
 */
const validateEmail = (field = 'email') => {
    return (0, express_validator_1.body)(field)
        .trim()
        .isEmail().withMessage('Invalid email address')
        .normalizeEmail()
        .isLength({ max: 200 }).withMessage('Email is too long');
};
exports.validateEmail = validateEmail;
/**
 * 数値範囲検証ルール
 */
const validateNumberRange = (field, min, max, location = 'query') => {
    const validator = location === 'query' ? (0, express_validator_1.query)(field) : (0, express_validator_1.body)(field);
    return validator
        .optional()
        .isInt({ min, max }).withMessage(`${field} must be between ${min} and ${max}`)
        .toInt();
};
exports.validateNumberRange = validateNumberRange;
/**
 * Boolean検証ルール
 */
const validateBoolean = (field, location = 'query') => {
    const validator = location === 'query' ? (0, express_validator_1.query)(field) : (0, express_validator_1.body)(field);
    return validator
        .optional()
        .isBoolean().withMessage(`${field} must be a boolean`)
        .toBoolean();
};
exports.validateBoolean = validateBoolean;
//# sourceMappingURL=validation.js.map