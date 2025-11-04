-- ============================================
-- ふくまど！ PostgreSQL スキーマ定義
-- バージョン: 1.0.0
-- 作成日: 2025-11-04
-- PostgreSQL 15+
-- ============================================

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 類似検索用
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";  -- 自動タスク用（Renderではサポートされていないためコメントアウト）

-- ============================================
-- 共通関数
-- ============================================

-- updated_at自動更新関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- テーブル作成（依存関係順）
-- ============================================

-- --------------------------------------------
-- 1. users テーブル
-- --------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  youtube_user_id VARCHAR(255) UNIQUE,
  twitch_user_id VARCHAR(255) UNIQUE,

  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,

  youtube_access_token TEXT,
  youtube_refresh_token TEXT,
  youtube_token_expires_at TIMESTAMPTZ,

  twitch_access_token TEXT,
  twitch_refresh_token TEXT,
  twitch_token_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_youtube ON users(youtube_user_id) WHERE youtube_user_id IS NOT NULL;
CREATE INDEX idx_users_twitch ON users(twitch_user_id) WHERE twitch_user_id IS NOT NULL;
CREATE INDEX idx_users_last_login ON users(last_login_at DESC);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'ユーザー情報とOAuthトークンを管理';

-- --------------------------------------------
-- 2. channels テーブル
-- --------------------------------------------
CREATE TABLE channels (
  id BIGSERIAL PRIMARY KEY,

  platform VARCHAR(20) NOT NULL CHECK (platform IN ('youtube', 'twitch', 'niconico')),
  channel_id VARCHAR(255) NOT NULL,

  display_name VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  description TEXT,
  avatar_url TEXT,
  banner_url TEXT,

  subscriber_count INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  view_count BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,

  is_live BOOLEAN DEFAULT FALSE,
  current_stream_id VARCHAR(255),
  current_stream_title TEXT,
  current_viewer_count INTEGER,

  search_vector TSVECTOR,
  popularity_score INTEGER GENERATED ALWAYS AS (
    CASE WHEN is_live THEN follower_count * 2 ELSE follower_count END
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(platform, channel_id)
);

CREATE INDEX idx_channels_platform ON channels(platform);
CREATE INDEX idx_channels_live ON channels(platform, is_live, popularity_score DESC) WHERE is_live = TRUE;
CREATE INDEX idx_channels_popularity ON channels(platform, popularity_score DESC);
CREATE INDEX idx_channels_display_name ON channels(platform, display_name);
CREATE INDEX idx_channels_username ON channels(platform, username) WHERE username IS NOT NULL;
CREATE INDEX idx_channels_search ON channels USING gin(search_vector);
CREATE INDEX idx_channels_last_synced ON channels(last_synced_at) WHERE last_synced_at < NOW() - INTERVAL '24 hours';
CREATE INDEX idx_channels_last_accessed ON channels(last_accessed_at) WHERE last_accessed_at < NOW() - INTERVAL '90 days';

CREATE OR REPLACE FUNCTION channels_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    COALESCE(NEW.display_name, '') || ' ' ||
    COALESCE(NEW.username, '') || ' ' ||
    COALESCE(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER channels_search_vector_trigger
BEFORE INSERT OR UPDATE OF display_name, username, description ON channels
FOR EACH ROW EXECUTE FUNCTION channels_search_vector_update();

CREATE TRIGGER channels_updated_at BEFORE UPDATE ON channels
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE channels IS 'プラットフォーム横断のチャンネル情報（オンデマンド蓄積）';

-- --------------------------------------------
-- 3. followed_channels テーブル
-- --------------------------------------------
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

CREATE INDEX idx_followed_user ON followed_channels(user_id);
CREATE INDEX idx_followed_channel ON followed_channels(platform, channel_id);
CREATE INDEX idx_followed_notification ON followed_channels(user_id, notification_enabled) WHERE notification_enabled = TRUE;

COMMENT ON TABLE followed_channels IS 'ユーザーのフォローチャンネル管理';

-- --------------------------------------------
-- 4. emotes テーブル
-- --------------------------------------------
CREATE TABLE emotes (
  id BIGSERIAL PRIMARY KEY,

  platform VARCHAR(20) NOT NULL,
  emote_id VARCHAR(255) NOT NULL,
  emote_code VARCHAR(255) NOT NULL,

  scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'channel', 'subscriber')),
  channel_id VARCHAR(255),

  image_url_1x TEXT NOT NULL,
  image_url_2x TEXT,
  image_url_4x TEXT,

  emote_type VARCHAR(50),
  tier VARCHAR(10),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(platform, emote_id),
  CHECK (scope = 'global' OR channel_id IS NOT NULL)
);

CREATE INDEX idx_emotes_global ON emotes(platform) WHERE scope = 'global';
CREATE INDEX idx_emotes_channel ON emotes(platform, channel_id, scope) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_emotes_code ON emotes(emote_code);
CREATE INDEX idx_emotes_last_synced ON emotes(last_synced_at) WHERE last_synced_at < NOW() - INTERVAL '24 hours';

CREATE TRIGGER emotes_updated_at BEFORE UPDATE ON emotes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE emotes IS 'Twitchエモート情報（グローバル・チャンネル）';

-- --------------------------------------------
-- 5. badges テーブル
-- --------------------------------------------
CREATE TABLE badges (
  id BIGSERIAL PRIMARY KEY,

  platform VARCHAR(20) NOT NULL,
  badge_set_id VARCHAR(255) NOT NULL,
  badge_version VARCHAR(50) NOT NULL,

  scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'channel')),
  channel_id VARCHAR(255),

  image_url_1x TEXT NOT NULL,
  image_url_2x TEXT,
  image_url_4x TEXT,

  title VARCHAR(255),
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- グローバルバッジのユニーク制約（channel_id IS NULL）
CREATE UNIQUE INDEX idx_badges_unique_global
  ON badges(platform, badge_set_id, badge_version)
  WHERE channel_id IS NULL;

-- チャンネル固有バッジのユニーク制約（channel_id IS NOT NULL）
CREATE UNIQUE INDEX idx_badges_unique_channel
  ON badges(platform, badge_set_id, badge_version, channel_id)
  WHERE channel_id IS NOT NULL;

CREATE INDEX idx_badges_global ON badges(platform) WHERE scope = 'global';
CREATE INDEX idx_badges_channel ON badges(platform, channel_id) WHERE channel_id IS NOT NULL;

CREATE TRIGGER badges_updated_at BEFORE UPDATE ON badges
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE badges IS 'Twitchバッジ情報';

-- --------------------------------------------
-- 6. page_views テーブル
-- --------------------------------------------
CREATE TABLE page_views (
  id BIGSERIAL PRIMARY KEY,

  ip_hash VARCHAR(64) NOT NULL,
  path VARCHAR(255) NOT NULL,
  referrer TEXT,
  user_agent TEXT,

  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'mobile', 'tablet')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  view_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);

CREATE INDEX idx_pv_date ON page_views(view_date DESC);
CREATE INDEX idx_pv_user ON page_views(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_pv_ip ON page_views(ip_hash, view_date);

COMMENT ON TABLE page_views IS 'ページビュー統計（1年間保持）';

-- --------------------------------------------
-- 7. analytics_events テーブル
-- --------------------------------------------
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,

  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,

  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  ip_hash VARCHAR(64) NOT NULL,
  user_agent TEXT,

  device_type VARCHAR(20),
  screen_width INTEGER,
  screen_height INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);

CREATE INDEX idx_analytics_event_type ON analytics_events(event_type, created_at DESC);
CREATE INDEX idx_analytics_event_date ON analytics_events(event_date DESC);
CREATE INDEX idx_analytics_user ON analytics_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_session ON analytics_events(session_id, created_at DESC) WHERE session_id IS NOT NULL;
CREATE INDEX idx_analytics_event_data ON analytics_events USING gin(event_data);

COMMENT ON TABLE analytics_events IS 'ユーザー行動分析イベント（90日間保持）';

-- --------------------------------------------
-- 8. security_logs テーブル
-- --------------------------------------------
CREATE TABLE security_logs (
  id BIGSERIAL PRIMARY KEY,

  log_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ip VARCHAR(45) NOT NULL,
  ip_hash VARCHAR(64) NOT NULL,

  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  user_agent TEXT,

  message TEXT,
  metadata JSONB,

  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  log_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);

CREATE INDEX idx_security_ip ON security_logs(ip_hash, created_at DESC);
CREATE INDEX idx_security_type ON security_logs(log_type, created_at DESC);
CREATE INDEX idx_security_severity ON security_logs(severity, created_at DESC);
CREATE INDEX idx_security_date ON security_logs(log_date DESC);
CREATE INDEX idx_security_user ON security_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;

COMMENT ON TABLE security_logs IS 'セキュリティイベントログ（90日間保持）';

-- --------------------------------------------
-- 9. user_preferences テーブル
-- --------------------------------------------
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  default_layout VARCHAR(20) DEFAULT 'grid_2x2',
  saved_layouts JSONB DEFAULT '[]',
  notification_settings JSONB DEFAULT '{"enabled":true,"sound":true}',
  preferences JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON user_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_preferences IS 'ユーザー設定（レイアウト・通知等）';

-- --------------------------------------------
-- 10. sessions テーブル（オプション）
-- --------------------------------------------
CREATE TABLE sessions (
  sid VARCHAR(255) PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_expire ON sessions(expire);
CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE sessions IS 'セッション管理（express-session互換）';

-- ============================================
-- マテリアライズドビュー
-- ============================================

-- 日次PV集計
CREATE MATERIALIZED VIEW pv_daily_stats AS
SELECT
  view_date,
  COUNT(*) AS total_pv,
  COUNT(DISTINCT ip_hash) AS unique_visitors,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS authenticated_users,
  COUNT(*) FILTER (WHERE device_type = 'desktop') AS desktop_pv,
  COUNT(*) FILTER (WHERE device_type = 'mobile') AS mobile_pv,
  COUNT(*) FILTER (WHERE device_type = 'tablet') AS tablet_pv
FROM page_views
GROUP BY view_date
ORDER BY view_date DESC;

CREATE UNIQUE INDEX ON pv_daily_stats(view_date);

COMMENT ON MATERIALIZED VIEW pv_daily_stats IS '日次PV統計（1時間ごとに更新）';

-- ============================================
-- クリーンアップ関数
-- ============================================

-- 90日間未アクセスのチャンネル削除
CREATE OR REPLACE FUNCTION cleanup_old_channels()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM channels
    WHERE last_accessed_at < NOW() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'Deleted % old channels', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 期限切れセッション削除
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM sessions
    WHERE expire < NOW()
    RETURNING sid
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'Deleted % expired sessions', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 古いPVデータ削除（1年以上前）
CREATE OR REPLACE FUNCTION cleanup_old_page_views()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM page_views
    WHERE created_at < NOW() - INTERVAL '1 year'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'Deleted % old page views', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 古いアナリティクスイベント削除（90日以上前）
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM analytics_events
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'Deleted % old analytics events', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 古いセキュリティログ削除（90日以上前）
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM security_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'Deleted % old security logs', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- マテリアライズドビュー更新
CREATE OR REPLACE FUNCTION refresh_pv_daily_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY pv_daily_stats;
  RAISE NOTICE 'Refreshed pv_daily_stats materialized view';
END;
$$ LANGUAGE plpgsql;

-- インデックスメンテナンス
CREATE OR REPLACE FUNCTION weekly_index_maintenance()
RETURNS void AS $$
BEGIN
  ANALYZE channels;
  ANALYZE emotes;
  ANALYZE page_views;
  ANALYZE analytics_events;
  RAISE NOTICE 'Completed weekly index maintenance';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 自動タスクスケジュール（pg_cron）
-- ============================================
-- NOTE: Renderのマネージドデータベースではpg_cronがサポートされていません
-- これらの自動タスクは、アプリケーション側（Node.jsのcronジョブやRenderのCron Jobs）で実装する必要があります

-- -- 毎日午前3時にクリーンアップ
-- SELECT cron.schedule('cleanup-old-data', '0 3 * * *', $$
--   SELECT cleanup_old_channels();
--   SELECT cleanup_expired_sessions();
--   SELECT cleanup_old_page_views();
--   SELECT cleanup_old_analytics();
--   SELECT cleanup_old_security_logs();
-- $$);

-- -- 毎時間、PV統計を更新
-- SELECT cron.schedule('refresh-pv-stats', '0 * * * *', $$
--   SELECT refresh_pv_daily_stats();
-- $$);

-- -- 毎週日曜日午前4時にインデックスメンテナンス
-- SELECT cron.schedule('weekly-maintenance', '0 4 * * 0', $$
--   SELECT weekly_index_maintenance();
-- $$);

-- ============================================
-- 初期データ挿入（オプション）
-- ============================================

-- テスト用ユーザー（開発環境のみ）
-- INSERT INTO users (display_name, email) VALUES ('Test User', 'test@fukumado.jp');

-- ============================================
-- 完了
-- ============================================

SELECT
  'Schema created successfully!' AS status,
  NOW() AS created_at,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') AS table_count;
