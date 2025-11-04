-- Migration: add_ip_whitelist
-- Created: 2025-11-04
-- Description: Add IP whitelist table for persistent whitelist storage

-- Create ip_whitelist table
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id BIGSERIAL PRIMARY KEY,
  ip VARCHAR(45) NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on ip column for faster lookups
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip ON ip_whitelist(ip);

-- Add comment
COMMENT ON TABLE ip_whitelist IS 'IPホワイトリスト - セキュリティブロックから除外するIPアドレス';
COMMENT ON COLUMN ip_whitelist.ip IS 'ホワイトリストに登録されたIPアドレス（IPv4/IPv6対応）';
COMMENT ON COLUMN ip_whitelist.reason IS 'ホワイトリストに追加した理由';
COMMENT ON COLUMN ip_whitelist.created_at IS 'ホワイトリスト登録日時';
