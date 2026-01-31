# Stack Research

**Domain:** Internal Skill Marketplace / Developer Tools Catalog
**Researched:** 2026-01-31
**Confidence:** HIGH (verified via official docs and multiple 2025-2026 sources)

## Executive Summary

For an internal skill marketplace at enterprise scale (500+ users) with Google Workspace SSO, MCP server integration, wiki-style versioning, and real-time usage metrics, the recommended stack is:

**Next.js 15+ / React 19 + TypeScript + PostgreSQL + Drizzle ORM + Auth.js + shadcn/ui + TanStack Query + Zustand**

This stack prioritizes:
- Type safety end-to-end (TypeScript everywhere)
- Server-first rendering (React Server Components)
- Developer velocity (shadcn/ui, Drizzle, tRPC patterns)
- Enterprise-ready auth (Auth.js with Google Workspace SSO)
- Proven scalability (PostgreSQL, established patterns)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Next.js** | 15.5+ (or 16) | Full-stack React framework | Industry standard for enterprise React apps. App Router provides RSC, Server Actions, caching. Next.js 16 adds cache components and Turbopack as default. Used by OpenAI, Vercel, Linear. | HIGH |
| **React** | 19.x | UI library | Stable since Dec 2024. Server Components, Suspense, use() hook, Actions API all production-ready. Next.js 15+ requires React 19. | HIGH |
| **TypeScript** | 5.6+ | Type safety | Non-negotiable for enterprise. End-to-end type safety with Zod schemas, Drizzle ORM, and tRPC-style patterns. | HIGH |

### Database Layer

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **PostgreSQL** | 16+ (or 17) | Primary database | The "most desired and admired database" per surveys. Handles relational data, full-text search, JSONB for flexible skill metadata, and temporal tables for version history. Enterprise proven. | HIGH |
| **Drizzle ORM** | 0.40+ | Database ORM | Faster cold starts than Prisma (~7kb vs Prisma's engine binary), SQL-transparent queries, excellent serverless/edge support. 14x lower latency on complex joins. Ideal for real-time analytics dashboards. | HIGH |
| **PostgreSQL FTS** | Built-in | Full-text search | Start with PostgreSQL's native tsvector/tsquery. For 100k documents, queries run 5-10ms with GIN index. Avoids Elasticsearch operational overhead. Can upgrade to pg_search (ParadeDB) later if needed. | HIGH |

### Authentication

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Auth.js (NextAuth v5)** | 5.x | Authentication | Native Next.js integration, Google provider built-in. Supports domain restriction (`profile.email.endsWith("@company.com")`), JWT sessions without database, and enterprise SSO patterns. | HIGH |
| **Google Workspace OAuth** | - | SSO provider | Internal OAuth consent screen (user type = "Internal") restricts to organization. Native MFA support through Google. | HIGH |

### UI Layer

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **shadcn/ui** | Latest | Component library | Copy-paste components built on Radix UI primitives. Full ownership of code, Tailwind CSS styling, accessible by default. Industry standard for Next.js apps in 2025. | HIGH |
| **Tailwind CSS** | 4.x | Styling | Utility-first CSS, excellent DX with VS Code extensions. shadcn/ui built on it. Zero runtime overhead. | HIGH |
| **Radix UI** | Latest | Accessible primitives | Foundation for shadcn/ui. WAI-ARIA compliant, keyboard navigation, focus management built-in. | HIGH |

### State & Data Fetching

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **TanStack Query** | 5.90+ | Server state | Caching, background refetching, stale-while-revalidate. Suspense support stable. ~20% smaller than v4. Pairs with Server Actions for mutations. | HIGH |
| **Zustand** | 5.x | Client state | ~3kb bundle, no providers needed, simple API. Best for UI state (modals, filters, sidebar). Redux DevTools compatible. Better than Context for shared state. | HIGH |
| **Server Actions** | Next.js native | Mutations | Form submissions, data mutations without API routes. Type-safe with Zod validation. Eliminates boilerplate. | HIGH |

### Form Handling & Validation

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Zod** | 3.24+ | Schema validation | TypeScript-first, zero dependencies, single source of truth for types + validation. 17.7kb but superior DX and community support. | HIGH |
| **React Hook Form** | 7.54+ | Form state | Uncontrolled components, minimal re-renders. Native Zod integration via `@hookform/resolvers`. | HIGH |

### File Storage

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Cloudflare R2** | - | Object storage | S3-compatible, zero egress fees, global CDN. Presigned URLs for direct uploads. Cost-effective for skill assets, prompts, configs. | HIGH |
| **UploadThing** | 7.x | Upload management | Alternative if R2 setup is complex. Handles presigned URLs, progress, validation. Good DX but adds vendor dependency. | MEDIUM |

### API Design

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **tRPC** | 11.x | Internal API | End-to-end type safety for TypeScript monorepo. "Feels like calling local functions." Perfect for internal tools. | HIGH |
| **REST** | - | MCP server integration | MCP servers expect standard HTTP. Use REST for MCP tool endpoints, tRPC for internal UI. | HIGH |

### MCP Integration

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **MCP TypeScript SDK** | Latest | MCP server | Official Anthropic SDK. Define tools, resources, prompts. November 2025 spec adds parallel tool calls, tasks API. | HIGH |
| **Custom MCP Server** | - | Skill deployment | Build MCP server that exposes skills from catalog. Track usage via tool invocations. | HIGH |

### Real-Time & Analytics

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **PostgreSQL + Drizzle** | - | Usage tracking | Store usage events in PostgreSQL. Drizzle's SQL transparency enables efficient aggregations. Avoid premature optimization to ClickHouse. | HIGH |
| **PostHog** | - | Product analytics | Open-source, self-hostable. Track feature adoption, user flows. Alternative: Plausible for simpler analytics. | MEDIUM |

### Testing

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Vitest** | 2.1+ | Unit/integration tests | 10-20x faster than Jest in watch mode. Native ESM, TypeScript support. Jest-compatible API (95% migration). | HIGH |
| **Testing Library** | 16.x | Component testing | `@testing-library/react` for component tests. Best practices for accessible testing. | HIGH |
| **Playwright** | 1.50+ | E2E testing | Cross-browser E2E. Required for async Server Components (Vitest doesn't support). | HIGH |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager | Faster than npm, strict dependency resolution, monorepo support |
| **Biome** | Linting/formatting | Replaces ESLint + Prettier. 10x faster. Single config. |
| **Turbopack** | Bundler | Default in Next.js 16. 10x faster than Webpack for dev. |
| **Docker** | Containerization | Local dev parity with production. Required for PostgreSQL. |

---

## Installation

```bash
# Initialize Next.js 15+ with TypeScript
npx create-next-app@latest relay --typescript --tailwind --eslint --app --src-dir

# Core dependencies
pnpm add drizzle-orm postgres zod @auth/nextjs @auth/drizzle-adapter
pnpm add @tanstack/react-query zustand react-hook-form @hookform/resolvers
pnpm add @trpc/server @trpc/client @trpc/react-query @trpc/next

# UI
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dialog form input table tabs

# Development
pnpm add -D drizzle-kit vitest @vitejs/plugin-react @testing-library/react
pnpm add -D @playwright/test typescript @types/node @types/react

# MCP SDK
pnpm add @modelcontextprotocol/sdk
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Next.js** | Remix | If you need nested routing patterns, progressive enhancement, or dislike Vercel lock-in. Remix has stronger form handling. |
| **Drizzle ORM** | Prisma | If team is already proficient with Prisma, prefer its migrations UI, or need MongoDB/SQL Server support. Prisma's DX is excellent despite performance gap. |
| **PostgreSQL FTS** | Elasticsearch | Only if you need fuzzy matching, synonyms, faceted search, or >1M documents. Adds significant operational complexity and data sync challenges. |
| **PostgreSQL FTS** | pg_search (ParadeDB) | If you need BM25 ranking, hybrid search. Still PostgreSQL, no sync issues. Consider at scale. |
| **Auth.js** | Clerk | If you want managed auth with prebuilt UI components, enterprise SSO dashboard, and don't mind SaaS dependency. Excellent DX. |
| **Zustand** | Jotai | If you need atomic state with Suspense integration or React Server Component compatibility. Better for fine-grained reactivity. |
| **Zustand** | Redux Toolkit | Only for very large teams needing strict patterns, time-travel debugging, or audit logs. Overkill for most projects. |
| **tRPC** | GraphQL | If you need to expose API to non-TypeScript clients or aggregate multiple backend services. More flexible but more boilerplate. |
| **Cloudflare R2** | AWS S3 | If already invested in AWS ecosystem. S3 is battle-tested but egress fees add up. |
| **Vitest** | Jest | Only for React Native projects or legacy codebases. Jest is slower but has larger ecosystem. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Create React App (CRA)** | Deprecated, no longer maintained. No SSR, no Server Components. | Next.js 15+ |
| **Express.js backend** | Unnecessary complexity. Next.js API routes and Server Actions handle everything. Adds deployment overhead. | Next.js Server Actions + tRPC |
| **MongoDB** | Schema-less is wrong fit for structured skill catalog with versions, relationships. PostgreSQL JSONB gives flexibility where needed. | PostgreSQL |
| **Sequelize / TypeORM** | Older ORMs with worse TypeScript support, heavier abstractions, more bugs. | Drizzle ORM |
| **Redux (without Toolkit)** | Massive boilerplate, outdated patterns. Redux Toolkit is acceptable but usually overkill. | Zustand |
| **Yup validation** | Older, worse TypeScript inference than Zod. Less ecosystem support in 2025. | Zod |
| **Chakra UI / MUI** | Heavier bundle, opinionated styling harder to customize. Less Next.js ecosystem momentum. | shadcn/ui |
| **Firebase Auth** | Google-specific, harder to migrate, less control. oAuth tokens work differently. | Auth.js with Google provider |
| **Elasticsearch (premature)** | Operational nightmare for <100k documents. PostgreSQL FTS handles most use cases. Data sync is a constant headache. | PostgreSQL full-text search |
| **Separate backend service** | For an internal tool, monolith is simpler. Microservices add latency, deployment complexity, team coordination overhead. | Next.js full-stack |

---

## Stack Patterns by Variant

**If deploying to Vercel:**
- Use Vercel Blob or Cloudflare R2 for files
- Leverage Edge Runtime for auth checks
- Use Vercel Analytics + Speed Insights
- Consider Neon (serverless PostgreSQL) for auto-scaling

**If self-hosting:**
- Docker Compose for local dev (PostgreSQL, Redis optional)
- Kubernetes or Docker Swarm for production
- Consider Coolify or Dokploy for simple deployments
- Set up PostgreSQL with connection pooling (PgBouncer)

**If MCP is primary interface (vs. web UI):**
- Prioritize MCP server robustness and observability
- Consider event sourcing for audit trail
- Build web UI as "admin panel" secondary to MCP usage
- Track usage via MCP tool invocations, not page views

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 15.5+ | React 19.x | React 19 required for App Router features |
| Next.js 15.x | React 18.x | Only Pages Router, not recommended for new projects |
| Drizzle 0.40+ | PostgreSQL 14+ | Supports PostgreSQL-specific features like arrays, JSON |
| Auth.js 5.x | Next.js 15+ | v5 is App Router native, v4 is Pages Router |
| shadcn/ui | Tailwind 4.x | Latest shadcn components require Tailwind v4 |
| TanStack Query 5.x | React 19 | Full Suspense support |
| tRPC 11.x | TanStack Query 5.x | Integrated adapter |

---

## Deployment Recommendation

For an internal enterprise tool:

1. **Start simple:** Deploy to Vercel (free tier supports 500+ users for internal tool)
2. **Database:** Use Neon (serverless PostgreSQL) or Supabase
3. **File storage:** Cloudflare R2 (S3-compatible, free egress)
4. **Observability:** Vercel Analytics + Sentry for errors

If compliance requires self-hosting:
- Docker + Railway/Render/Fly.io
- Or Kubernetes if DevOps capacity exists

---

## Sources

**Verified via official documentation (HIGH confidence):**
- [Next.js 15 Blog](https://nextjs.org/blog/next-15) - Framework features, React 19 support
- [TanStack Query Docs](https://tanstack.com/query/v5/docs/framework/react/overview) - v5 features, Suspense support
- [Drizzle ORM Docs](https://orm.drizzle.team/) - Performance, serverless optimization
- [Auth.js Docs](https://authjs.dev/) - Google provider, Next.js integration
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) - Tools API, November 2025 updates
- [shadcn/ui](https://ui.shadcn.com/) - Component patterns, React 19 support

**Verified via multiple sources (MEDIUM-HIGH confidence):**
- [Drizzle vs Prisma comparison](https://www.bytebase.com/blog/drizzle-vs-prisma/) - Performance benchmarks
- [Vitest vs Jest](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/) - Speed comparisons
- [PostgreSQL FTS vs Elasticsearch](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch) - When to use each
- [React State Management 2025](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k) - Zustand recommendation
- [tRPC vs GraphQL vs REST](https://betterstack.com/community/guides/scaling-nodejs/trpc-vs-graphql/) - API design patterns

---

*Stack research for: Internal Skill Marketplace / Developer Tools Catalog*
*Researched: 2026-01-31*
