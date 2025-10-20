"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureYouTubeOAuthConfig = exports.ensureYouTubeApiKey = exports.env = void 0;
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
    youtube: {
        apiKey: process.env.YOUTUBE_API_KEY,
        clientId: process.env.YOUTUBE_CLIENT_ID,
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
        redirectUri: process.env.YOUTUBE_REDIRECT_URI
    },
    twitch: {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET
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
//# sourceMappingURL=env.js.map