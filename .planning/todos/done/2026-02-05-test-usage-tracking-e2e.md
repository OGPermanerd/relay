---
created: 2026-02-05T13:15
title: Test usage tracking end-to-end with Corporate Document Branding skill
area: testing
files:
  - apps/mcp/src/tools/deploy.ts
  - apps/mcp/src/auth.ts
  - apps/mcp/src/tracking/events.ts
  - packages/db/src/services/skill-metrics.ts
---

## Problem

The Corporate Document Branding skill (ID: a88232fd-80e9-4e2c-90fe-28e5c4bca703, slug: corporate-document-branding) was created to test the Phase 20+21 usage tracking pipeline. Need to verify the full loop:

1. Install skill via MCP `deploy_skill` on Windows Claude Desktop
2. Verify `usage_events` row created with correct `skillId` and `userId`
3. Verify `skills.totalUses` counter increments
4. Confirm `userId` attribution works when `RELAY_API_KEY` is set
5. After Phase 22 ships: repeat test via web Claude (Streamable HTTP transport)

## Solution

Manual testing steps:
- Generate API key from profile page
- Set `RELAY_API_KEY` in MCP config
- Use MCP to `deploy_skill` the brand skill
- Query DB to verify usage_events and totalUses
- Test anonymous mode (no key) to confirm graceful degradation
- After Phase 22: test same flow from Claude.ai browser
