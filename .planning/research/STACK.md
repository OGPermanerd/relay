# Technology Stack: v1.4 Employee Analytics, MCP Authentication & Remote MCP

**Project:** Relay v1.4 - Employee Analytics & Remote MCP
**Researched:** 2026-02-05
**Scope:** Stack additions for per-employee MCP tracking, org API keys, usage analytics dashboard, install callback tracking, web remote MCP via Streamable HTTP, extended search
**Confidence:** HIGH (verified via npm registry, official SDK docs, MCP spec, and community patterns)

---

## Executive Summary

v1.4 requires four capabilities not currently in the stack:

### 1. MCP Authentication (Employee Identity)
**Use `mcp-handler` ^1.0.7 with `withMcpAuth`** to add bearer token authentication to the remote MCP endpoint. For the local stdio server, pass a `RELAY_API_KEY` environment variable that the server resolves to a userId via a lightweight HTTP call. API keys are generated per-employee in the web app and stored in a new `api_keys` table.

### 2. Remote MCP via Streamable HTTP
**Use `mcp-handler` ^1.0.7** to host a Streamable HTTP MCP endpoint inside the existing Next.js app at `app/api/[transport]/route.ts`. This avoids spinning up a separate Express server and reuses the existing Next.js infrastructure, database connection, and auth middleware. Claude.ai web users connect to `https://relay.company.com/api/mcp`.

### 3. Analytics Dashboard (Charts)
**Use `recharts` ^3.7.0** for usage visualization. Recharts is already the de facto standard for React dashboards, uses SVG rendering, and the project already has a dependency on `react-sparklines` (which Recharts can replace). All chart components require `"use client"` -- data is fetched in Server Components and passed as props.

### 4. Install Callback Tracking
**No new library needed.** Add a `confirm_install` MCP tool that the deploy_skill tool's response instructs Claude to call after saving the file. This creates a two-step tracking flow: deploy_skill logs intent, confirm_install logs completion with employee attribution.

---

## Stack Additions

### Required New Dependencies

| Library | Version | Package | Purpose | Why |
|---------|---------|---------|---------|-----|
| **mcp-handler** | ^1.0.7 | `apps/web` | Streamable HTTP MCP in Next.js route handlers + auth wrapper | Vercel's official adapter. Handles transport plumbing, works natively with App Router `route.ts`. Includes `withMcpAuth` for bearer token validation. Actively maintained (last release Jan 9, 2026). |
| **recharts** | ^3.7.0 | `apps/web` | Usage analytics charts (bar, line, area) | Most popular React charting lib (24.8k GitHub stars). SVG-based, composable React components. Works with Tailwind CSS. Used under the hood by shadcn/ui and Tremor. |

### Existing Dependencies to Upgrade

| Library | Current | Target | Why |
|---------|---------|--------|-----|
| **@modelcontextprotocol/sdk** | ^1.25.0 (installed: 1.25.3) | ^1.26.0 | Latest stable. Required as peer dep by mcp-handler. Includes StreamableHTTPServerTransport improvements. |

### Required Database Changes

| Change | Purpose | Migration |
|--------|---------|-----------|
| **`api_keys` table** | Store per-employee API keys for MCP auth | New table with `id`, `userId` FK, `keyHash` (SHA-256), `keyPrefix` (first 8 chars for display), `name`, `lastUsedAt`, `createdAt`, `revokedAt` |
| **`usage_events.userId` population** | Actually fill the existing nullable userId column | Application logic change (not schema) -- trackUsage receives userId from auth context |

### Installation Commands

```bash
# In apps/web
cd apps/web && pnpm add mcp-handler recharts

# Upgrade MCP SDK in apps/mcp
cd apps/mcp && pnpm add @modelcontextprotocol/sdk@^1.26.0
```

### Environment Variables

```bash
# No new environment variables needed for v1.4
# API keys are generated and stored in the database
# The existing DATABASE_URL, AUTH_SECRET, etc. are sufficient
```

---

## Feature-Specific Stack Recommendations

### 1. MCP Authentication (Employee Identity in MCP Sessions)

**Problem:** The current MCP server runs as a local stdio process. `trackUsage()` inserts events but never populates `userId`. There is no way to know which employee invoked which tool.

**Solution: Two authentication paths, one API key table.**

#### Path A: Remote MCP (Claude.ai web, API clients)

Use `mcp-handler`'s `withMcpAuth` wrapper. The bearer token is the employee's API key. The handler validates it against the database and injects `authInfo` into tool handlers.

```typescript
// apps/web/app/api/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";

const handler = withMcpAuth(
  createMcpHandler(
    (server, { authInfo }) => {
      server.registerTool("search_skills", {
        // ... schema
      }, async (params) => {
        // authInfo.extra.userId available here
        await trackUsage({
          toolName: "search_skills",
          userId: authInfo?.extra?.userId,
          metadata: { query: params.query },
        });
        // ... tool logic
      });
    },
    {},
    { basePath: "/api", maxDuration: 30 }
  ),
  {
    verifyToken: async (req, bearer) => {
      if (!bearer) return undefined; // Allow unauthenticated for now
      const apiKey = await validateApiKey(bearer); // DB lookup by hash
      if (!apiKey) return undefined;
      return {
        token: bearer,
        clientId: apiKey.userId,
        scopes: ["tools"],
        extra: { userId: apiKey.userId, keyId: apiKey.id },
      };
    },
  }
);

export { handler as GET, handler as POST, handler as DELETE };
```

#### Path B: Local stdio MCP (Claude Code, Claude Desktop)

The stdio server cannot do HTTP bearer auth. Instead, read `RELAY_API_KEY` from the environment (set during install), make a one-time HTTP call to validate it, and cache the userId for the session.

```typescript
// apps/mcp/src/auth.ts
let cachedUserId: string | null = null;

export async function resolveUserId(): Promise<string | null> {
  if (cachedUserId !== null) return cachedUserId;

  const apiKey = process.env.RELAY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${process.env.RELAY_URL}/api/auth/validate-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey }),
    });
    if (res.ok) {
      const data = await res.json();
      cachedUserId = data.userId;
      return cachedUserId;
    }
  } catch {
    // Offline or server unreachable -- degrade gracefully
    console.error("Could not validate API key, tracking without userId");
  }
  return null;
}
```

The MCP config becomes:
```json
{
  "mcpServers": {
    "relay": {
      "command": "npx",
      "args": ["@relay/mcp"],
      "env": {
        "DATABASE_URL": "...",
        "RELAY_API_KEY": "rlk_abc123...",
        "RELAY_URL": "https://relay.company.com"
      }
    }
  }
}
```

#### API Key Design

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Format | `rlk_` prefix + 32 random bytes (base62) | Prefix identifies Relay keys in logs; base62 avoids URL-encoding issues |
| Storage | SHA-256 hash only, prefix stored for display | Never store plaintext keys. Show `rlk_abc1...` in UI. |
| Rotation | Revoke + create new | Simpler than key rotation; employees can have multiple active keys |
| Scope | Per-employee, full MCP access | No fine-grained scopes needed for internal tool |
| Generation | Server Action in web app | Authenticated endpoint, returns key once on creation |

**Why NOT full OAuth 2.1:**
- This is an internal tool behind Google Workspace SSO
- All employees are already authenticated via Auth.js
- API keys are generated within the authenticated web app
- OAuth adds complexity (authorization server, token refresh, PKCE) with no benefit for an internal single-org tool
- If Relay ever becomes multi-tenant or external-facing, upgrade to OAuth then

### 2. Remote MCP via Streamable HTTP

**Problem:** The MCP server only supports stdio transport. Claude.ai web and other HTTP-based clients cannot connect.

**Solution: Add a Streamable HTTP endpoint inside the Next.js app.**

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Framework adapter | `mcp-handler` ^1.0.7 | Works with Next.js App Router route handlers natively. No Express needed. Handles POST/GET/DELETE for MCP protocol. |
| Endpoint | `/api/mcp` (via `app/api/[transport]/route.ts`) | Standard pattern from Vercel's docs. The `[transport]` dynamic segment handles `/api/mcp` and `/api/sse` (backward compat). |
| Session mode | Stateless (`sessionIdGenerator: undefined`) | Simpler. No session state to manage. Each request is independent. Works with serverless. |
| Auth | Bearer token (API key) via `withMcpAuth` | Employees paste their API key into Claude.ai's custom connector settings. |
| Tools | Shared with stdio server | Extract tool definitions into `packages/core` or shared module. Both stdio and HTTP servers register the same tools. |

**Architecture: Tool code reuse between stdio and HTTP servers**

```
packages/core/src/mcp-tools/    <-- shared tool definitions
  search.ts                      (pure functions, no transport dependency)
  list.ts
  deploy.ts
  confirm-install.ts

apps/mcp/src/index.ts            <-- stdio entry point
  imports from @relay/core/mcp-tools
  registers with StdioServerTransport

apps/web/app/api/[transport]/    <-- HTTP entry point
  route.ts
  imports from @relay/core/mcp-tools
  registers with mcp-handler
```

**Claude.ai Connection:**
1. Employee navigates to Claude.ai Settings > Integrations
2. Adds custom connector: Transport = "Streamable HTTP", URL = `https://relay.company.com/api/mcp`
3. Enters API key as bearer token
4. Claude.ai can now use relay search/deploy tools

**Why `mcp-handler` over raw `StreamableHTTPServerTransport`:**
- Next.js App Router uses Web `Request`/`Response` API, not Node.js `IncomingMessage`/`ServerResponse`
- `StreamableHTTPServerTransport.handleRequest()` expects Node.js types
- `mcp-handler` bridges this gap automatically
- Includes `withMcpAuth` for bearer token validation
- Handles protocol negotiation (Streamable HTTP vs SSE fallback)

**Why NOT a separate Express server:**
- Adds infrastructure complexity (separate process, port, deployment)
- Cannot reuse Next.js database connection pool
- Cannot reuse Auth.js session validation
- Separate CORS configuration needed
- The existing MCP server (`apps/mcp`) stays as the stdio entry point; the web app becomes the HTTP entry point

**Concern: `mcp-handler` depends on `redis`**
- Redis is a direct dependency but only used for session storage in stateful mode
- In stateless mode (our use case), Redis is never connected to
- Bundle size impact is minimal since it's server-side only
- If this becomes a concern, we can vendor just the route handler logic (~200 lines)

### 3. Analytics Dashboard (Charts)

**Problem:** No visualization for per-employee usage data. The `usage_events` table has data but no way to display trends, breakdowns, or comparisons.

**Solution: Recharts for chart components, Server Components for data fetching.**

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Chart library | `recharts` ^3.7.0 | Most popular React chart lib. SVG-based, composable. Used by shadcn/ui and Tremor under the hood. |
| Chart types needed | AreaChart (usage over time), BarChart (top skills/employees), simple stats cards | Covers the analytics dashboard requirements without exotic chart types |
| Rendering | Client-side (`"use client"`) | All chart libs require browser APIs. Data fetched in Server Component, passed as props. |
| Replace `react-sparklines`? | Yes, migrate sparklines to Recharts | Consolidate on one charting library. Recharts `<Sparkline>` equivalent is a simple `<AreaChart>` with minimal config. |

**Dashboard data flow:**
```
Server Component (page.tsx)
  -> SQL queries via Drizzle (aggregate usage_events by employee, skill, time)
  -> Pass serialized data as props

Client Component (charts.tsx "use client")
  -> Recharts <AreaChart>, <BarChart>, etc.
  -> Responsive, interactive, tooltips
```

**Chart components needed:**
```typescript
// Usage over time (area chart)
<UsageOverTimeChart data={dailyUsageCounts} />

// Top skills by usage (horizontal bar)
<TopSkillsChart data={topSkillsByUses} />

// Per-employee usage breakdown (bar chart)
<EmployeeUsageChart data={employeeUsageCounts} />

// Hours saved over time (area chart)
<HoursSavedChart data={hoursSavedByWeek} />
```

**Why Recharts over alternatives:**

| Library | Decision | Reason |
|---------|----------|--------|
| **Recharts** | USE | Most popular, composable React API, SVG, great docs, 3.x is current |
| **Tremor** | SKIP | Uses Recharts internally. Adds Radix UI dependency for components we don't need. Dashboard-in-a-box is more than we need. |
| **Chart.js / react-chartjs-2** | SKIP | Canvas-based (harder to style with Tailwind). Less composable. |
| **shadcn/ui Charts** | SKIP | Uses Recharts. Would require adding shadcn/ui (class-variance-authority, @radix-ui) to the project which currently uses plain Tailwind. |
| **Nivo** | SKIP | Heavier. Better for exotic chart types we don't need. |
| **D3 directly** | SKIP | Too low-level for standard dashboard charts. |

### 4. Install Callback Tracking

**Problem:** `deploy_skill` tracks that a skill was requested, but not whether the file was actually saved. Need to know install completion per employee.

**Solution: Add a `confirm_install` MCP tool. No new library needed.**

The `deploy_skill` tool's response already includes `instructions` telling Claude what to do. Add an instruction: "After saving the file, call confirm_install to record the successful installation."

```typescript
// In deploy_skill response:
{
  instructions: [
    "Save this skill to your project's .claude/skills/ directory",
    "Suggested path: .claude/skills/${skill.slug}.md",
    "After saving, call confirm_install with the skill ID to record the installation"
  ]
}

// New tool:
server.registerTool("confirm_install", {
  description: "Record that a skill was successfully installed. Call this after saving a deployed skill file.",
  inputSchema: {
    skillId: z.string().describe("Skill ID that was installed"),
    platform: z.enum(["claude-code", "claude-desktop", "claude-web", "vscode", "other"]).optional(),
  },
}, async ({ skillId, platform }) => {
  const userId = await resolveUserId(); // or authInfo from HTTP
  await trackUsage({
    toolName: "confirm_install",
    skillId,
    userId,
    metadata: { platform: platform || "unknown", confirmedAt: new Date().toISOString() },
  });
  return { content: [{ type: "text", text: "Installation recorded." }] };
});
```

**Why NOT a webhook/HTTP callback:**
- Adds complexity (server endpoint, CORS, auth for callback)
- MCP tools already have a bidirectional communication channel
- Claude follows instructions to call confirm_install after saving
- Clean event chain: deploy_skill (intent) -> confirm_install (completion)

**Why NOT npm postinstall scripts:**
- Skills aren't npm packages
- Skills are markdown files saved by Claude
- No package manager lifecycle hooks available

---

## What NOT to Add

| Library/Approach | Why NOT | Use Instead |
|------------------|---------|-------------|
| **Full OAuth 2.1 server** | Internal tool, employees already authenticated via Google SSO. OAuth adds authorization server, token refresh, PKCE complexity with zero benefit for single-org internal use. | Simple API keys validated against DB hash |
| **`@vercel/mcp-adapter`** | Dormant since July 2025 (v1.0.0). Superseded by `mcp-handler` from the same team. | `mcp-handler` ^1.0.7 |
| **Express.js** | Not needed. `mcp-handler` bridges MCP SDK to Next.js route handlers. Adding Express creates a separate server process. | `mcp-handler` in Next.js route handler |
| **`@modelcontextprotocol/express`** | Middleware packages from SDK monorepo not yet published to npm (as of 2026-02-05). | `mcp-handler` (published, tested) |
| **Tremor** | Dashboard-in-a-box. Pulls in Radix UI, adds abstraction layer over Recharts. Overkill for 4 chart components. | `recharts` directly |
| **shadcn/ui Charts** | Would require adding shadcn/ui framework (class-variance-authority, @radix-ui, cn() utility) to a project that uses plain Tailwind. | `recharts` directly |
| **Redis** | `mcp-handler` lists Redis as a dependency but only uses it for stateful session storage. Our stateless mode never connects. No need to provision Redis infrastructure. | Stateless MCP endpoint (no session storage) |
| **Segment / Mixpanel / analytics SDKs** | Usage data stays in our PostgreSQL. No reason to send internal skill usage to third-party analytics. | Drizzle queries on `usage_events` table |
| **Separate analytics database** | `usage_events` table with PostgreSQL aggregate queries handles enterprise scale (500 employees, ~50k events/month). | PostgreSQL with time-bucket queries |
| **JWT API keys** | JWTs are verifiable without DB lookup, but we want revocation capability. DB lookup on every MCP call is fine for our scale. | Hashed API keys in PostgreSQL |

---

## Integration with Existing Stack

### Database Integration (Drizzle ORM)

New `api_keys` table schema:
```typescript
// packages/db/src/schema/api-keys.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),    // SHA-256 of full key
  keyPrefix: text("key_prefix").notNull(),          // First 8 chars for display "rlk_abc1..."
  name: text("name").notNull().default("Default"),  // User-assigned name
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),               // null = active
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
```

Migration:
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP
);
CREATE INDEX api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX api_keys_key_hash_idx ON api_keys(key_hash);
```

### MCP Tool Code Sharing

Currently tools are defined in `apps/mcp/src/tools/`. For v1.4, extract tool logic to be importable by both transports:

```
Before (v1.3):
  apps/mcp/src/tools/search.ts   -- tool logic + server.registerTool
  apps/mcp/src/tools/deploy.ts   -- tool logic + server.registerTool

After (v1.4):
  packages/core/src/mcp-tools/search.ts   -- pure function handleSearchSkills()
  packages/core/src/mcp-tools/deploy.ts   -- pure function handleDeploySkill()
  packages/core/src/mcp-tools/confirm-install.ts

  apps/mcp/src/tools/index.ts    -- imports from @relay/core, registers with stdio server
  apps/web/app/api/[transport]/route.ts  -- imports from @relay/core, registers with mcp-handler
```

### Auth.js Integration

API key generation is a Server Action requiring Auth.js session:
```typescript
"use server";
import { auth } from "@/auth";
import { db } from "@relay/db";
import { apiKeys } from "@relay/db/schema/api-keys";
import { randomBytes, createHash } from "crypto";

export async function generateApiKey(name: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rawKey = `rlk_${randomBytes(32).toString("base62")}`;  // pseudo; use base62 encoding
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 12);

  await db.insert(apiKeys).values({
    userId: session.user.id,
    keyHash,
    keyPrefix,
    name,
  });

  return rawKey; // Return once, never stored in plaintext
}
```

### Existing Sparkline Migration

Replace `react-sparklines` with Recharts for consistency:
```typescript
// Before (apps/web/components/sparkline.tsx)
import { Sparklines, SparklinesLine } from "react-sparklines";

// After
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export function Sparkline({ data, width = 60, height = 20, color = "#3b82f6" }) {
  const chartData = data.map((value, index) => ({ index, value }));
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer>
        <AreaChart data={chartData}>
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.1} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Then remove `react-sparklines` and `@types/react-sparklines` from `apps/web/package.json`.

---

## Version Compatibility Matrix

| Package | Version | Requires | Compatible With | Notes |
|---------|---------|----------|-----------------|-------|
| mcp-handler | ^1.0.7 | Next.js >=13, @modelcontextprotocol/sdk 1.25.2 (peer) | Next.js 16.1.6 (our version) | Peer dep pins SDK 1.25.2 but works with 1.26.0 |
| @modelcontextprotocol/sdk | ^1.26.0 | Node 18+, zod ^3 | Our Node 22, zod 3.25 | Latest stable, published 2026-02-04 |
| recharts | ^3.7.0 | React 16-19 | Our React 19 | SVG-based, no DOM manipulation conflicts |
| drizzle-orm | ^0.38.0 | postgres driver | No upgrade needed | Custom types work for api_keys table |

---

## Bundle Impact Assessment

| Addition | Runtime | Client Bundle Impact | Notes |
|----------|---------|---------------------|-------|
| mcp-handler | Server only (API route) | 0kb | Route handler, never imported client-side |
| recharts | Client (charts) | ~45kb gzipped | Only loaded on analytics dashboard page. Tree-shakeable. |
| New API routes | Server only | 0kb | /api/[transport], /api/auth/validate-key |
| **Net client impact** | | **~45kb** | **Only on /analytics page (code-split)** |

---

## Cost Estimates

| Resource | Usage Estimate | Monthly Cost |
|----------|---------------|--------------|
| API key storage | 500 employees * 1.2 avg keys | ~600 rows, negligible |
| Usage events growth | 500 employees * 100 events/month | ~50k rows/month, negligible at PostgreSQL scale |
| Streamable HTTP MCP | Standard HTTP requests | $0 (self-hosted) |
| Recharts | Client-side library | $0 |
| **Total new costs** | | **$0** (no new external services) |

---

## Implementation Priority

| Feature | Dependencies | Priority | Complexity |
|---------|--------------|----------|------------|
| **API keys table + generation** | Schema migration | HIGH | Low -- standard CRUD |
| **MCP auth (stdio path)** | API keys table | HIGH | Low -- env var + HTTP validation |
| **Remote MCP endpoint** | mcp-handler, tool extraction | HIGH | Medium -- route setup, tool sharing |
| **MCP auth (HTTP path)** | Remote MCP endpoint, API keys | HIGH | Low -- withMcpAuth wrapper |
| **confirm_install tool** | MCP auth | MEDIUM | Low -- simple tool registration |
| **Analytics dashboard** | recharts, userId population | MEDIUM | Medium -- SQL aggregates, chart components |
| **Extended search** | None (SQL changes only) | LOW | Low -- add author/tags to WHERE clause |
| **Sparkline migration** | recharts | LOW | Low -- swap component, remove old dep |

**Recommended implementation order:**
1. API keys schema + generation UI (foundation for everything else)
2. MCP auth for stdio (populate userId immediately)
3. Remote MCP endpoint with auth (enables Claude.ai web access)
4. confirm_install tool (install tracking)
5. Analytics dashboard (visualize the data flowing from steps 1-4)
6. Extended search (independent, simple)

---

## Sources

**HIGH Confidence (Official Documentation / npm Registry):**
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- v1.26.0, StreamableHTTPServerTransport, middleware packages
- [MCP Transports Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) -- Streamable HTTP protocol definition
- [mcp-handler GitHub](https://github.com/vercel/mcp-handler) -- v1.0.7, createMcpHandler, withMcpAuth API
- [Recharts](https://recharts.org/) -- v3.7.0, React charting components
- [Claude.ai Custom Connectors](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers) -- Remote MCP setup in Claude.ai web
- npm registry -- Verified all package versions via `npm view` (2026-02-05)

**MEDIUM Confidence (Verified Patterns):**
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization) -- OAuth 2.1 standard, bearer token flow
- [Auth0 MCP Security Blog](https://auth0.com/blog/mcp-streamable-http/) -- Streamable HTTP security benefits over SSE
- [Vercel MCP Template](https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js) -- Next.js route handler pattern
- [MCP Community Discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1247) -- Bearer token best practices

**LOW Confidence (Community Patterns, needs validation in implementation):**
- `mcp-handler` Redis dependency behavior in stateless mode -- based on code analysis, not official documentation
- `mcp-handler` SDK peer dep pinning (1.25.2) compatibility with SDK 1.26.0 -- likely works but untested

---

*Stack research for: Relay v1.4 - Employee Analytics, MCP Authentication & Remote MCP*
*Researched: 2026-02-05*
