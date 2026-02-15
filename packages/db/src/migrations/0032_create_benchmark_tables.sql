-- Migration: Create benchmark_runs and benchmark_results tables
-- Date: 2026-02-15
-- Description: Benchmark execution tracking - runs compare skills across models, results track per-test-case output

-- benchmark_runs: tracks benchmark execution sessions
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  skill_version_id TEXT REFERENCES skill_versions(id),
  triggered_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  models TEXT[] NOT NULL,
  best_model TEXT,
  best_quality_score INTEGER,
  cheapest_model TEXT,
  cheapest_cost_microcents INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

-- Indexes for benchmark_runs
CREATE INDEX IF NOT EXISTS benchmark_runs_skill_id_idx ON benchmark_runs(skill_id);
CREATE INDEX IF NOT EXISTS benchmark_runs_tenant_id_idx ON benchmark_runs(tenant_id);
CREATE INDEX IF NOT EXISTS benchmark_runs_status_idx ON benchmark_runs(status);

-- Enable RLS for benchmark_runs
ALTER TABLE benchmark_runs ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy for benchmark_runs (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'benchmark_runs' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON benchmark_runs
      AS RESTRICTIVE
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- benchmark_results: individual test case results within a benchmark run
CREATE TABLE IF NOT EXISTS benchmark_results (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  benchmark_run_id TEXT NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  test_case_index INTEGER NOT NULL,
  input_used TEXT,
  output_produced TEXT,
  expected_output TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER,
  estimated_cost_microcents INTEGER,
  quality_score INTEGER,
  quality_notes TEXT,
  matches_expected BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

-- Indexes for benchmark_results
CREATE INDEX IF NOT EXISTS benchmark_results_benchmark_run_id_idx ON benchmark_results(benchmark_run_id);
CREATE INDEX IF NOT EXISTS benchmark_results_model_name_idx ON benchmark_results(model_name);
CREATE INDEX IF NOT EXISTS benchmark_results_tenant_id_idx ON benchmark_results(tenant_id);

-- Enable RLS for benchmark_results
ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy for benchmark_results (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'benchmark_results' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON benchmark_results
      AS RESTRICTIVE
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;
