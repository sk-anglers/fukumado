import dotenv from 'dotenv';

dotenv.config();

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  sessionSecret: required(process.env.SESSION_SECRET, 'SESSION_SECRET'),
  enableYoutube: process.env.ENABLE_YOUTUBE === 'true',
  enableNiconico: process.env.ENABLE_NICONICO === 'true',
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
    redirectUri: process.env.TWITCH_REDIRECT_URI
  }
};

export const ensureYouTubeApiKey = (): string =>
  required(env.youtube.apiKey, 'YOUTUBE_API_KEY');

export const ensureYouTubeOAuthConfig = (): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} => ({
  clientId: required(env.youtube.clientId, 'YOUTUBE_CLIENT_ID'),
  clientSecret: required(env.youtube.clientSecret, 'YOUTUBE_CLIENT_SECRET'),
  redirectUri: required(env.youtube.redirectUri, 'YOUTUBE_REDIRECT_URI')
});

export const ensureTwitchOAuthConfig = (): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} => ({
  clientId: required(env.twitch.clientId, 'TWITCH_CLIENT_ID'),
  clientSecret: required(env.twitch.clientSecret, 'TWITCH_CLIENT_SECRET'),
  redirectUri: required(env.twitch.redirectUri, 'TWITCH_REDIRECT_URI')
});
