"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTwitchOAuthConfig = exports.ensureYouTubeOAuthConfig = exports.ensureYouTubeApiKey = exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const required = (value, name) => {
    if (!value) {
        throw new Error(`Environment variable ${name} is required`);
    }
    return value;
};
exports.env = {
    port: Number(process.env.PORT ?? 4000),
    sessionSecret: required(process.env.SESSION_SECRET, 'SESSION_SECRET'),
    databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL'),
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    adminFrontendUrl: process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:5174',
    apiUrl: process.env.API_URL ?? 'http://localhost:4000',
    adminApiKey: process.env.ADMIN_API_KEY ?? 'dev-admin-key-change-in-production',
    enableYoutube: process.env.ENABLE_YOUTUBE === 'true',
    enableNiconico: process.env.ENABLE_NICONICO === 'true',
    enableEventSub: process.env.ENABLE_EVENTSUB === 'true',
    redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DB ?? 0)
    },
    youtube: {
        apiKey: process.env.YOUTUBE_API_KEY,
        clientId: process.env.YOUTUBE_CLIENT_ID,
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
        redirectUri: process.env.YOUTUBE_REDIRECT_URI
    },
    twitch: {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET,
        redirectUri: process.env.TWITCH_REDIRECT_URI,
        webhookUrl: process.env.TWITCH_WEBHOOK_URL,
        webhookSecret: process.env.TWITCH_WEBHOOK_SECRET
    }
};
const ensureYouTubeApiKey = () => required(exports.env.youtube.apiKey, 'YOUTUBE_API_KEY');
exports.ensureYouTubeApiKey = ensureYouTubeApiKey;
const ensureYouTubeOAuthConfig = () => ({
    clientId: required(exports.env.youtube.clientId, 'YOUTUBE_CLIENT_ID'),
    clientSecret: required(exports.env.youtube.clientSecret, 'YOUTUBE_CLIENT_SECRET'),
    redirectUri: required(exports.env.youtube.redirectUri, 'YOUTUBE_REDIRECT_URI')
});
exports.ensureYouTubeOAuthConfig = ensureYouTubeOAuthConfig;
const ensureTwitchOAuthConfig = () => ({
    clientId: required(exports.env.twitch.clientId, 'TWITCH_CLIENT_ID'),
    clientSecret: required(exports.env.twitch.clientSecret, 'TWITCH_CLIENT_SECRET'),
    redirectUri: required(exports.env.twitch.redirectUri, 'TWITCH_REDIRECT_URI')
});
exports.ensureTwitchOAuthConfig = ensureTwitchOAuthConfig;
//# sourceMappingURL=env.js.map