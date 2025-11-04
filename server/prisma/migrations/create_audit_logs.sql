-- Create audit_logs table for admin operation tracking
-- 管理者操作を追跡するための監査ログテーブルを作成

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,

  -- 操作情報
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  actor_ip VARCHAR(45) NOT NULL,
  actor_agent TEXT,

  -- 対象情報
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(255),

  -- 詳細情報
  details JSONB,

  -- 結果
  status VARCHAR(20) NOT NULL,
  error_message TEXT,

  -- メタデータ
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at ON audit_logs(actor, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_ip_created_at ON audit_logs(actor_ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type_created_at ON audit_logs(target_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status_created_at ON audit_logs(status, created_at DESC);

-- コメント追加
COMMENT ON TABLE audit_logs IS '管理者操作の監査ログ';
COMMENT ON COLUMN audit_logs.action IS '操作種別（例: maintenance_enabled, cache_cleared）';
COMMENT ON COLUMN audit_logs.actor IS '操作者（管理者名、IPアドレス等）';
COMMENT ON COLUMN audit_logs.actor_ip IS '操作者のIPアドレス';
COMMENT ON COLUMN audit_logs.actor_agent IS 'User-Agent';
COMMENT ON COLUMN audit_logs.target_type IS '対象の種類（system, cache, database, maintenance等）';
COMMENT ON COLUMN audit_logs.target_id IS '対象のID（オプション）';
COMMENT ON COLUMN audit_logs.details IS '操作の詳細（JSON形式）';
COMMENT ON COLUMN audit_logs.status IS '結果（success, failure）';
COMMENT ON COLUMN audit_logs.error_message IS 'エラーメッセージ（失敗時）';
