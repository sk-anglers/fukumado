import express from 'express';
import { env } from './config/env';
import { youtubeRouter } from './routes/youtube';

const app = express();

app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/youtube', youtubeRouter);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${env.port}`);
});
