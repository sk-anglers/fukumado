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
