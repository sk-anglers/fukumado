-- CreateTable: alerts
-- アラート・通知テーブル

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,

  -- アラート情報
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,

  -- ステータス
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ(6),
  acknowledged_by VARCHAR(255),

  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ(6),

  -- メタデータ
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS alerts_type_created_at_idx ON alerts (type, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_severity_created_at_idx ON alerts (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_acknowledged_created_at_idx ON alerts (acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_resolved_created_at_idx ON alerts (resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts (created_at DESC);

-- CreateTable: alert_settings
-- アラート設定テーブル

CREATE TABLE IF NOT EXISTS alert_settings (
  id SERIAL PRIMARY KEY,

  -- 設定情報
  type VARCHAR(50) UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  threshold DOUBLE PRECISION,

  -- 通知設定
  notify_email BOOLEAN NOT NULL DEFAULT false,
  notify_slack BOOLEAN NOT NULL DEFAULT false,
  notify_webhook BOOLEAN NOT NULL DEFAULT false,

  -- メタデータ
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- デフォルト設定を挿入
INSERT INTO alert_settings (type, enabled, threshold, notify_email, notify_slack, notify_webhook) VALUES
  ('cpu_high', true, 80.0, false, false, false),
  ('memory_high', true, 85.0, false, false, false),
  ('rate_limit_low', true, 20.0, false, false, false),
  ('quota_low', true, 10.0, false, false, false),
  ('security', true, NULL, false, false, false),
  ('error_spike', true, NULL, false, false, false)
ON CONFLICT (type) DO NOTHING;
