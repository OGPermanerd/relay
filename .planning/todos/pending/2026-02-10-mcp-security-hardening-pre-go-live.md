---
created: 2026-02-10T11:26:21.035Z
title: MCP security hardening for go-live
area: security
files:
  - apps/mcp/src/auth.ts
  - apps/mcp/src/tools/index.ts
  - docker/Caddyfile
  - ecosystem.config.cjs
---

## Problem

The MCP server is publicly accessible with no defense-in-depth. Before go-live, need to:
- Hide origin IP behind Cloudflare (currently DNS points directly to VPS at 178.156.181.178)
- No audit logging on MCP tool invocations (who called what, when)
- Write tools (update_skill, submit_for_review, etc.) are accessible from the public internet — should be restricted to Tailscale-only access

## Solution

1. **Audit logging middleware** — Add middleware to the MCP server that logs every tool invocation (tool name, userId, timestamp, IP, result status). Wire into existing `writeAuditLog()` from `packages/db/src/services/audit.ts`.

2. **REMOTE_MODE=readonly flag** — When MCP is accessed via the public domain (not Tailscale), disable write tools. Implement as a tool ACL that checks request origin:
   - Public domain access → read-only tools only (search_skills, recommend_skills, describe_skill, guide_skill, check_skill_status, check_review_status)
   - Tailscale access → all tools available including write operations (update_skill, submit_for_review, review_skill, log_skill_usage)

3. **Update ALLOWED_HOSTS** — Ensure MCP server validates Host header against allowlist.

4. **DNS/Cloudflare setup** (manual/infra) — Point domain through Cloudflare for WAF, rate limiting, DDoS protection. Origin IP hidden. User handles registrar/DNS side.

**Result:** Write operations physically impossible from the internet, full audit trail, origin IP hidden behind Cloudflare.
