CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX user_preferences_tenant_id_idx ON user_preferences(tenant_id);
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_preferences
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
