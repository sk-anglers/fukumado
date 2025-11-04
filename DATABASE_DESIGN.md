# ふくまど！ データベース設計書

**バージョン**: 1.0.0
**作成日**: 2025-11-04
**対象環境**: Render PostgreSQL 15

---

## 📋 目次

1. [概要](#概要)
2. [データ蓄積戦略](#データ蓄積戦略)
3. [テーブル設計](#テーブル設計)
4. [インデックス戦略](#インデックス戦略)
5. [データライフサイクル](#データライフサイクル)
6. [容量・パフォーマンス試算](#容量パフォーマンス試算)
7. [マイグレーション計画](#マイグレーション計画)

---

## 概要

### 目的

現在、Redisをキャッシュ兼データストアとして使用していますが、揮発性のため以下の問題があります：

- ✅ データ損失リスク（Redis再起動時）
- ✅ 長期的なトレンド分析が不可能
- ✅ セキュリティ監査ログが保持されない
- ✅ API呼び出しが過剰（33,000回/月）

本設計では、PostgreSQLを導入し、永続化が必要なデータをDBで管理します。

### 設計方針

1. **オンデマンド型データ蓄積**: ユーザーがフォロー・検索したチャンネルのみDB保存
2. **API呼び出し削減**: 87.5%削減（33,000回/月 → 4,110回/月）
3. **段階的移行**: 4フェーズ（4週間）で段階的に実装
4. **Redis継続使用**: キャッシュ層として併用（セッション、リアルタイムデータ）

---

## データ蓄積戦略

### 蓄積トリガー

| データ種別 | 蓄積タイミング | 更新頻度 |
|-----------|-------------|---------|
| **チャンネル情報** | ① ユーザーフォロー時<br>② 検索実行時 | 24時間ごと |
| **エモート（グローバル）** | サーバー起動時 | 24時間ごと |
| **エモート（チャンネル）** | チャンネル初回アクセス時 | 24時間ごと |
| **PV統計** | ページアクセス時 | リアルタイム |
| **アナリティクス** | ユーザーアクション時 | リアルタイム |
| **セキュリティログ** | セキュリティイベント時 | リアルタイム |

### データライフサイクル

```
【蓄積】
ユーザーアクション → API呼び出し → DB保存

【維持】
24時間経過 → バックグラウンド更新

【削除】
90日間未アクセス → 自動削除
```

---

## テーブル設計

### フェーズ1: コアテーブル（最優先）

#### 1. users - ユーザー情報

**容量試算**: 1,000ユーザー × 2KB = 2MB

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  youtube_user_id VARCHAR(255) UNIQUE,
  twitch_user_id VARCHAR(255) UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,
  -- OAuth トークン
  youtube_access_token TEXT,
  youtube_refresh_token TEXT,
  youtube_token_expires_at TIMESTAMPTZ,
  twitch_access_token TEXT,
  twitch_refresh_token TEXT,
  twitch_token_expires_at TIMESTAMPTZ,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

---

#### 2. channels - チャンネル情報

**容量試算**: 1,000チャンネル × 3KB = 3MB

```sql
CREATE TABLE channels (
  id BIGSERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  description TEXT,
  avatar_url TEXT,
  -- 統計情報
  follower_count INTEGER DEFAULT 0,
  is_live BOOLEAN DEFAULT FALSE,
  -- 検索最適化用
  search_vector TSVECTOR,
  popularity_score INTEGER,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, channel_id)
);
```

**特徴**:
- 全文検索対応（GIN インデックス）
- 人気度スコア（配信中は2倍）
- 最終アクセス日時（クリーンアップ用）

---

#### 3. followed_channels - フォローチャンネル

**容量試算**: 1,000ユーザー × 50フォロー × 0.2KB = 10MB

```sql
CREATE TABLE followed_channels (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,
  notification_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, platform, channel_id)
);
```

---

#### 4. emotes - エモート情報

**容量試算**:
- グローバル: 3,000個 × 0.5KB = 1.5MB
- チャンネル: 100ch × 50個 × 0.5KB = 2.5MB
- **合計: 4MB**

```sql
CREATE TABLE emotes (
  id BIGSERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,
  emote_id VARCHAR(255) NOT NULL,
  emote_code VARCHAR(255) NOT NULL,
  scope VARCHAR(20) NOT NULL,  -- 'global' | 'channel'
  channel_id VARCHAR(255),
  image_url_1x TEXT NOT NULL,
  image_url_2x TEXT,
  image_url_4x TEXT,
  emote_type VARCHAR(50),
  tier VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, emote_id)
);
```

---

### フェーズ2: アナリティクステーブル

#### 5. page_views - PV統計

**容量試算**: 10,000PV/日 × 30日 × 0.5KB = 150MB/月

```sql
CREATE TABLE page_views (
  id BIGSERIAL PRIMARY KEY,
  ip_hash VARCHAR(64) NOT NULL,
  path VARCHAR(255) NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_type VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  view_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);
```

#### 6. analytics_events - アナリティクスイベント

**容量試算**: 5,000イベント/日 × 90日 × 1KB = 450MB

```sql
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  ip_hash VARCHAR(64) NOT NULL,
  device_type VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);
```

---

### フェーズ3: セキュリティテーブル

#### 7. security_logs - セキュリティログ

**容量試算**: 1,000ログ/日 × 90日 × 1KB = 90MB

```sql
CREATE TABLE security_logs (
  id BIGSERIAL PRIMARY KEY,
  log_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  ip_hash VARCHAR(64) NOT NULL,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  message TEXT,
  metadata JSONB,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  log_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);
```

---

### フェーズ4: 補助テーブル

#### 8. badges - バッジ情報

**容量試算**: 5,000個 × 0.5KB = 2.5MB

#### 9. user_preferences - ユーザー設定

**容量試算**: 1,000ユーザー × 1KB = 1MB

#### 10. sessions - セッション管理（オプション）

※ 当面はRedisで継続

---

## インデックス戦略

### 検索パフォーマンス最適化

| テーブル | インデックス種別 | 用途 | 期待効果 |
|---------|---------------|------|---------|
| channels | GIN（全文検索） | チャンネル検索 | 5-10ms |
| channels | B-tree（popularity_score） | 人気順ソート | 3-5ms |
| channels | Partial（is_live=TRUE） | 配信中フィルタ | 2-3ms |
| emotes | B-tree（channel_id） | チャンネルエモート | 2-5ms |
| page_views | B-tree（view_date） | 日次PV集計 | 10-20ms |

### 主要インデックス一覧

```sql
-- channels
CREATE INDEX idx_channels_search ON channels USING gin(search_vector);
CREATE INDEX idx_channels_live ON channels(platform, is_live, popularity_score DESC) WHERE is_live = TRUE;
CREATE INDEX idx_channels_popularity ON channels(platform, popularity_score DESC);

-- emotes
CREATE INDEX idx_emotes_global ON emotes(platform) WHERE scope = 'global';
CREATE INDEX idx_emotes_channel ON emotes(platform, channel_id, scope) WHERE channel_id IS NOT NULL;

-- page_views
CREATE INDEX idx_pv_date ON page_views(view_date DESC);

-- analytics_events
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type, created_at DESC);
CREATE INDEX idx_analytics_event_data ON analytics_events USING gin(event_data);
```

---

## データライフサイクル

### 自動クリーンアップ

```sql
-- 90日間未アクセスのチャンネル削除
CREATE OR REPLACE FUNCTION cleanup_old_channels()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM channels
  WHERE last_accessed_at < NOW() - INTERVAL '90 days'
  RETURNING id INTO deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 1年以上前のPVデータ削除
CREATE OR REPLACE FUNCTION cleanup_old_page_views()
RETURNS INTEGER AS $$
-- ...
$$ LANGUAGE plpgsql;

-- 90日以上前のアナリティクス削除
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS INTEGER AS $$
-- ...
$$ LANGUAGE plpgsql;
```

### 自動実行スケジュール（pg_cron）

```sql
-- 毎日午前3時にクリーンアップ
SELECT cron.schedule('cleanup-old-data', '0 3 * * *', $$
  SELECT cleanup_old_channels();
  SELECT cleanup_old_page_views();
  SELECT cleanup_old_analytics();
$$);

-- 毎時間、PV統計を更新
SELECT cron.schedule('refresh-pv-stats', '0 * * * *', $$
  SELECT refresh_pv_daily_stats();
$$);
```

---

## 容量・パフォーマンス試算

### 総容量試算（1年間運用）

| テーブル | 初期容量 | 月間増加 | 1年後容量 |
|---------|---------|---------|----------|
| users | 2MB | 0.5MB | 8MB |
| channels | 3MB | 1MB | 15MB |
| followed_channels | 10MB | 2MB | 34MB |
| emotes | 4MB | 0.5MB | 10MB |
| badges | 2.5MB | 0MB | 2.5MB |
| page_views | 0MB | 150MB | 1,800MB |
| pv_daily_stats | 0.1MB | 0.1MB | 1.2MB |
| analytics_events | 0MB | 15MB | 180MB |
| security_logs | 0MB | 3MB | 36MB |
| user_preferences | 1MB | 0.2MB | 3.4MB |
| **合計** | **22.6MB** | **172.3MB** | **2,090MB (約2GB)** |

### 推奨プラン

| フェーズ | ユーザー数 | 月間PV | DB容量 | 推奨プラン | 月額 |
|---------|----------|--------|--------|-----------|------|
| 開発・テスト | 〜10人 | 〜1,000 | 100MB | Free | $0 |
| ベータ版 | 〜100人 | 〜10,000 | 500MB | Starter | $7 |
| 正式版（初期） | 〜500人 | 〜50,000 | 1.5GB | Starter | $7 |
| 成長期 | 〜2,000人 | 〜200,000 | 5GB | Standard | $25 |

**推奨**: **Starter プラン（$7/月）** で開始

### パフォーマンス目標

| 操作 | 現状（Redis） | 目標（PostgreSQL） | 削減率 |
|-----|-------------|-------------------|--------|
| チャンネル検索 | 200-300ms（API） | 5-10ms（DB） | 95%削減 |
| エモート取得 | 150-250ms（API） | 3-8ms（DB） | 96%削減 |
| PV記録 | 5-10ms（Redis） | 5-15ms（DB） | 同等 |
| フォローリスト | 200ms（API） | 5-10ms（DB） | 95%削減 |

---

## マイグレーション計画

### 4週間ロードマップ

```
Week 1: 環境構築 + users, channels, followed_channels
Week 2: emotes, badges + 検索機能のDB移行
Week 3: page_views, analytics_events のDB移行
Week 4: security_logs + 最適化 + テスト
```

詳細は `MIGRATION_GUIDE.md` を参照してください。

---

## 関連ドキュメント

- [schema.sql](./schema.sql) - 完全なDDLスクリプト
- [prisma/schema.prisma](./prisma/schema.prisma) - Prismaスキーマ
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - マイグレーション手順書
- [.env.example](./.env.example) - 環境変数設定例

---

**© 2025 ふくまど！ All rights reserved.**
