CREATE TABLE IF NOT EXISTS skill_communities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  community_id INTEGER NOT NULL,
  modularity REAL NOT NULL,
  detected_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  run_id TEXT
);

CREATE UNIQUE INDEX skill_communities_tenant_skill_unique ON skill_communities(tenant_id, skill_id);
CREATE INDEX skill_communities_tenant_id_idx ON skill_communities(tenant_id);
CREATE INDEX skill_communities_community_id_idx ON skill_communities(tenant_id, community_id);

ALTER TABLE skill_communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON skill_communities
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
