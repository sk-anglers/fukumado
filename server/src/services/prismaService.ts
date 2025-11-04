/**
 * Prisma Database Service
 * PrismaClientのシングルトンインスタンスを提供
 */

import { PrismaClient } from '@prisma/client';

// PrismaClientシングルトン
let prisma: PrismaClient;

/**
 * PrismaClientインスタンスを取得
 * 開発環境ではホットリロード対応のためglobalにキャッシュ
 */
export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });

    // 開発環境ではホットリロード時にコネクションが増え続けないようにglobalに保存
    if (process.env.NODE_ENV === 'development') {
      (global as any).prisma = prisma;
    }
  }

  return prisma;
};

/**
 * データベース接続を閉じる
 * アプリケーション終了時に呼び出す
 */
export const closePrismaClient = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    console.log('📦 Database connection closed');
  }
};

/**
 * データベース接続をテスト
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = getPrismaClient();
    await client.$connect();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// デフォルトエクスポート
export default getPrismaClient();
