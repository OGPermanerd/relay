-- Migration: Create skill_feedback table
-- Date: 2026-02-15
-- Description: User feedback on skills - supports thumbs, suggestions, training examples, bug reports

CREATE TABLE IF NOT EXISTS skill_feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  skill_version_id TEXT REFERENCES skill_versions(id),
  user_id TEXT REFERENCES users(id),
  usage_event_id TEXT,
  feedback_type TEXT NOT NULL,
  sentiment INTEGER,
  comment TEXT,
  suggested_content TEXT,
  suggested_diff TEXT,
  example_input TEXT,
  example_output TEXT,
  expected_output TEXT,
  quality_score INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  source TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS skill_feedback_skill_id_idx ON skill_feedback(skill_id);
CREATE INDEX IF NOT EXISTS skill_feedback_user_id_idx ON skill_feedback(user_id);
CREATE INDEX IF NOT EXISTS skill_feedback_tenant_id_idx ON skill_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS skill_feedback_feedback_type_idx ON skill_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS skill_feedback_status_idx ON skill_feedback(status);

-- Enable RLS for tenant isolation
ALTER TABLE skill_feedback ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'skill_feedback' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON skill_feedback
      AS RESTRICTIVE
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;
