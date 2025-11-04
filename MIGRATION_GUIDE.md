# ふくまど！ データベースマイグレーションガイド

**バージョン**: 1.0.0
**作成日**: 2025-11-04
**対象期間**: 4週間

---

## 📋 目次

1. [概要](#概要)
2. [準備](#準備)
3. [Week 1: 環境構築とコアテーブル](#week-1-環境構築とコアテーブル)
4. [Week 2: エモート・検索機能](#week-2-エモート検索機能)
5. [Week 3: アナリティクス・PV](#week-3-アナリティクスpv)
6. [Week 4: セキュリティ・最適化](#week-4-セキュリティ最適化)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### 目的

現在のRedis中心アーキテクチャから、PostgreSQL + Redisハイブリッドアーキテクチャへ移行します。

### 期待される効果

| 項目 | Before | After | 改善率 |
|-----|--------|-------|--------|
| API呼び出し | 33,000回/月 | 4,110回/月 | **87.5%削減** |
| 検索速度 | 200-300ms | 5-10ms | **95%高速化** |
| データ損失リスク | 高 | なし | **100%改善** |

### マイグレーション方針

1. **無停止移行**: デュアルライト方式で段階的に移行
2. **ロールバック可能**: 各フェーズで問題発生時は即座に戻せる
3. **パフォーマンス監視**: 各ステップでベンチマーク実施

---

## 準備

### 1. Render PostgreSQL データベース作成

#### ステップ1: Renderダッシュボードにアクセス

```bash
1. https://dashboard.render.com にログイン
2. 左上の "New +" → "PostgreSQL" をクリック
```

#### ステップ2: データベース設定

```
Name: fukumado-db
Database: fukumado
User: fukumado_user
Region: Singapore (Asia Northeast)
PostgreSQL Version: 15
Plan: Starter ($7/month)
```

#### ステップ3: 接続情報を取得

データベース作成後、以下の情報が表示されます：

```
Internal Database URL: postgresql://fukumado_user:xxxxx@dpg-xxxxx/fukumado
External Database URL: postgresql://fukumado_user:xxxxx@hostname.render.com:5432/fukumado
```

**External Database URL をコピー**してください。

---

### 2. 環境変数設定

#### ローカル開発環境

```bash
# .env ファイルを作成
cp .env.example .env

# DATABASE_URL を設定
DATABASE_URL="postgresql://fukumado_user:password@hostname.render.com:5432/fukumado"
```

#### Render環境

```bash
# render.yaml に追加
services:
  - type: web
    name: fukumado-server
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: fukumado-db
          property: connectionString
```

---

### 3. Prisma セットアップ

#### ステップ1: Prismaインストール

```bash
cd server
npm install prisma @prisma/client --save
```

#### ステップ2: Prisma初期化確認

```bash
# prisma/schema.prisma が存在することを確認
ls prisma/schema.prisma
```

#### ステップ3: Prisma Client生成

```bash
npx prisma generate
```

#### ステップ4: マイグレーション実行

```bash
# ローカル環境でテスト
npx prisma migrate dev --name init

# 本番環境に適用
npx prisma migrate deploy
```

---

### 4. スキーマ確認

#### 方法1: Prisma Studio（推奨）

```bash
npx prisma studio
```

ブラウザで http://localhost:5555 が開き、テーブル構造を確認できます。

#### 方法2: psqlコマンド

```bash
psql $DATABASE_URL

# テーブル一覧
\dt

# テーブル構造確認
\d users
\d channels

# 終了
\q
```

---

## Week 1: 環境構築とコアテーブル

### 目標

- ✅ PostgreSQL環境構築
- ✅ users, channels, followed_channels テーブル実装
- ✅ OAuth認証時のDB保存

---

### Day 1-2: 環境構築

#### タスク

```bash
# 1. Render PostgreSQL作成（上記「準備」参照）
# 2. schema.sql 実行
psql $DATABASE_URL < schema.sql

# 3. Prismaセットアップ
cd server
npm install prisma @prisma/client
npx prisma generate
npx prisma migrate dev --name init

# 4. 接続テスト
npx prisma studio
```

#### 動作確認

```typescript
// server/src/test-db.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Database connected:', result);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
```

```bash
npx tsx src/test-db.ts
```

---

### Day 3-4: Prisma Client統合

#### タスク

**ファイル作成: `server/src/db/client.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

// シングルトンインスタンス
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
```

**使用例**:

```typescript
import { prisma } from './db/client';

// ユーザー作成
const user = await prisma.user.create({
  data: {
    displayName: 'Test User',
    twitchUserId: '12345',
  },
});

// ユーザー検索
const user = await prisma.user.findUnique({
  where: { twitchUserId: '12345' },
});
```

---

### Day 5-7: usersテーブル実装

#### タスク1: OAuth認証時のDB保存

**修正ファイル: `server/src/routes/auth.ts`**

```typescript
import { prisma } from '../db/client';

// Twitch OAuth コールバック
router.get('/twitch/callback', async (req, res) => {
  // ... 既存のOAuth処理 ...

  // ✅ DBに保存（新規追加）
  try {
    const user = await prisma.user.upsert({
      where: { twitchUserId: twitchUser.id },
      update: {
        displayName: twitchUser.display_name,
        avatarUrl: twitchUser.profile_image_url,
        twitchAccessToken: accessToken,
        twitchRefreshToken: refreshToken,
        twitchTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        lastLoginAt: new Date(),
      },
      create: {
        twitchUserId: twitchUser.id,
        displayName: twitchUser.display_name,
        avatarUrl: twitchUser.profile_image_url,
        twitchAccessToken: accessToken,
        twitchRefreshToken: refreshToken,
        twitchTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    console.log('✅ User saved to DB:', user.id);
  } catch (error) {
    console.error('❌ Failed to save user:', error);
    // エラーでも処理は継続（認証は成功している）
  }

  // ... 既存の処理 ...
});
```

#### タスク2: トークン自動更新

**修正ファイル: `server/src/services/twitchAppAuth.ts`**

```typescript
import { prisma } from '../db/client';

async function refreshAccessToken(userId: string): Promise<string> {
  // DBからリフレッシュトークンを取得
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twitchRefreshToken: true },
  });

  if (!user?.twitchRefreshToken) {
    throw new Error('No refresh token found');
  }

  // トークン更新API呼び出し
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    // ...
  });

  const data = await response.json();

  // DBを更新
  await prisma.user.update({
    where: { id: userId },
    data: {
      twitchAccessToken: data.access_token,
      twitchRefreshToken: data.refresh_token,
      twitchTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}
```

---

### Day 5-7: channelsテーブル実装

#### タスク: フォローリスト取得時にDB保存

**修正ファイル: `server/src/routes/twitch.ts`**

```typescript
import { prisma } from '../db/client';

// フォローリスト取得
router.get('/api/twitch/followed-channels', async (req, res) => {
  // ... 既存のAPI呼び出し ...

  const channels = await twitchService.getFollowedChannels(userId, accessToken);

  // ✅ DBに保存（バックグラウンドで実行）
  saveChannelsToDatabase(userId, channels).catch(error => {
    console.error('Failed to save channels:', error);
  });

  res.json(channels);
});

async function saveChannelsToDatabase(userId: string, channels: any[]) {
  for (const channel of channels) {
    // チャンネル情報を保存
    await prisma.channel.upsert({
      where: {
        platform_channelId: {
          platform: 'twitch',
          channelId: channel.id,
        },
      },
      update: {
        displayName: channel.display_name,
        username: channel.login,
        avatarUrl: channel.profile_image_url,
        followerCount: channel.follower_count || 0,
        lastAccessedAt: new Date(),
      },
      create: {
        platform: 'twitch',
        channelId: channel.id,
        displayName: channel.display_name,
        username: channel.login,
        avatarUrl: channel.profile_image_url,
        followerCount: channel.follower_count || 0,
      },
    });

    // フォロー関係を保存
    await prisma.followedChannel.upsert({
      where: {
        userId_platform_channelId: {
          userId,
          platform: 'twitch',
          channelId: channel.id,
        },
      },
      update: {},
      create: {
        userId,
        platform: 'twitch',
        channelId: channel.id,
      },
    });
  }
}
```

---

### Week 1 完了チェックリスト

- [ ] Render PostgreSQL作成完了
- [ ] schema.sql実行成功
- [ ] Prismaセットアップ完了
- [ ] usersテーブルにデータ保存確認
- [ ] channelsテーブルにデータ保存確認
- [ ] followed_channelsテーブルにデータ保存確認
- [ ] OAuth認証〜DB保存までの一連のフロー動作確認

---

## Week 2: エモート・検索機能

### 目標

- ✅ emotes, badges テーブル実装
- ✅ グローバルエモート同期
- ✅ チャンネル検索のDB移行

---

### Day 8-10: エモートのDB移行

#### タスク1: グローバルエモート同期

**新規ファイル: `server/src/services/dataSyncService.ts`**

```typescript
import { prisma } from '../db/client';
import { twitchService } from './twitchService';

export class DataSyncService {
  /**
   * グローバルエモートを同期
   */
  async syncGlobalEmotes(): Promise<void> {
    console.log('[DataSync] Syncing global emotes...');

    const emotes = await twitchService.getGlobalEmotes();

    for (const emote of emotes) {
      await prisma.emote.upsert({
        where: {
          platform_emoteId: {
            platform: 'twitch',
            emoteId: emote.id,
          },
        },
        update: {
          emoteCode: emote.name,
          imageUrl1x: emote.images.url_1x,
          imageUrl2x: emote.images.url_2x,
          imageUrl4x: emote.images.url_4x,
          lastSyncedAt: new Date(),
        },
        create: {
          platform: 'twitch',
          emoteId: emote.id,
          emoteCode: emote.name,
          scope: 'global',
          imageUrl1x: emote.images.url_1x,
          imageUrl2x: emote.images.url_2x,
          imageUrl4x: emote.images.url_4x,
        },
      });
    }

    console.log(`[DataSync] Synced ${emotes.length} global emotes`);
  }

  /**
   * チャンネルエモートを同期
   */
  async syncChannelEmotes(channelId: string): Promise<void> {
    const emotes = await twitchService.getChannelEmotes(channelId);

    for (const emote of emotes) {
      await prisma.emote.upsert({
        where: {
          platform_emoteId: {
            platform: 'twitch',
            emoteId: emote.id,
          },
        },
        update: {
          emoteCode: emote.name,
          imageUrl1x: emote.images.url_1x,
          imageUrl2x: emote.images.url_2x,
          imageUrl4x: emote.images.url_4x,
          emoteType: emote.emote_type,
          tier: emote.tier,
          lastSyncedAt: new Date(),
        },
        create: {
          platform: 'twitch',
          emoteId: emote.id,
          emoteCode: emote.name,
          scope: 'channel',
          channelId,
          imageUrl1x: emote.images.url_1x,
          imageUrl2x: emote.images.url_2x,
          imageUrl4x: emote.images.url_4x,
          emoteType: emote.emote_type,
          tier: emote.tier,
        },
      });
    }
  }

  /**
   * サーバー起動時に実行
   */
  async initialize(): Promise<void> {
    // グローバルエモートが24時間以内に同期されているか確認
    const count = await prisma.emote.count({
      where: {
        platform: 'twitch',
        scope: 'global',
        lastSyncedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (count === 0) {
      console.log('[DataSync] No recent global emotes, syncing...');
      await this.syncGlobalEmotes();
    } else {
      console.log(`[DataSync] Global emotes up to date (${count} emotes)`);
    }
  }
}

export const dataSyncService = new DataSyncService();
```

**サーバー起動時に初期化: `server/src/index.ts`**

```typescript
import { dataSyncService } from './services/dataSyncService';

// サーバー起動後に実行
app.listen(PORT, async () => {
  console.log(`[Server] Listening on port ${PORT}`);

  // データ同期サービス初期化
  await dataSyncService.initialize();
});
```

#### タスク2: エモート取得APIの修正

**修正ファイル: `server/src/routes/twitch.ts`**

```typescript
// グローバルエモート取得
router.get('/api/twitch/emotes/global', async (req, res) => {
  try {
    // ✅ DBから取得
    const emotes = await prisma.emote.findMany({
      where: {
        platform: 'twitch',
        scope: 'global',
      },
      select: {
        emoteId: true,
        emoteCode: true,
        imageUrl1x: true,
        imageUrl2x: true,
        imageUrl4x: true,
      },
    });

    if (emotes.length > 0) {
      console.log(`[Emotes] DB HIT: ${emotes.length} global emotes`);
      res.json(emotes);
      return;
    }

    // DBに無い場合のみAPI呼び出し
    console.log('[Emotes] DB MISS: Calling API...');
    await dataSyncService.syncGlobalEmotes();

    // 再度DBから取得
    const freshEmotes = await prisma.emote.findMany({
      where: { platform: 'twitch', scope: 'global' },
    });

    res.json(freshEmotes);
  } catch (error) {
    console.error('[Emotes] Error:', error);
    res.status(500).json({ error: 'Failed to fetch emotes' });
  }
});

// チャンネルエモート取得
router.get('/api/twitch/emotes/channel/:channelId', async (req, res) => {
  const { channelId } = req.params;

  try {
    // DBから取得（24時間以内に同期されたもの）
    const emotes = await prisma.emote.findMany({
      where: {
        platform: 'twitch',
        scope: 'channel',
        channelId,
        lastSyncedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (emotes.length > 0) {
      console.log(`[Emotes] DB HIT: ${emotes.length} channel emotes`);
      res.json(emotes);
      return;
    }

    // DBに無い or 古い場合はAPI呼び出し
    console.log('[Emotes] DB MISS: Syncing channel emotes...');
    await dataSyncService.syncChannelEmotes(channelId);

    const freshEmotes = await prisma.emote.findMany({
      where: { platform: 'twitch', scope: 'channel', channelId },
    });

    res.json(freshEmotes);
  } catch (error) {
    console.error('[Emotes] Error:', error);
    res.status(500).json({ error: 'Failed to fetch channel emotes' });
  }
});
```

---

### Day 11-14: 検索機能のDB移行

#### タスク: チャンネル検索API修正

**修正ファイル: `server/src/routes/twitch.ts`**

```typescript
// チャンネル検索
router.get('/api/twitch/search', async (req, res) => {
  const { query } = req.query as { query: string };

  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query too short' });
  }

  try {
    // ① まずDBで検索
    const dbResults = await prisma.channel.findMany({
      where: {
        platform: 'twitch',
        OR: [
          { displayName: { contains: query, mode: 'insensitive' } },
          { username: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [
        { isLive: 'desc' },
        { followerCount: 'desc' },
      ],
      take: 20,
    });

    // ② DBにヒットがあれば返す
    if (dbResults.length > 0) {
      console.log(`[Search] DB HIT: ${dbResults.length} results`);

      // アクセス日時を更新（バックグラウンド）
      dbResults.forEach(channel => {
        prisma.channel.update({
          where: { id: channel.id },
          data: { lastAccessedAt: new Date() },
        }).catch(console.error);
      });

      return res.json(dbResults);
    }

    // ③ DBにヒットなし → APIを呼び出し
    console.log(`[Search] DB MISS: Calling Twitch API`);
    const apiResults = await twitchService.searchChannels(query);

    // ④ API結果をDBに保存
    for (const channel of apiResults) {
      await prisma.channel.upsert({
        where: {
          platform_channelId: {
            platform: 'twitch',
            channelId: channel.id,
          },
        },
        update: {
          displayName: channel.display_name,
          username: channel.login,
          avatarUrl: channel.profile_image_url,
          followerCount: channel.follower_count,
          lastSyncedAt: new Date(),
          lastAccessedAt: new Date(),
        },
        create: {
          platform: 'twitch',
          channelId: channel.id,
          displayName: channel.display_name,
          username: channel.login,
          avatarUrl: channel.profile_image_url,
          followerCount: channel.follower_count,
        },
      });
    }

    res.json(apiResults);
  } catch (error) {
    console.error('[Search] Error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});
```

---

### Week 2 完了チェックリスト

- [ ] グローバルエモートがDBに保存されている
- [ ] チャンネルエモートがDBに保存されている
- [ ] エモート取得APIがDB優先になっている
- [ ] チャンネル検索がDB優先になっている
- [ ] 検索結果がDBに保存されている
- [ ] パフォーマンステスト実施（検索5-10ms以下）

---

## Week 3: アナリティクス・PV

### 目標

- ✅ page_views テーブル実装
- ✅ analytics_events テーブル実装
- ✅ PV統計のDB移行

---

### Day 15-17: PV統計のDB移行

#### タスク1: PVトラッキングミドルウェア

**新規ファイル: `server/src/middleware/pvTracking.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client';
import crypto from 'crypto';

export function pvTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  // IPハッシュ生成
  const ip = req.ip || req.connection.remoteAddress || '';
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);

  // デバイスタイプ判定
  const userAgent = req.headers['user-agent'] || '';
  let deviceType = 'desktop';
  if (/mobile/i.test(userAgent)) deviceType = 'mobile';
  if (/tablet/i.test(userAgent)) deviceType = 'tablet';

  // ユーザーID取得（ログイン済みの場合）
  const userId = (req.session as any)?.userId || null;

  // DBに保存（非同期、レスポンスを待たない）
  prisma.pageView.create({
    data: {
      ipHash,
      path: req.path,
      referrer: req.headers.referer,
      userAgent,
      userId,
      deviceType,
    },
  }).catch(error => {
    console.error('[PV] Failed to save page view:', error);
  });

  next();
}
```

**適用: `server/src/index.ts`**

```typescript
import { pvTrackingMiddleware } from './middleware/pvTracking';

// 全リクエストでPV追跡
app.use(pvTrackingMiddleware);
```

#### タスク2: PV統計API

**新規ファイル: `server/src/routes/analytics.ts`**

```typescript
import { Router } from 'express';
import { prisma } from '../db/client';

const router = Router();

// 今日のPV統計
router.get('/api/analytics/pv/today', async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalPv, uniqueVisitors] = await Promise.all([
    prisma.pageView.count({
      where: { createdAt: { gte: today } },
    }),
    prisma.pageView.groupBy({
      by: ['ipHash'],
      where: { createdAt: { gte: today } },
      _count: true,
    }),
  ]);

  res.json({
    pv: totalPv,
    uniqueUsers: uniqueVisitors.length,
  });
});

// 日次PV統計（過去30日）
router.get('/api/analytics/pv/daily', async (req, res) => {
  const stats = await prisma.$queryRaw`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as pv,
      COUNT(DISTINCT ip_hash) as unique_visitors
    FROM page_views
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  res.json(stats);
});

export default router;
```

---

### Day 18-21: アナリティクスイベントのDB移行

#### タスク: イベント追跡API

**修正ファイル: `server/src/routes/analytics.ts`**

```typescript
// イベント追跡
router.post('/api/analytics/track', async (req, res) => {
  const { eventType, eventData, sessionId, deviceType, screenWidth, screenHeight } = req.body;

  const ip = req.ip || '';
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
  const userId = (req.session as any)?.userId || null;

  try {
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        eventData,
        userId,
        sessionId,
        ipHash,
        userAgent: req.headers['user-agent'],
        deviceType,
        screenWidth,
        screenHeight,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// イベント統計取得
router.get('/api/analytics/events', async (req, res) => {
  const { days = 30 } = req.query;

  const stats = await prisma.analyticsEvent.groupBy({
    by: ['eventType'],
    where: {
      createdAt: {
        gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000),
      },
    },
    _count: true,
  });

  res.json(stats);
});
```

---

### Week 3 完了チェックリスト

- [ ] PVがDBに保存されている
- [ ] アナリティクスイベントがDBに保存されている
- [ ] PV統計APIが動作している
- [ ] 管理ダッシュボードでPV確認可能
- [ ] マテリアライズドビューが更新されている

---

## Week 4: セキュリティ・最適化

### 目標

- ✅ security_logs テーブル実装
- ✅ パフォーマンステスト
- ✅ 本番デプロイ

---

### Day 22-24: セキュリティログのDB移行

#### タスク: セキュリティログミドルウェア

**修正ファイル: `server/src/middleware/security.ts`**

```typescript
import { prisma } from '../db/client';
import crypto from 'crypto';

export async function logSecurityEvent(
  logType: string,
  severity: string,
  ip: string,
  details: {
    endpoint?: string;
    method?: string;
    statusCode?: number;
    message?: string;
    metadata?: any;
    userId?: string;
    username?: string;
  }
) {
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);

  await prisma.securityLog.create({
    data: {
      logType,
      severity,
      ip,
      ipHash,
      ...details,
    },
  }).catch(error => {
    console.error('[Security] Failed to log event:', error);
  });
}

// 使用例
export async function rateLimitExceeded(req: Request) {
  await logSecurityEvent(
    'rate_limit_exceeded',
    'medium',
    req.ip || '',
    {
      endpoint: req.path,
      method: req.method,
      message: 'Rate limit exceeded',
    }
  );
}
```

---

### Day 25-27: 最適化とテスト

#### タスク1: インデックスチューニング

```sql
-- 使用されていないインデックスを確認
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY idx_scan;

-- 遅いクエリを特定
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

#### タスク2: パフォーマンステスト

```bash
# k6負荷テスト
k6 run --vus 50 --duration 5m load-test.js

# チャンネル検索パフォーマンス
time curl "https://api.fukumado.jp/api/twitch/search?query=shroud"

# エモート取得パフォーマンス
time curl "https://api.fukumado.jp/api/twitch/emotes/global"
```

**目標値**:
- チャンネル検索: 5-10ms
- エモート取得: 3-8ms
- PV記録: 5-15ms

---

### Day 28: 本番デプロイ

#### ステップ1: 最終確認

```bash
# ローカルテスト
npm run test
npm run build

# Prismaマイグレーション確認
npx prisma migrate status
```

#### ステップ2: Renderデプロイ

```bash
git add .
git commit -m "feat: Add PostgreSQL database integration"
git push origin main
```

#### ステップ3: 本番環境でマイグレーション

Renderダッシュボード → fukumado-db → Query で実行:

```sql
-- 接続確認
SELECT NOW();

-- テーブル確認
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- データ確認
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM channels;
SELECT COUNT(*) FROM page_views;
```

#### ステップ4: モニタリング設定

```bash
# Renderログ監視
render logs -f fukumado-server

# DB接続数確認
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# テーブルサイズ確認
psql $DATABASE_URL -c "
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

### Week 4 完了チェックリスト

- [ ] セキュリティログがDBに保存されている
- [ ] パフォーマンステスト合格（目標値達成）
- [ ] 本番環境デプロイ成功
- [ ] モニタリング設定完了
- [ ] バックアップ動作確認
- [ ] ロールバックプラン確認

---

## トラブルシューティング

### 問題1: マイグレーション失敗

**症状**: `npx prisma migrate deploy` でエラー

**解決方法**:

```bash
# マイグレーション履歴確認
npx prisma migrate status

# 強制リセット（開発環境のみ）
npx prisma migrate reset

# 手動でDDL実行
psql $DATABASE_URL < schema.sql
```

---

### 問題2: 接続エラー

**症状**: `Error: Can't reach database server`

**解決方法**:

```bash
# 1. DATABASE_URL確認
echo $DATABASE_URL

# 2. 接続テスト
psql $DATABASE_URL -c "SELECT 1;"

# 3. SSL設定確認（Renderは?sslmode=require必須）
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

---

### 問題3: パフォーマンス低下

**症状**: クエリが遅い（>100ms）

**解決方法**:

```sql
-- 1. ANALYZE実行
ANALYZE channels;
ANALYZE page_views;

-- 2. インデックス再構築
REINDEX TABLE channels;

-- 3. 不要なデータ削除
SELECT cleanup_old_page_views();
SELECT cleanup_old_analytics();
```

---

## 完了！

全てのマイグレーションが完了しました。

**次のステップ**:
1. 定期的なバックアップ確認
2. パフォーマンスモニタリング
3. ユーザーフィードバック収集

---

**関連ドキュメント**:
- [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)
- [schema.sql](./schema.sql)
- [prisma/schema.prisma](./prisma/schema.prisma)

---

**© 2025 ふくまど！ All rights reserved.**
