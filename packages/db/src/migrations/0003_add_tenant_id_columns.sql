-- Add nullable tenant_id to all 9 data tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE skill_versions ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE skill_embeddings ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE skill_reviews ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS tenant_id text;
