"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureYouTubeApiKey = exports.env = void 0;
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
    youtube: {
        apiKey: process.env.YOUTUBE_API_KEY,
        clientId: process.env.YOUTUBE_CLIENT_ID,
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET
    },
    twitch: {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET
    }
};
const ensureYouTubeApiKey = () => required(exports.env.youtube.apiKey, 'YOUTUBE_API_KEY');
exports.ensureYouTubeApiKey = ensureYouTubeApiKey;
//# sourceMappingURL=env.js.map