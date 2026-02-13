# Stack Research: v3.0 AI Discovery & Workflow Intelligence

**Domain:** Google Workspace integration, Loom video embed, intent-based AI search, cross-AI preference sync, homepage redesign
**Researched:** 2026-02-13
**Confidence:** HIGH (stack additions), MEDIUM (Claude.ai sync -- no public API exists)
**Scope:** Stack ADDITIONS only for v3.0 features. Existing stack validated and unchanged (Next.js 16.1.6, PostgreSQL + pgvector, Drizzle ORM 0.42.0, Auth.js v5, MCP SDK 1.26.0, Anthropic SDK 0.72.1, Voyage AI, Resend, Recharts, Tailwind CSS 4, Playwright, vitest).

---

## Executive Summary

v3.0 requires **5 new npm dependencies** and **0 existing dependency changes**. The additions break into three categories:

1. **Google Workspace API** (3 packages): Individual `@googleapis/drive`, `@googleapis/calendar`, `@googleapis/gmail` packages rather than the monolithic `googleapis` (200MB unpacked vs 4.3MB total). These share `googleapis-common` + `google-auth-library` as transitive dependencies. OAuth tokens are already stored in the `accounts` table by Auth.js's DrizzleAdapter -- we extend the Google provider config to request additional scopes and store refresh tokens for offline access.

2. **Vercel AI SDK** (2 packages): `ai` + `@ai-sdk/anthropic` for the intent-based conversational search UI. This is specifically for the **streaming chat interface** -- the existing `@anthropic-ai/sdk` remains for server-side batch operations (reviews, improvements). The AI SDK provides `useChat()` hook, `streamText()`, and automatic Anthropic provider integration that eliminates ~80% of streaming boilerplate compared to hand-rolling `ReadableStream` from the Anthropic SDK directly.

3. **Loom embed**: No npm package needed. Loom's oEmbed endpoint is a simple HTTP GET that returns embed HTML + metadata (title, duration, thumbnail). A 20-line server-side fetch wrapper is simpler and more maintainable than the `@loomhq/loom-embed` SDK (which is client-side only, designed for DOM manipulation).

4. **Claude.ai preference sync**: No external API exists for programmatic management of Claude.ai Projects. The approach is **file-based CLAUDE.md generation + export** -- EverySkill generates personalized CLAUDE.md files from a user's installed skills, which they download or copy to their project. Claude Code reads CLAUDE.md natively. This is achievable with zero dependencies.

5. **Homepage redesign**: No new UI libraries needed. Tailwind CSS 4 + existing component patterns cover all redesign needs. Recharts is already available for any data visualization.

---

## Recommended Stack Additions

### Google Workspace Integration

| Technology | Version | Purpose | Why This Over Alternatives |
|------------|---------|---------|----------------------------|
| `@googleapis/drive` | ^20.1.0 | Read Drive files to discover CLAUDE.md, skill files, project structures | Individual package (2.3MB) vs `googleapis` monolith (200MB). Same API surface, 98% smaller |
| `@googleapis/calendar` | ^14.2.0 | Read calendar events to suggest context-relevant skills | Individual package (809KB). Same googleapis-common transitive dep, shared with Drive/Gmail |
| `@googleapis/gmail` | ^16.1.1 | Read email patterns to identify workflow contexts | Individual package (1.1MB). Least certain of the three -- may defer to Phase 2 if scope tightens |
| `google-auth-library` | ^10.5.0 (transitive) | OAuth 2.0 token management with refresh | Comes free via `googleapis-common`. Do NOT install separately -- it is a transitive dependency |

**Why individual packages over `googleapis`:**
- `googleapis` is 200MB unpacked (171.4.0) and includes 400+ Google API clients
- Individual packages total 4.3MB for the three we need
- All three share `googleapis-common@^8.0.0` which deduplicates in node_modules
- Startup time improvement: individual packages load only the APIs you use

**OAuth Scope Configuration:**

```typescript
// In auth.config.ts -- extend Google provider
Google({
  authorization: {
    params: {
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/calendar.events.readonly",
        "https://www.googleapis.com/auth/gmail.readonly",
      ].join(" "),
      access_type: "offline",   // Forces refresh_token issuance
      prompt: "consent",         // Required to get refresh_token on re-auth
    },
  },
})
```

**Token Storage:** The `accounts` table (managed by Auth.js DrizzleAdapter) already has `access_token`, `refresh_token`, `expires_at`, and `scope` columns. Auth.js populates these automatically on sign-in. For Workspace API calls, we read tokens from the `accounts` table and use `google-auth-library`'s `OAuth2Client` with stored credentials.

**Token Refresh Pattern:**

```typescript
// Simplified -- actual implementation in a service module
import { OAuth2Client } from "google-auth-library";

async function getGoogleClient(userId: string): Promise<OAuth2Client> {
  const account = await getGoogleAccount(userId); // DB query
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });
  // google-auth-library auto-refreshes expired tokens when making API calls
  return client;
}
```

### Intent-Based AI Search (Vercel AI SDK)

| Technology | Version | Purpose | Why This Over Alternatives |
|------------|---------|---------|----------------------------|
| `ai` | ^6.0.86 | Core streaming primitives: `streamText()`, `generateText()`, `streamObject()` | AI SDK 6 is the current major version. Provides server-side streaming that integrates natively with Next.js App Router |
| `@ai-sdk/anthropic` | ^3.0.43 | Anthropic provider for AI SDK: wraps Claude API with unified interface | Single line model swap. Same ANTHROPIC_API_KEY env var. Coexists with direct `@anthropic-ai/sdk` |

**Why add AI SDK when we already have `@anthropic-ai/sdk`:**

The existing Anthropic SDK is used for **batch server-side operations** (AI review, skill improvement, fork differentiation). These are request-response: send prompt, wait for full response, parse JSON. The Anthropic SDK works perfectly for this.

The new intent-based search is a **streaming conversational UI** where the user types natural language ("find me a code review skill for Python") and sees Claude's response stream in real-time while it searches the skill database using tool calls. This requires:

1. **Client-side hooks** (`useChat`) that manage message state, loading indicators, streaming text
2. **Server-side streaming** that creates a `ReadableStream` from Claude's SSE response
3. **Tool call integration** where Claude calls `searchSkills` or `semanticSearch` mid-response

Building this from scratch with `@anthropic-ai/sdk` requires ~120 lines of streaming infrastructure (SSE parsing, ReadableStream creation, tool call loop, client state management). The AI SDK does this in ~25 lines:

```typescript
// Server: app/api/search/route.ts
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    system: SKILL_SEARCH_SYSTEM_PROMPT,
    messages,
    tools: { searchSkills, semanticSearch, getSkillDetails },
  });
  return result.toDataStreamResponse();
}

// Client: components/skill-search-chat.tsx
"use client";
import { useChat } from "@ai-sdk/react";

export function SkillSearchChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/search",
  });
  // ... render messages + input
}
```

**Coexistence with existing `@anthropic-ai/sdk`:**
- `@anthropic-ai/sdk` continues to be used for: AI reviews, skill improvement, fork differentiation, any non-streaming operation
- `@ai-sdk/anthropic` is used only for: the streaming search chat interface
- Both use the same `ANTHROPIC_API_KEY` environment variable
- No conflicts -- they are independent packages with independent APIs

**Compatibility Verification:**
- `ai@6.0.86` peer dep: `zod@^3.25.76` -- installed zod is exactly 3.25.76 (matches)
- `@ai-sdk/react@3.0.88` peer dep: `react@^19.2.1` -- installed React is 19.2.4 (matches)
- AI SDK 6 works with Next.js App Router and server actions natively

### Loom Video Embed

| Technology | Version | Purpose | Why This Over Alternatives |
|------------|---------|---------|----------------------------|
| No package | N/A | Loom oEmbed via HTTP fetch | Server-side fetch to `https://www.loom.com/v1/oembed?url=...` returns title, thumbnail, duration, embed HTML |

**Why NOT use `@loomhq/loom-embed` (1.7.0):**
- It is a **client-side DOM manipulation library** designed for SPAs that need to find Loom URLs in rendered HTML and replace them with iframes
- Our use case is **server-side metadata extraction** (get title, duration, thumbnail for skill cards) + **controlled iframe rendering** (embed in a specific component)
- The oEmbed endpoint is a simple unauthenticated GET request -- no SDK needed
- The SDK adds a runtime dependency for functionality we get from a 20-line server utility

**oEmbed Implementation:**

```typescript
// lib/loom.ts
interface LoomOEmbed {
  title: string;
  author_name: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  duration: number; // seconds
  html: string;     // iframe embed code
  provider_name: string;
}

export async function getLoomMetadata(loomUrl: string): Promise<LoomOEmbed | null> {
  try {
    const res = await fetch(
      `https://www.loom.com/v1/oembed?url=${encodeURIComponent(loomUrl)}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function extractLoomId(url: string): string | null {
  const match = url.match(/loom\.com\/share\/([a-f0-9]+)/);
  return match?.[1] ?? null;
}
```

**Embed rendering:** A simple React component renders an iframe with the Loom video ID. No SDK required:

```tsx
function LoomEmbed({ videoId }: { videoId: string }) {
  return (
    <iframe
      src={`https://www.loom.com/embed/${videoId}`}
      allowFullScreen
      className="aspect-video w-full rounded-lg"
    />
  );
}
```

### Cross-AI Preference Sync (CLAUDE.md Generation)

| Technology | Version | Purpose | Why This Over Alternatives |
|------------|---------|---------|----------------------------|
| No package | N/A | Generate CLAUDE.md files from user's installed skill portfolio | Pure string template generation. No external API exists for Claude.ai Project management |

**Critical Finding:** There is **no public API** for programmatically managing Claude.ai Projects or pushing custom instructions to claude.ai. The Anthropic API (platform.claude.com) provides Messages API, Batches API, Files API (beta), and Skills API (beta) -- but none of these manage the consumer-facing Projects feature on claude.ai.

**Viable approach: File-based CLAUDE.md generation**

EverySkill generates a personalized CLAUDE.md file that incorporates a user's installed skills, preferences, and org-specific instructions. This file is:
1. Downloaded by the user and placed in their project root
2. Automatically read by Claude Code at session start
3. Optionally pushed to a user's Git repo via the MCP server

This approach works because:
- Claude Code natively reads `CLAUDE.md` from project root, `~/.claude/CLAUDE.md` globally
- The MCP server can write to the filesystem (already does for `deploy_skill`)
- Skills are already serialized as markdown content in the database

**Implementation:** Zero new dependencies. Uses existing Anthropic SDK for any AI-assisted generation, existing filesystem operations for MCP deployment.

### Homepage Redesign

| Technology | Version | Purpose | Why This Over Alternatives |
|------------|---------|---------|----------------------------|
| No package | N/A | Redesign uses existing Tailwind CSS 4 + React 19 | All needed primitives exist: CSS grid, animations via Tailwind, Recharts for charts |

No new UI libraries needed. The existing stack provides:
- **Tailwind CSS 4**: All layout, animation, responsive design
- **Recharts 3.7.0**: Any data visualization (skill popularity, usage trends)
- **React 19**: Suspense boundaries for loading states, Server Components for data fetching
- **nuqs 2.8.7**: URL state for any filter/search interactions on homepage

---

## Installation

```bash
# Google Workspace API (individual packages -- NOT the monolithic googleapis)
pnpm --filter web add @googleapis/drive @googleapis/calendar @googleapis/gmail

# Vercel AI SDK for streaming search chat
pnpm --filter web add ai @ai-sdk/anthropic
```

**Total new packages: 5**
**Estimated node_modules impact: ~8MB** (Google API packages share googleapis-common; AI SDK is ~6MB)

---

## Alternatives Considered and Rejected

| Category | Decision | Alternative | Why Not |
|----------|----------|-------------|---------|
| Google API client | Individual `@googleapis/*` packages | `googleapis` monolith (171.4.0) | 200MB vs 4.3MB. Same API surface. Individual packages are Google's recommended approach for apps using few APIs |
| Google API client | Individual `@googleapis/*` packages | Raw `fetch` to Google REST APIs | googleapis-common handles auth, pagination, retry, error parsing. Hand-rolling this is error-prone and saves nothing |
| Streaming chat | Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) | Raw Anthropic SDK streaming | 120+ lines of streaming infrastructure vs ~25 lines. AI SDK handles SSE parsing, ReadableStream, client state, tool call loops. The DX difference is dramatic for chat UIs |
| Streaming chat | Vercel AI SDK | LangChain.js | LangChain is an orchestration framework (agents, chains, memory). We need a streaming UI library. LangChain is 10x the surface area for a search chat |
| Streaming chat | Vercel AI SDK | TanStack AI | Newer library, less battle-tested. AI SDK 6 has wider adoption, better Anthropic provider support, and proven Next.js integration |
| Loom embed | Server-side oEmbed fetch | `@loomhq/loom-embed` SDK (1.7.0) | SDK is client-side DOM manipulation. We need server-side metadata + controlled iframe. oEmbed is simpler |
| Loom embed | Server-side oEmbed fetch | Iframely / Embedly third-party service | Adds an external dependency and potential cost for something Loom provides natively via oEmbed |
| Claude.ai sync | CLAUDE.md file generation | Claude.ai Projects API | No such API exists. File-based approach works with Claude Code's native CLAUDE.md reading |
| Claude.ai sync | CLAUDE.md file generation | Browser automation (puppeteer) to claude.ai | Fragile, ToS violation risk, maintenance nightmare. File-based is reliable |
| Homepage UI | Tailwind CSS 4 (existing) | Framer Motion for animations | Tailwind CSS 4 has built-in animation utilities. Framer Motion adds 30KB+ for animations achievable with CSS |
| Homepage UI | Tailwind CSS 4 (existing) | Shadcn/ui component library | 30+ existing components use plain Tailwind. Introducing a component library mid-project breaks consistency |

---

## What NOT to Add

| Technology | Why Skip It | Risk If Added |
|------------|-------------|---------------|
| `googleapis` (monolithic) | 200MB package including 400+ API clients | Bloated node_modules, slow install, slower startup. Individual packages are 98% smaller |
| `@loomhq/loom-embed` | Client-side DOM library. We need server-side metadata | Unnecessary runtime dependency; oEmbed endpoint gives us everything we need in 20 lines |
| `@google-cloud/local-auth` | Designed for CLI/desktop apps, not web servers | Incompatible with our server-side OAuth flow through Auth.js |
| `google-auth-library` (direct install) | Already a transitive dependency of `@googleapis/*` | Duplicate installation; use the transitive version for consistency |
| LangChain.js | Full orchestration framework with agents, memory, chains | 50+ transitive deps, massive surface area. We need streaming chat, not an AI orchestration framework |
| Framer Motion | Animation library | Tailwind CSS 4 covers all animation needs. Adding 30KB+ for what CSS transitions handle |
| `puppeteer` / `playwright` (for Claude.ai automation) | No Claude.ai API exists, but browser automation is the wrong solution | ToS risk, fragile selectors, maintenance burden. CLAUDE.md file generation is the right approach |
| Any state management library (Zustand, Jotai) | Chat state is managed by AI SDK's `useChat` hook, other state by server components + URL params | Adding global state management to a server-component-first app creates unnecessary complexity |
| `bull` / `pg-boss` job queue | Google Workspace sync could theoretically use background jobs | Sync is user-initiated, runs in server action context. No need for infrastructure-level job queuing at current scale |

---

## Schema Changes Required

### New Tables

**`workspace_connections` -- Google Workspace integration state per user:**
```typescript
export const workspaceConnections = pgTable("workspace_connections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // "google" initially
  scopes: text("scopes"),              // Granted scopes (may differ from requested)
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncStatus: text("sync_status").default("idle"), // idle, syncing, error
  syncError: text("sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

**`skill_videos` -- Loom video associations with skills:**
```typescript
export const skillVideos = pgTable("skill_videos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  skillId: text("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  videoUrl: text("video_url").notNull(),
  videoId: text("video_id").notNull(),        // Extracted Loom video ID
  title: text("title"),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"),               // Seconds
  embedHtml: text("embed_html"),
  position: integer("position").default(0),    // Ordering for multiple videos
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

**`search_conversations` -- Persisted AI search conversations:**
```typescript
export const searchConversations = pgTable("search_conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title"),                        // Auto-generated from first message
  messages: jsonb("messages").notNull(),        // Array of {role, content} objects
  skillsFound: jsonb("skills_found"),           // Skill IDs returned during conversation
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

### Modified Tables

**`skills` (add column):**
```typescript
loomVideoUrl: text("loom_video_url"),  // Primary demo video URL (nullable)
```

### Environment Variables

```bash
# Already exist (no changes):
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
ANTHROPIC_API_KEY=...

# No new env vars needed. Google Workspace uses same OAuth client as auth.
# AI SDK uses same ANTHROPIC_API_KEY.
```

---

## Integration Architecture

### Google Workspace Flow

```
User signs in (Auth.js Google provider)
  |-- Auth.js stores access_token + refresh_token in accounts table
  |-- Scopes include drive.readonly, calendar.events.readonly, gmail.readonly
  |
User visits "Workspace Diagnostics" page
  |-- Server action reads tokens from accounts table
  |-- Creates google-auth-library OAuth2Client with stored tokens
  |-- Calls Drive API: list files matching *.md, CLAUDE.md, .mcp.json
  |-- Calls Calendar API: recent/upcoming events for context
  |-- Returns workspace context to UI
  |
AI analyzes workspace context
  |-- Feeds Drive/Calendar data to Claude as context
  |-- Claude recommends relevant skills based on actual work patterns
  |-- Results rendered in existing skill card components
```

### Intent-Based Search Flow

```
User opens search chat (new route: /search)
  |-- React component uses useChat() from @ai-sdk/react
  |-- Sends messages to /api/search route
  |
API route (/api/search/route.ts)
  |-- Uses streamText() from ai package
  |-- Model: anthropic("claude-sonnet-4-5-20250929") via @ai-sdk/anthropic
  |-- System prompt instructs Claude to search skill database
  |-- Tools registered: searchSkills, semanticSearch, getSkillDetails
  |
Claude calls tools during streaming
  |-- searchSkills: ILIKE text search (existing DB query)
  |-- semanticSearch: Voyage AI embedding + pgvector cosine (existing pipeline)
  |-- getSkillDetails: full skill fetch (existing DB query)
  |
Response streams back to client
  |-- useChat() manages message state, loading, error
  |-- Tool results rendered as skill cards inline in chat
  |-- User can install skills directly from search results
```

### CLAUDE.md Sync Flow

```
User visits "Export Preferences" page
  |-- Server component lists user's installed skills
  |-- Generates CLAUDE.md content from skill portfolio:
      - Skills as instruction blocks
      - Org-specific conventions
      - MCP server configurations
  |
User clicks "Download CLAUDE.md"
  |-- Browser downloads generated file
  |-- User places in project root or ~/.claude/
  |
OR: MCP tool `sync_preferences`
  |-- MCP server generates CLAUDE.md content (same template)
  |-- Writes to ~/.claude/CLAUDE.md or project CLAUDE.md
  |-- Claude Code reads it on next session
```

---

## Compatibility Matrix

| New Package | React 19.2.4 | Next.js 16.1.6 | Node 22+ | Zod 3.25.76 | Drizzle 0.42 |
|-------------|:---:|:---:|:---:|:---:|:---:|
| `@googleapis/drive@^20.1.0` | N/A | N/A | Yes | N/A | N/A |
| `@googleapis/calendar@^14.2.0` | N/A | N/A | Yes | N/A | N/A |
| `@googleapis/gmail@^16.1.1` | N/A | N/A | Yes | N/A | N/A |
| `ai@^6.0.86` | N/A | Yes | Yes | Yes (`^3.25.76`) | N/A |
| `@ai-sdk/anthropic@^3.0.43` | N/A | Yes | Yes | N/A | N/A |
| `@ai-sdk/react@^3.0.88` (transitive of `ai`) | Yes (`^19.2.1`) | Yes | N/A | N/A | N/A |

All compatibility checks pass. Zod 3.25.76 is the exact minimum version required by AI SDK 6.

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Google Workspace packages | HIGH | Individual `@googleapis/*` packages are Google's official, actively maintained, well-documented Node.js clients. Version numbers verified via npm registry on 2026-02-13 |
| OAuth token storage | HIGH | Auth.js DrizzleAdapter already stores `access_token`, `refresh_token`, `expires_at` in the existing `accounts` table. Verified by reading `packages/db/src/schema/auth.ts` |
| OAuth scope extension | HIGH | Auth.js v5 Google provider supports custom scopes via `authorization.params.scope`. Documented in Auth.js docs and confirmed across multiple sources |
| Token refresh pattern | HIGH | `google-auth-library` OAuth2Client auto-refreshes expired tokens. Well-documented pattern. Auth.js refresh token rotation guide covers the persistence side |
| Vercel AI SDK compatibility | HIGH | Peer deps verified: `zod@^3.25.76` matches installed 3.25.76, `react@^19.2.1` matches installed 19.2.4. AI SDK 6 is current stable |
| AI SDK coexistence with Anthropic SDK | HIGH | Independent packages, independent APIs. `@ai-sdk/anthropic` is a provider adapter, not a replacement. Both use `ANTHROPIC_API_KEY`. No namespace conflicts |
| Loom oEmbed | HIGH | Loom's oEmbed endpoint is publicly documented at dev.loom.com, requires no authentication, returns standard oEmbed JSON. Battle-tested protocol |
| Claude.ai sync approach | MEDIUM | No public API exists for Claude.ai Projects -- confirmed by reviewing Anthropic's complete API surface. File-based CLAUDE.md generation is the only viable approach. Risk: Anthropic may introduce a Projects API later, requiring a pivot |
| No new UI libraries needed | HIGH | Existing Tailwind CSS 4 + React 19 Server Components cover all homepage redesign patterns. No feature gap identified |

---

## Sources

### NPM Registry (verified 2026-02-13)
- `@googleapis/drive@20.1.0` -- unpacked 2.3MB, dep: googleapis-common@^8.0.0
- `@googleapis/calendar@14.2.0` -- unpacked 809KB, dep: googleapis-common@^8.0.0
- `@googleapis/gmail@16.1.1` -- unpacked 1.1MB, dep: googleapis-common@^8.0.0
- `googleapis@171.4.0` -- unpacked 200MB (rejected: too large)
- `google-auth-library@10.5.0` -- transitive via googleapis-common
- `ai@6.0.86` -- peer: zod@^3.25.76, deps: @ai-sdk/gateway, @ai-sdk/provider, @ai-sdk/provider-utils
- `@ai-sdk/anthropic@3.0.43` -- deps: @ai-sdk/provider, @ai-sdk/provider-utils
- `@ai-sdk/react@3.0.88` -- peer: react@^18 || ~19.0.1 || ~19.1.2 || ^19.2.1
- `@loomhq/loom-embed@1.7.0` -- rejected: client-side DOM library, not needed for server-side oEmbed
- `@anthropic-ai/sdk@0.74.0` -- latest available; installed 0.72.1 remains compatible

### Codebase Verification
- `apps/web/auth.config.ts` -- Current Google provider config, scope extension point confirmed
- `apps/web/auth.ts` -- JWT callback with tenantId injection, token storage pattern confirmed
- `packages/db/src/schema/auth.ts` -- `accounts` table with `access_token`, `refresh_token`, `expires_at` columns confirmed
- `apps/web/lib/ai-review.ts` -- Existing `@anthropic-ai/sdk` usage pattern (batch, non-streaming) confirmed
- `packages/db/src/services/semantic-search.ts` -- pgvector cosine search confirmed, reusable for AI search tools
- `apps/web/lib/embedding-generator.ts` -- Voyage AI embedding pipeline confirmed
- React 19.2.4 installed (verified via node_modules/react/package.json)
- Zod 3.25.76 installed (verified via node_modules/zod/package.json)

### Official Documentation
- [Google Workspace OAuth Scopes](https://developers.google.com/identity/protocols/oauth2/scopes) -- drive.readonly, calendar.events.readonly, gmail.readonly
- [Auth.js Google Provider](https://next-auth.js.org/providers/google) -- Custom scopes, refresh token via access_type: "offline"
- [Auth.js Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation) -- JWT callback token persistence pattern
- [Loom Embed SDK API](https://dev.loom.com/docs/embed-sdk/api) -- oEmbed method, OEmbedInterface return type
- [Loom oEmbed](https://dev.loom.com/docs/embed-sdk/getting-started) -- No authentication required for embed
- [Vercel AI SDK Introduction](https://ai-sdk.dev/docs/introduction) -- AI SDK 6 architecture, Core + UI libraries
- [AI SDK Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) -- @ai-sdk/anthropic setup
- [Anthropic API Overview](https://platform.claude.com/docs/en/api/overview) -- Messages, Batches, Files, Skills APIs listed. No Projects management API
- [Anthropic SDK Streaming](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/examples/streaming.ts) -- Direct SDK streaming pattern (more verbose than AI SDK)

---

*Stack research for: EverySkill v3.0 -- AI Discovery & Workflow Intelligence*
*Researched: 2026-02-13*
