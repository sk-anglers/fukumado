"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userPreferencesRouter = void 0;
const express_1 = require("express");
const prismaService_1 = __importDefault(require("../services/prismaService"));
exports.userPreferencesRouter = (0, express_1.Router)();
/**
 * GET /api/user/preferences
 * ユーザー設定を取得
 */
exports.userPreferencesRouter.get('/', async (req, res) => {
    try {
        // セッションからユーザーIDを取得
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                timestamp: new Date().toISOString()
            });
        }
        // ユーザー設定を取得
        let preferences = await prismaService_1.default.userPreference.findUnique({
            where: { userId }
        });
        // 設定が存在しない場合はデフォルト値を返す
        if (!preferences) {
            const defaultPreferences = {
                defaultLayout: 'grid_2x2',
                savedLayouts: [],
                notificationSettings: { enabled: true, sound: true },
                preferences: {}
            };
            res.json({
                success: true,
                data: defaultPreferences,
                timestamp: new Date().toISOString()
            });
            return;
        }
        res.json({
            success: true,
            data: {
                defaultLayout: preferences.defaultLayout,
                savedLayouts: preferences.savedLayouts,
                notificationSettings: preferences.notificationSettings,
                preferences: preferences.preferences
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[UserPreferences] Error getting preferences:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * PUT /api/user/preferences
 * ユーザー設定を更新
 */
exports.userPreferencesRouter.put('/', async (req, res) => {
    try {
        // セッションからユーザーIDを取得
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                timestamp: new Date().toISOString()
            });
        }
        const { defaultLayout, savedLayouts, notificationSettings, preferences } = req.body;
        // バリデーション
        if (defaultLayout && typeof defaultLayout !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid defaultLayout',
                timestamp: new Date().toISOString()
            });
        }
        // ユーザー設定を更新（upsert: 存在しない場合は作成）
        const updatedPreferences = await prismaService_1.default.userPreference.upsert({
            where: { userId },
            create: {
                userId,
                defaultLayout: defaultLayout || 'grid_2x2',
                savedLayouts: savedLayouts || [],
                notificationSettings: notificationSettings || { enabled: true, sound: true },
                preferences: preferences || {}
            },
            update: {
                ...(defaultLayout && { defaultLayout }),
                ...(savedLayouts && { savedLayouts }),
                ...(notificationSettings && { notificationSettings }),
                ...(preferences && { preferences })
            }
        });
        res.json({
            success: true,
            data: {
                defaultLayout: updatedPreferences.defaultLayout,
                savedLayouts: updatedPreferences.savedLayouts,
                notificationSettings: updatedPreferences.notificationSettings,
                preferences: updatedPreferences.preferences
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('[UserPreferences] Error updating preferences:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
});
//# sourceMappingURL=userPreferences.js.map