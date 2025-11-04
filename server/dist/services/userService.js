"use strict";
/**
 * User Service
 * ユーザー管理とOAuthトークンの永続化
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTwitchTokens = exports.getGoogleTokens = exports.getTwitchUser = exports.getGoogleUser = exports.upsertTwitchUser = exports.upsertGoogleUser = void 0;
const prismaService_1 = __importDefault(require("./prismaService"));
/**
 * GoogleユーザーをDBに保存または更新
 */
const upsertGoogleUser = async (userInfo, tokens) => {
    try {
        await prismaService_1.default.user.upsert({
            where: {
                youtubeUserId: userInfo.sub,
            },
            update: {
                displayName: userInfo.name || userInfo.email || userInfo.sub,
                email: userInfo.email || null,
                avatarUrl: userInfo.picture || null,
                youtubeAccessToken: tokens.accessToken,
                youtubeRefreshToken: tokens.refreshToken || null,
                youtubeTokenExpiresAt: new Date(tokens.expiryDate),
                lastLoginAt: new Date(),
            },
            create: {
                youtubeUserId: userInfo.sub,
                displayName: userInfo.name || userInfo.email || userInfo.sub,
                email: userInfo.email || null,
                avatarUrl: userInfo.picture || null,
                youtubeAccessToken: tokens.accessToken,
                youtubeRefreshToken: tokens.refreshToken || null,
                youtubeTokenExpiresAt: new Date(tokens.expiryDate),
                lastLoginAt: new Date(),
            },
        });
        console.log(`✅ Google user saved to DB: ${userInfo.name} (${userInfo.sub})`);
    }
    catch (error) {
        console.error('❌ Failed to save Google user to DB:', error);
        throw error;
    }
};
exports.upsertGoogleUser = upsertGoogleUser;
/**
 * TwitchユーザーをDBに保存または更新
 */
const upsertTwitchUser = async (userInfo, tokens) => {
    try {
        await prismaService_1.default.user.upsert({
            where: {
                twitchUserId: userInfo.id,
            },
            update: {
                displayName: userInfo.display_name,
                avatarUrl: userInfo.profile_image_url || null,
                twitchAccessToken: tokens.accessToken,
                twitchRefreshToken: tokens.refreshToken || null,
                twitchTokenExpiresAt: new Date(tokens.expiryDate),
                lastLoginAt: new Date(),
            },
            create: {
                twitchUserId: userInfo.id,
                displayName: userInfo.display_name,
                avatarUrl: userInfo.profile_image_url || null,
                twitchAccessToken: tokens.accessToken,
                twitchRefreshToken: tokens.refreshToken || null,
                twitchTokenExpiresAt: new Date(tokens.expiryDate),
                lastLoginAt: new Date(),
            },
        });
        console.log(`✅ Twitch user saved to DB: ${userInfo.display_name} (${userInfo.id})`);
    }
    catch (error) {
        console.error('❌ Failed to save Twitch user to DB:', error);
        throw error;
    }
};
exports.upsertTwitchUser = upsertTwitchUser;
/**
 * GoogleユーザーをDBから取得
 */
const getGoogleUser = async (youtubeUserId) => {
    return await prismaService_1.default.user.findUnique({
        where: { youtubeUserId },
    });
};
exports.getGoogleUser = getGoogleUser;
/**
 * TwitchユーザーをDBから取得
 */
const getTwitchUser = async (twitchUserId) => {
    return await prismaService_1.default.user.findUnique({
        where: { twitchUserId },
    });
};
exports.getTwitchUser = getTwitchUser;
/**
 * GoogleトークンをDBから取得
 */
const getGoogleTokens = async (youtubeUserId) => {
    const user = await prismaService_1.default.user.findUnique({
        where: { youtubeUserId },
        select: {
            youtubeAccessToken: true,
            youtubeRefreshToken: true,
            youtubeTokenExpiresAt: true,
        },
    });
    if (!user || !user.youtubeAccessToken || !user.youtubeTokenExpiresAt) {
        return null;
    }
    return {
        accessToken: user.youtubeAccessToken,
        refreshToken: user.youtubeRefreshToken || undefined,
        expiryDate: user.youtubeTokenExpiresAt.getTime(),
    };
};
exports.getGoogleTokens = getGoogleTokens;
/**
 * TwitchトークンをDBから取得
 */
const getTwitchTokens = async (twitchUserId) => {
    const user = await prismaService_1.default.user.findUnique({
        where: { twitchUserId },
        select: {
            twitchAccessToken: true,
            twitchRefreshToken: true,
            twitchTokenExpiresAt: true,
        },
    });
    if (!user || !user.twitchAccessToken || !user.twitchTokenExpiresAt) {
        return null;
    }
    return {
        accessToken: user.twitchAccessToken,
        refreshToken: user.twitchRefreshToken || undefined,
        expiryDate: user.twitchTokenExpiresAt.getTime(),
    };
};
exports.getTwitchTokens = getTwitchTokens;
exports.default = {
    upsertGoogleUser: exports.upsertGoogleUser,
    upsertTwitchUser: exports.upsertTwitchUser,
    getGoogleUser: exports.getGoogleUser,
    getTwitchUser: exports.getTwitchUser,
    getGoogleTokens: exports.getGoogleTokens,
    getTwitchTokens: exports.getTwitchTokens,
};
//# sourceMappingURL=userService.js.map