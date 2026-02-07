-- Backfill all existing rows with the default tenant ID
-- WHERE tenant_id IS NULL makes this idempotent (safe to re-run)
UPDATE users SET tenant_id = 'default-tenant-000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE skills SET tenant_id = 'default-tenant-000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE ratings SET tenant_id = 'default-tenant-000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE usage_events SET tenant_id = 'default-tenant-000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE skill_versions SET tenant_id = 'default-tenant-000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE skill_embeddings SET tenant_id = 'default-tenant-000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE skill_reviews SET tenant_id = 'default-tenant-000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE api_keys SET tenant_id = 'default-tenant-000-0000-000000000000' WHERE tenant_id IS NULL;
UPDATE site_settings SET tenant_id = 'default-tenant-000-0000-000000000000' WHERE tenant_id IS NULL;
