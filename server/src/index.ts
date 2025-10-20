import express from 'express';
import session from 'express-session';
import { env } from './config/env';
import { authRouter } from './routes/auth';
import { youtubeRouter } from './routes/youtube';
import { twitchRouter } from './routes/twitch';

const app = express();

app.use(express.json());
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);

app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api/twitch', twitchRouter);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${env.port}`);
});
