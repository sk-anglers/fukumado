"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
exports.usersRouter = (0, express_1.Router)();
/**
 * GET /api/admin/users/sessions
 * 全セッション一覧を取得（管理画面用）
 */
exports.usersRouter.get('/sessions', async (req, res) => {
    try {
        const sessionStore = req.sessionStore;
        // セッションストアから全セッションを取得
        sessionStore.all?.((err, sessions) => {
            if (err) {
                console.error('[Users] Error fetching sessions:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch sessions',
                    timestamp: new Date().toISOString()
                });
            }
            if (!sessions) {
                return res.json({
                    success: true,
                    data: {
                        sessions: [],
                        stats: {
                            totalSessions: 0,
                            authenticatedSessions: 0,
                            youtubeAuthSessions: 0,
                            twitchAuthSessions: 0
                        }
                    },
                    timestamp: new Date().toISOString()
                });
            }
            // セッション情報を整形
            const sessionList = Object.entries(sessions).map(([sessionId, sessionData]) => {
                const session = sessionData;
                return {
                    sessionId,
                    authenticated: !!session.googleTokens,
                    twitchAuthenticated: !!session.twitchTokens,
                    googleUser: session.googleUser ? {
                        id: session.googleUser.id,
                        email: session.googleUser.email,
                        name: session.googleUser.name
                    } : null,
                    twitchUser: session.twitchUser ? {
                        id: session.twitchUser.id,
                        login: session.twitchUser.login,
                        displayName: session.twitchUser.displayName
                    } : null,
                    createdAt: session.createdAt || null,
                    lastActivity: session.lastActivity || null,
                    ipAddress: session.ipAddress || null,
                    userAgent: session.userAgent || null
                };
            });
            // 統計情報を計算
            const stats = {
                totalSessions: sessionList.length,
                authenticatedSessions: sessionList.filter(s => s.authenticated).length,
                youtubeAuthSessions: sessionList.filter(s => s.googleUser).length,
                twitchAuthSessions: sessionList.filter(s => s.twitchUser).length
            };
            res.json({
                success: true,
                data: {
                    sessions: sessionList,
                    stats
                },
                timestamp: new Date().toISOString()
            });
        });
    }
    catch (error) {
        console.error('[Users] Error in sessions endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * DELETE /api/admin/users/sessions/:sessionId
 * 特定セッションを強制終了
 */
exports.usersRouter.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const sessionStore = req.sessionStore;
        // セッションを削除
        sessionStore.destroy(sessionId, (err) => {
            if (err) {
                console.error(`[Users] Error destroying session ${sessionId}:`, err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to destroy session',
                    timestamp: new Date().toISOString()
                });
            }
            console.log(`[Users] Session ${sessionId} destroyed by admin`);
            res.json({
                success: true,
                data: {
                    sessionId,
                    destroyed: true
                },
                timestamp: new Date().toISOString()
            });
        });
    }
    catch (error) {
        console.error('[Users] Error in session delete endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/admin/users/stats
 * ユーザー統計を取得
 */
exports.usersRouter.get('/stats', async (req, res) => {
    try {
        const sessionStore = req.sessionStore;
        sessionStore.all?.((err, sessions) => {
            if (err || !sessions) {
                return res.json({
                    success: true,
                    data: {
                        totalUsers: 0,
                        activeUsers: 0,
                        youtubeUsers: 0,
                        twitchUsers: 0,
                        recentLogins: []
                    },
                    timestamp: new Date().toISOString()
                });
            }
            const sessionList = Object.entries(sessions).map(([sessionId, sessionData]) => {
                const session = sessionData;
                return {
                    sessionId,
                    googleUser: session.googleUser,
                    twitchUser: session.twitchUser,
                    lastActivity: session.lastActivity,
                    createdAt: session.createdAt
                };
            });
            // ユニークユーザーをカウント
            const googleUserIds = new Set();
            const twitchUserIds = new Set();
            sessionList.forEach(s => {
                if (s.googleUser?.id)
                    googleUserIds.add(s.googleUser.id);
                if (s.twitchUser?.id)
                    twitchUserIds.add(s.twitchUser.id);
            });
            // 最近のログイン（過去24時間）
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            const recentLogins = sessionList
                .filter(s => {
                const createdAt = s.createdAt ? new Date(s.createdAt).getTime() : 0;
                return createdAt > oneDayAgo;
            })
                .sort((a, b) => {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bTime - aTime;
            })
                .slice(0, 10)
                .map(s => ({
                googleUser: s.googleUser,
                twitchUser: s.twitchUser,
                createdAt: s.createdAt
            }));
            res.json({
                success: true,
                data: {
                    totalUsers: googleUserIds.size + twitchUserIds.size,
                    activeUsers: sessionList.length,
                    youtubeUsers: googleUserIds.size,
                    twitchUsers: twitchUserIds.size,
                    recentLogins
                },
                timestamp: new Date().toISOString()
            });
        });
    }
    catch (error) {
        console.error('[Users] Error in stats endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
//# sourceMappingURL=users.js.map