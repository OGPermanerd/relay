# Data Pipeline Validator

Validate data pipeline outputs for correctness, completeness, and consistency before they reach downstream consumers.

## Purpose
Run comprehensive validation checks on data pipeline outputs to catch issues before they propagate to dashboards, ML models, or customer-facing features.

## Inputs
- **Pipeline Name**: {{pipeline}}
- **Data Source**: {{source}} (database table / S3 path / API endpoint)
- **Expected Schema**: {{schema}} (column names, types, constraints)
- **Run Date**: {{date}} (the pipeline execution date to validate)
- **Previous Run**: {{previous}} (for comparison — optional)
- **SLA**: {{sla}} (when downstream consumers need this data)

## Validation Checks

### 1. Schema Validation
```
- All expected columns present
- Column types match specification
- No unexpected new columns (schema drift detection)
- Nullable columns are correctly marked
- Primary key uniqueness verified
```

### 2. Volume Checks
```
- Row count within expected range (±20% of historical average)
- Row count vs. previous run (flag significant changes)
- No empty partitions that should have data
- File size within expected bounds
```

### 3. Freshness Checks
```
- Most recent timestamp within expected window
- No gaps in time series data
- Pipeline completed before SLA deadline
- Source data freshness (was input data current?)
```

### 4. Data Quality Checks
```
- Null rate per column (flag if exceeds threshold)
- Duplicate detection on key columns
- Referential integrity (foreign keys valid)
- Value range validation (amounts > 0, dates in range, enums valid)
- Statistical distribution check (mean, stddev within 3 sigma of historical)
```

### 5. Business Logic Checks
```
- Aggregations match source totals (reconciliation)
- Calculated fields produce valid results
- Cross-table consistency (e.g., orders match line items)
- Business rule compliance (e.g., no future dates, valid status transitions)
```

### 6. Comparison Checks
```
- Delta vs. previous run (new, changed, deleted records)
- Trend analysis (is this run consistent with recent history?)
- Cross-environment comparison (staging vs. production match)
```

## Output Report

### Summary
- **Status**: PASS / WARN / FAIL
- **Run Time**: Pipeline duration
- **Records Processed**: Count
- **Issues Found**: Count by severity

### Detailed Findings
For each issue:
- **Check**: Which validation failed
- **Severity**: CRITICAL / WARNING / INFO
- **Details**: Specific records, columns, or values affected
- **Impact**: What downstream consumers would be affected
- **Suggested Action**: How to investigate or fix

### Historical Context
- Trend chart of key metrics over last 30 runs
- Alert history (when did this check last fail?)

## Alerting Rules
- CRITICAL: Pipeline fails, block downstream consumers, page on-call
- WARNING: Anomaly detected, notify pipeline owner, continue processing
- INFO: Log for audit trail, no action needed

## Integration
This validator can be integrated as:
- Post-pipeline step in Airflow/Dagster/Prefect
- Standalone validation job triggered on schedule
- Pre-publish gate before data reaches production tables
