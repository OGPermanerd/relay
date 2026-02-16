CREATE TABLE IF NOT EXISTS work_artifacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  artifact_date TIMESTAMP NOT NULL,
  file_name TEXT,
  file_type TEXT,
  extracted_text TEXT,
  suggested_skill_ids TEXT[] DEFAULT '{}',
  estimated_hours_saved DOUBLE PRECISION,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX work_artifacts_user_id_idx ON work_artifacts(user_id);
CREATE INDEX work_artifacts_tenant_id_idx ON work_artifacts(tenant_id);
CREATE INDEX work_artifacts_user_date_idx ON work_artifacts(user_id, artifact_date);

ALTER TABLE work_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON work_artifacts
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
