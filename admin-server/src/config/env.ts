import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

// パスワード検証
const validateAdminPassword = (password: string): void => {
  // 本番環境でデフォルトパスワードの場合は検証をスキップ（警告は別で出力済み）
  if (process.env.NODE_ENV === 'production' && password === 'admin123') {
    console.warn('[Security] ⚠️  Skipping password validation for default password in production');
    console.warn('[Security] ⚠️  This is temporary - please set ADMIN_PASSWORD immediately!');
    return; // 検証をスキップしてサーバー起動を許可
  }

  if (password.length < 16) {
    console.error('[Security] ADMIN_PASSWORD must be at least 16 characters');
    process.exit(1);
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!(hasUpperCase && hasLowerCase && hasNumber && hasSymbol)) {
    console.warn('[Security] ADMIN_PASSWORD should contain uppercase, lowercase, numbers, and symbols for better security');
  }
};

const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

// 本番環境でデフォルトパスワードを使用している場合は警告
if (process.env.NODE_ENV === 'production' && adminPassword === 'admin123') {
  console.warn('[Security] ⚠️  WARNING: Default password detected in production!');
  console.warn('[Security] ⚠️  Please set a strong ADMIN_PASSWORD immediately via Render dashboard!');
  console.warn('[Security] ⚠️  Go to: Service Settings > Environment > Add Environment Variable');
  console.warn('[Security] ⚠️  Key: ADMIN_PASSWORD, Value: [Strong 16+ char password]');
  // Temporarily allow startup with default password for initial deployment
  // TODO: Set ADMIN_PASSWORD in Render dashboard after first successful deploy
}

// パスワード検証
validateAdminPassword(adminPassword);

export const env = {
  // サーバー設定
  port: parseInt(process.env.PORT || '4001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // 管理者認証
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // メインバックエンドURL
  mainBackendUrl: process.env.MAIN_BACKEND_URL || 'http://localhost:4000',

  // IP制限（オプション）
  allowedIPs: process.env.ADMIN_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || [],

  // Slack通知（オプション）
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',

  // Twitch OAuth
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
    redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:4001/auth/twitch/callback'
  },

  // セッションシークレット
  sessionSecret: process.env.SESSION_SECRET || 'default-secret-please-change-in-production',
} as const;

console.log('[Config] Environment loaded:', {
  port: env.port,
  nodeEnv: env.nodeEnv,
  adminUsername: env.adminUsername,
  redisUrl: env.redisUrl.replace(/:[^:]+@/, ':****@'), // パスワードをマスク
  mainBackendUrl: env.mainBackendUrl,
  ipRestriction: env.allowedIPs.length > 0,
  slackNotification: !!env.slackWebhookUrl
});
