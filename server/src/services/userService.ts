/**
 * User Service
 * ユーザー管理とOAuthトークンの永続化
 */

import prisma from './prismaService';

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

interface TwitchUserInfo {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
}

interface TwitchTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate: number;
}

/**
 * GoogleユーザーをDBに保存または更新
 */
export const upsertGoogleUser = async (
  userInfo: GoogleUserInfo,
  tokens: GoogleTokens
): Promise<void> => {
  try {
    await prisma.user.upsert({
      where: {
        youtubeUserId: userInfo.sub,
      },
      update: {
        displayName: userInfo.name,
        email: userInfo.email,
        avatarUrl: userInfo.picture,
        youtubeAccessToken: tokens.accessToken,
        youtubeRefreshToken: tokens.refreshToken || null,
        youtubeTokenExpiresAt: new Date(tokens.expiryDate),
        lastLoginAt: new Date(),
      },
      create: {
        youtubeUserId: userInfo.sub,
        displayName: userInfo.name,
        email: userInfo.email,
        avatarUrl: userInfo.picture,
        youtubeAccessToken: tokens.accessToken,
        youtubeRefreshToken: tokens.refreshToken || null,
        youtubeTokenExpiresAt: new Date(tokens.expiryDate),
        lastLoginAt: new Date(),
      },
    });

    console.log(`✅ Google user saved to DB: ${userInfo.name} (${userInfo.sub})`);
  } catch (error) {
    console.error('❌ Failed to save Google user to DB:', error);
    throw error;
  }
};

/**
 * TwitchユーザーをDBに保存または更新
 */
export const upsertTwitchUser = async (
  userInfo: TwitchUserInfo,
  tokens: TwitchTokens
): Promise<void> => {
  try {
    await prisma.user.upsert({
      where: {
        twitchUserId: userInfo.id,
      },
      update: {
        displayName: userInfo.display_name,
        avatarUrl: userInfo.profile_image_url,
        twitchAccessToken: tokens.accessToken,
        twitchRefreshToken: tokens.refreshToken || null,
        twitchTokenExpiresAt: new Date(tokens.expiryDate),
        lastLoginAt: new Date(),
      },
      create: {
        twitchUserId: userInfo.id,
        displayName: userInfo.display_name,
        avatarUrl: userInfo.profile_image_url,
        twitchAccessToken: tokens.accessToken,
        twitchRefreshToken: tokens.refreshToken || null,
        twitchTokenExpiresAt: new Date(tokens.expiryDate),
        lastLoginAt: new Date(),
      },
    });

    console.log(`✅ Twitch user saved to DB: ${userInfo.display_name} (${userInfo.id})`);
  } catch (error) {
    console.error('❌ Failed to save Twitch user to DB:', error);
    throw error;
  }
};

/**
 * GoogleユーザーをDBから取得
 */
export const getGoogleUser = async (youtubeUserId: string) => {
  return await prisma.user.findUnique({
    where: { youtubeUserId },
  });
};

/**
 * TwitchユーザーをDBから取得
 */
export const getTwitchUser = async (twitchUserId: string) => {
  return await prisma.user.findUnique({
    where: { twitchUserId },
  });
};

/**
 * GoogleトークンをDBから取得
 */
export const getGoogleTokens = async (youtubeUserId: string): Promise<GoogleTokens | null> => {
  const user = await prisma.user.findUnique({
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

/**
 * TwitchトークンをDBから取得
 */
export const getTwitchTokens = async (twitchUserId: string): Promise<TwitchTokens | null> => {
  const user = await prisma.user.findUnique({
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

export default {
  upsertGoogleUser,
  upsertTwitchUser,
  getGoogleUser,
  getTwitchUser,
  getGoogleTokens,
  getTwitchTokens,
};
