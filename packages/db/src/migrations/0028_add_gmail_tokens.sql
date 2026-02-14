-- Migration: Add gmail_tokens table and gmail_diagnostic_enabled to site_settings
-- Phase 50-01: Gmail OAuth Infrastructure

-- Gmail tokens table: one row per user, encrypted OAuth tokens at rest
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  refreshing_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS gmail_tokens_user_id_idx ON gmail_tokens(user_id);
CREATE INDEX IF NOT EXISTS gmail_tokens_tenant_id_idx ON gmail_tokens(tenant_id);

-- Row-level security
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gmail_tokens
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- Add gmail diagnostic toggle to site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS gmail_diagnostic_enabled BOOLEAN NOT NULL DEFAULT false;
