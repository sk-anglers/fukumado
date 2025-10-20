"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const env_1 = require("./config/env");
const youtube_1 = require("./routes/youtube");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/youtube', youtube_1.youtubeRouter);
app.listen(env_1.env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://localhost:${env_1.env.port}`);
});
//# sourceMappingURL=index.js.map