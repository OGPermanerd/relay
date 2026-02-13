-- Migration: Create search_queries table for search analytics
-- Tracks every search query for gap analysis and trending queries

CREATE TABLE IF NOT EXISTS search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT REFERENCES users(id),
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  search_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS search_queries_tenant_id_idx ON search_queries(tenant_id);
CREATE INDEX IF NOT EXISTS search_queries_created_at_idx ON search_queries(created_at);
CREATE INDEX IF NOT EXISTS search_queries_normalized_query_idx ON search_queries(normalized_query);

-- Enable row-level security
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (restrictive)
CREATE POLICY tenant_isolation ON search_queries
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
