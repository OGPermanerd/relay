-- Migration: Add email_diagnostics table
-- Date: 2026-02-14
-- Description: Aggregate-only email analysis results (no individual email metadata)

CREATE TABLE IF NOT EXISTS email_diagnostics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scan_period_days INTEGER NOT NULL,
  total_messages INTEGER NOT NULL,
  estimated_hours_per_week INTEGER NOT NULL,
  category_breakdown JSONB NOT NULL,
  pattern_insights JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS email_diagnostics_user_id_idx ON email_diagnostics(user_id);
CREATE INDEX IF NOT EXISTS email_diagnostics_tenant_id_idx ON email_diagnostics(tenant_id);
CREATE INDEX IF NOT EXISTS email_diagnostics_scan_date_idx ON email_diagnostics(scan_date);

-- Enable RLS for tenant isolation
ALTER TABLE email_diagnostics ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (restrictive, for all operations)
CREATE POLICY tenant_isolation ON email_diagnostics
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- Table and column comments
COMMENT ON TABLE email_diagnostics IS 'Aggregate email analysis results. Does NOT store individual email metadata -- only computed statistics per scan.';
COMMENT ON COLUMN email_diagnostics.category_breakdown IS 'Array of {category, count, percentage, estimatedMinutes} -- aggregate stats only, no individual email data';
COMMENT ON COLUMN email_diagnostics.pattern_insights IS '{busiestHour, busiestDayOfWeek, averageResponseTimeHours, threadDepthAverage} -- behavioral patterns, no individual email data';
COMMENT ON COLUMN email_diagnostics.estimated_hours_per_week IS 'Stored as tenths (e.g., 125 = 12.5 hours) to avoid floating point precision issues';
