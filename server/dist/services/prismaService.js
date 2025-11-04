"use strict";
/**
 * Prisma Database Service
 * PrismaClientのシングルトンインスタンスを提供
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDatabaseConnection = exports.closePrismaClient = exports.getPrismaClient = void 0;
const client_1 = require("@prisma/client");
// PrismaClientシングルトン
let prisma;
/**
 * PrismaClientインスタンスを取得
 * 開発環境ではホットリロード対応のためglobalにキャッシュ
 */
const getPrismaClient = () => {
    if (!prisma) {
        prisma = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development'
                ? ['query', 'info', 'warn', 'error']
                : ['error'],
        });
        // 開発環境ではホットリロード時にコネクションが増え続けないようにglobalに保存
        if (process.env.NODE_ENV === 'development') {
            global.prisma = prisma;
        }
    }
    return prisma;
};
exports.getPrismaClient = getPrismaClient;
/**
 * データベース接続を閉じる
 * アプリケーション終了時に呼び出す
 */
const closePrismaClient = async () => {
    if (prisma) {
        await prisma.$disconnect();
        console.log('📦 Database connection closed');
    }
};
exports.closePrismaClient = closePrismaClient;
/**
 * データベース接続をテスト
 */
const testDatabaseConnection = async () => {
    try {
        const client = (0, exports.getPrismaClient)();
        await client.$connect();
        console.log('✅ Database connection successful');
        return true;
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
};
exports.testDatabaseConnection = testDatabaseConnection;
// デフォルトエクスポート
exports.default = (0, exports.getPrismaClient)();
//# sourceMappingURL=prismaService.js.map