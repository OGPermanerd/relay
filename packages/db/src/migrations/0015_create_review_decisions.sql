-- Migration: Create review_decisions table
-- Purpose: Immutable audit trail for admin review actions (SOC2 compliance)
-- Note: No updated_at column — this table is insert-only

CREATE TABLE IF NOT EXISTS review_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  notes TEXT,
  ai_scores_snapshot JSONB,
  previous_content TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS review_decisions_skill_id_idx ON review_decisions(skill_id);
CREATE INDEX IF NOT EXISTS review_decisions_tenant_id_idx ON review_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS review_decisions_reviewer_id_idx ON review_decisions(reviewer_id);

-- Enable Row Level Security for tenant isolation
ALTER TABLE review_decisions ENABLE ROW LEVEL SECURITY;

-- RLS policy: restrict access to rows matching current tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_decisions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON review_decisions
      AS RESTRICTIVE
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END
$$;
