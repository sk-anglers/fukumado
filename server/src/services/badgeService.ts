import fetch from 'node-fetch';
import { trackedFetch } from '../utils/apiTracker';

interface BadgeVersion {
  id: string;
  image_url_1x: string;
  image_url_2x: string;
  image_url_4x: string;
}

interface BadgeSet {
  set_id: string;
  versions: BadgeVersion[];
}

interface BadgeCache {
  [channelId: string]: {
    [setId: string]: {
      [version: string]: string; // image_url_1x
    };
  };
}

class BadgeService {
  private globalBadges: {
    [setId: string]: {
      [version: string]: string;
    };
  } = {};
  private channelBadges: BadgeCache = {};
  private clientId: string;
  private accessToken: string | null = null;

  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID || '';
  }

  public setAccessToken(token: string): void {
    this.accessToken = token;
  }

  // グローバルバッジを取得
  public async fetchGlobalBadges(): Promise<void> {
    if (!this.accessToken) {
      console.warn('[Badge Service] No access token set, skipping global badges fetch');
      return;
    }

    try {
      const response = await trackedFetch('https://api.twitch.tv/helix/chat/badges/global', {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${this.accessToken}`
        },
        service: 'twitch',
        endpoint: 'GET /chat/badges/global'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch global badges: ${response.status}`);
      }

      const data = await response.json() as { data: BadgeSet[] };

      data.data.forEach((badgeSet) => {
        if (!this.globalBadges[badgeSet.set_id]) {
          this.globalBadges[badgeSet.set_id] = {};
        }
        badgeSet.versions.forEach((version) => {
          this.globalBadges[badgeSet.set_id][version.id] = version.image_url_1x;
        });
      });

      console.log('[Badge Service] Global badges loaded:', Object.keys(this.globalBadges).length, 'sets');
    } catch (error) {
      console.error('[Badge Service] Error fetching global badges:', error);
    }
  }

  // チャンネル固有のバッジを取得
  public async fetchChannelBadges(broadcasterId: string): Promise<void> {
    if (!this.accessToken) {
      console.warn('[Badge Service] No access token set, skipping channel badges fetch');
      return;
    }

    if (this.channelBadges[broadcasterId]) {
      console.log('[Badge Service] Channel badges already cached for:', broadcasterId);
      return;
    }

    try {
      const response = await trackedFetch(
        `https://api.twitch.tv/helix/chat/badges?broadcaster_id=${broadcasterId}`,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${this.accessToken}`
          },
          service: 'twitch',
          endpoint: 'GET /chat/badges (channel)'
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch channel badges: ${response.status}`);
      }

      const data = await response.json() as { data: BadgeSet[] };

      this.channelBadges[broadcasterId] = {};
      data.data.forEach((badgeSet) => {
        if (!this.channelBadges[broadcasterId][badgeSet.set_id]) {
          this.channelBadges[broadcasterId][badgeSet.set_id] = {};
        }
        badgeSet.versions.forEach((version) => {
          this.channelBadges[broadcasterId][badgeSet.set_id][version.id] = version.image_url_1x;
        });
      });

      console.log('[Badge Service] Channel badges loaded for', broadcasterId, ':', Object.keys(this.channelBadges[broadcasterId]).length, 'sets');
    } catch (error) {
      console.error('[Badge Service] Error fetching channel badges:', error);
    }
  }

  // バッジのURLを取得
  public getBadgeUrl(setId: string, version: string, channelId?: string): string | null {
    // チャンネル固有のバッジを優先
    if (channelId && this.channelBadges[channelId]?.[setId]?.[version]) {
      return this.channelBadges[channelId][setId][version];
    }

    // グローバルバッジをチェック
    if (this.globalBadges[setId]?.[version]) {
      return this.globalBadges[setId][version];
    }

    return null;
  }
}

export const badgeService = new BadgeService();
