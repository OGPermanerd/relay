-- Migration 0006: Create append-only audit_logs table for SOC2 compliance
-- This table is intentionally NOT tenant-scoped via RLS — it supports
-- system-level and cross-tenant audit events (nullable tenant_id/actor_id).

-- Create append-only audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  tenant_id text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  ip_address text,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action, created_at DESC);

-- Make append-only: create trigger to prevent UPDATE/DELETE
-- Using trigger approach (works regardless of database role setup)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Direct modification of audit_logs is forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_audit_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- NOTE: When an app_user role is created in a later deployment phase,
-- add: REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
