-- Migration 0005: Enforce tenant_id constraints, foreign keys, composite uniques, indexes, and RLS
-- Depends on: 0004_backfill_tenant_id.sql (all rows must have tenant_id set)

-- Enforce NOT NULL on all tenant_id columns
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE skills ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ratings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE usage_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE skill_versions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE skill_embeddings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE skill_reviews ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE api_keys ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE site_settings ALTER COLUMN tenant_id SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE users ADD CONSTRAINT users_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE skills ADD CONSTRAINT skills_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE ratings ADD CONSTRAINT ratings_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE usage_events ADD CONSTRAINT usage_events_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE skill_versions ADD CONSTRAINT skill_versions_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE skill_embeddings ADD CONSTRAINT skill_embeddings_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE skill_reviews ADD CONSTRAINT skill_reviews_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE api_keys ADD CONSTRAINT api_keys_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE site_settings ADD CONSTRAINT site_settings_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);

-- Replace global unique constraints with composite unique constraints
-- Skills: slug is unique per tenant (not globally)
ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_slug_unique;
ALTER TABLE skills ADD CONSTRAINT skills_tenant_slug_unique UNIQUE (tenant_id, slug);

-- Skill embeddings: skill_id is unique per tenant
ALTER TABLE skill_embeddings DROP CONSTRAINT IF EXISTS skill_embeddings_skill_id_unique;
ALTER TABLE skill_embeddings ADD CONSTRAINT skill_embeddings_tenant_skill_unique UNIQUE (tenant_id, skill_id);

-- Skill reviews: skill_id is unique per tenant
ALTER TABLE skill_reviews DROP CONSTRAINT IF EXISTS skill_reviews_skill_id_unique;
ALTER TABLE skill_reviews ADD CONSTRAINT skill_reviews_tenant_skill_unique UNIQUE (tenant_id, skill_id);

-- Add tenant_id indexes for query performance
CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON users (tenant_id);
CREATE INDEX IF NOT EXISTS skills_tenant_id_idx ON skills (tenant_id);
CREATE INDEX IF NOT EXISTS ratings_tenant_id_idx ON ratings (tenant_id);
CREATE INDEX IF NOT EXISTS usage_events_tenant_id_idx ON usage_events (tenant_id);
CREATE INDEX IF NOT EXISTS skill_versions_tenant_id_idx ON skill_versions (tenant_id);
CREATE INDEX IF NOT EXISTS skill_embeddings_tenant_id_idx ON skill_embeddings (tenant_id);
CREATE INDEX IF NOT EXISTS skill_reviews_tenant_id_idx ON skill_reviews (tenant_id);
CREATE INDEX IF NOT EXISTS api_keys_tenant_id_idx ON api_keys (tenant_id);
CREATE INDEX IF NOT EXISTS site_settings_tenant_id_idx ON site_settings (tenant_id);

-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- NOTE: FORCE RLS is intentionally omitted during single-tenant phase.
-- The app connects as table owner, so RLS is bypassed by default (ENABLE without FORCE).
-- Phase 26+ will introduce a dedicated app role that is NOT the table owner,
-- at which point ENABLE RLS will enforce policies automatically.

-- Create RLS policies for tenant isolation
-- Policy: rows are visible/writable only when tenant_id matches the session variable
CREATE POLICY tenant_isolation ON users FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON skills FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON ratings FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON usage_events FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON skill_versions FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON skill_embeddings FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON skill_reviews FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON api_keys FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON site_settings FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
