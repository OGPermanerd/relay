CREATE TABLE IF NOT EXISTS user_skill_views (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  last_viewed_version INTEGER,
  view_count INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX user_skill_views_tenant_user_skill_unique ON user_skill_views(tenant_id, user_id, skill_id);
CREATE INDEX user_skill_views_user_id_idx ON user_skill_views(user_id);
CREATE INDEX user_skill_views_skill_id_idx ON user_skill_views(skill_id);
CREATE INDEX user_skill_views_tenant_id_idx ON user_skill_views(tenant_id);
CREATE INDEX user_skill_views_user_viewed_idx ON user_skill_views(user_id, last_viewed_at);

ALTER TABLE user_skill_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_skill_views
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
