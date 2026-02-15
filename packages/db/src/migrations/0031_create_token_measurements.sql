-- Migration: Create token_measurements table
-- Date: 2026-02-15
-- Description: Token usage and cost tracking per skill invocation

CREATE TABLE IF NOT EXISTS token_measurements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  usage_event_id TEXT,
  user_id TEXT REFERENCES users(id),
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  model_name TEXT NOT NULL,
  model_provider TEXT NOT NULL DEFAULT 'anthropic',
  estimated_cost_microcents INTEGER,
  latency_ms INTEGER,
  source TEXT NOT NULL DEFAULT 'hook',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS token_measurements_skill_id_idx ON token_measurements(skill_id);
CREATE INDEX IF NOT EXISTS token_measurements_model_name_idx ON token_measurements(model_name);
CREATE INDEX IF NOT EXISTS token_measurements_tenant_id_idx ON token_measurements(tenant_id);
CREATE INDEX IF NOT EXISTS token_measurements_created_at_idx ON token_measurements(created_at);

-- Enable RLS for tenant isolation
ALTER TABLE token_measurements ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'token_measurements' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON token_measurements
      AS RESTRICTIVE
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;
