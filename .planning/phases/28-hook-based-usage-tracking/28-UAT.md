---
status: complete
phase: 28-hook-based-usage-tracking
source: 28-01-SUMMARY.md, 28-02-SUMMARY.md, 28-03-SUMMARY.md, 28-04-SUMMARY.md, 28-05-SUMMARY.md, 28-06-SUMMARY.md, 28-07-SUMMARY.md
started: 2026-02-08T04:50:00Z
updated: 2026-02-08T04:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Tracking endpoint rejects unauthenticated requests
expected: POST /api/track without Bearer token returns 401 {"error":"Missing authorization"}
result: pass

### 2. Tracking endpoint rejects invalid API keys
expected: POST /api/track with invalid Bearer token returns 401 {"error":"Invalid key"}
result: pass

### 3. API key validation returns tenantId and soft expiry
expected: validateApiKey returns {userId, keyId, tenantId, isExpired} — expired keys pass with isExpired:true instead of being rejected
result: pass

### 4. Hook frontmatter injection in skill publishing
expected: Published skills contain PostToolUse hook section in YAML frontmatter with curl to /api/track, HMAC signing, and retry logic
result: pass

### 5. MCP deploy injects hooks for skills without them
expected: MCP deploy tool checks for existing hooks and injects tracking frontmatter if missing
result: pass

### 6. log_skill_usage is deprecated
expected: MCP log_skill_usage tool is marked [DEPRECATED] with message directing to PostToolUse hooks
result: pass

### 7. Per-tenant key expiry configuration
expected: site_settings table has keyExpiryDays column with default 90 days
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
