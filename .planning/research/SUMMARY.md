# Gmail Workflow Diagnostic Research Summary

**Project:** EverySkill Gmail Workflow Diagnostic
**Domain:** Email metadata analysis with AI-powered automation recommendations
**Researched:** 2026-02-14
**Confidence:** HIGH (Gmail API, OAuth patterns), MEDIUM (AI classification accuracy, time estimation model)

## Executive Summary

The Gmail Workflow Diagnostic is a "screentime for email" feature that analyzes users' Gmail patterns over 90 days and recommends EverySkill skills to automate repetitive email work. The technical approach is straightforward: fetch email metadata via Gmail API, classify patterns with Claude (same structured output pattern as existing `ai-review.ts`), match opportunities to skills via existing hybrid search, and visualize results with existing Recharts components. The raw email data is analyzed in-memory and discarded — only aggregate statistics are persisted.

The architecture reuses 90% of existing infrastructure: Auth.js Google OAuth credentials (but with a **separate incremental authorization flow**), Anthropic SDK for classification, hybrid search for skill matching, and Recharts for visualization. The only new dependency is `@googleapis/gmail` (~1.1MB). Privacy is enforced by the analyze-and-discard pattern: email metadata enters as input, only anonymous aggregates exit for storage. Headers-only access (via `gmail.metadata` or `gmail.readonly` scope) prevents body/attachment exposure.

**CRITICAL DECISION REQUIRED:** Stack/Architecture/Features researchers recommend `gmail.metadata` scope (privacy-friendly, no body access), but Pitfalls researcher found that **`gmail.metadata` CANNOT use the `q` search parameter** for date filtering. Without date filters, analyzing 90 days requires fetching ALL message IDs in the entire mailbox (impractical for 100K+ message mailboxes). **Recommendation: Use `gmail.readonly` scope but commit to ONLY requesting `format: 'metadata'` on all API calls.** This provides date filtering capability while maintaining the same privacy posture as `gmail.metadata`. Document this scope choice transparently in the privacy notice.

## Key Findings

### Recommended Stack

**No new stack beyond 1 npm package.** The Gmail diagnostic reuses existing EverySkill infrastructure with surgical additions:

**Core technologies:**
- **`@googleapis/gmail` ^15.0.0** (new dependency, ~1.1MB): Official Google Gmail API client with OAuth token refresh, pagination, TypeScript types, and retry logic
- **Anthropic SDK 0.72.1** (existing): Claude classifies email patterns using structured JSON output (same pattern as `ai-review.ts`)
- **Recharts 3.7.0** (existing): BarChart, AreaChart, PieChart for diagnostic dashboard (already used in 3+ components)
- **Auth.js v5 Google provider** (existing): Same OAuth client credentials, but with a **separate incremental authorization flow** for Gmail scope (NOT added to main provider config)
- **Drizzle ORM 0.42.0** (existing): Stores diagnostic snapshots (aggregates only) with RLS, following established multi-tenant patterns

**No NLP libraries** (Claude handles classification), **no job queues** (server action with progress is sufficient for 60-90 second scans), **no new charting libraries** (Recharts covers all needs).

**Critical version requirements:**
- Node.js 22+ (for native `crypto` module with AES-256-GCM)
- `@googleapis/gmail` v15+ (post-2025 API with reduced quota costs)

### Expected Features

**Must have (table stakes):**
- **One-click Gmail connect** — OAuth redirect with explicit privacy messaging ("headers only, never bodies")
- **Email volume summary** — "You receive ~85 emails/day" (users expect this first)
- **Time-spent estimation** — "~8.5 hours/week on email" (transparent methodology: category-weighted model with thread depth factors)
- **Email categorization breakdown** — Newsletters (35%), notifications (25%), internal threads (20%), action items (15%), etc.
- **Visual dashboard** — KPI cards (total emails, estimated hours), category donut chart, volume trends
- **Skill recommendations** — Map email categories to existing skills via hybrid search, show top 3-5 with install CTAs
- **Explicit "Run Diagnostic" action** — User-triggered, not automatic (respects agency, avoids surveillance feeling)
- **Disconnect/revoke access** — Revoke refresh token with Google API + delete stored tokens

**Should have (differentiators):**
- **Deployment plan with sequenced skill rollout** — Order recommendations by ROI, show cumulative savings graph
- **FTE Days Saved projection** — Tie to existing My Leverage page metric (convert skill `hoursSaved` to FTE days)
- **Ephemeral analysis (analyze-and-discard)** — Unlike competitors (EmailMeter, timetoreply), EverySkill stores NO raw email data (genuine privacy differentiator)
- **Re-run comparison (before/after)** — "Newsletter time down 40% since you deployed Email Digest skill"
- **One-click skill install from recommendations** — Reduce friction from insight to action
- **"Biggest opportunity" highlight** — Single hero card: "35% of your time goes to newsletters — Email Digest Skill could save 3.5 hrs/wk"

**Defer (v2+):**
- **Team-level aggregate view** — Requires privacy design, opt-in flow, anonymization (separate milestone)
- **Calendar + Drive connectors** — Same OAuth pattern, different data sources (separate milestones)
- **Email pattern insights** — Behavioral analytics like "busiest hour: 9-10am" (nice-to-have, secondary to recommendations)
- **Exportable report** — PDF/summary download (low priority, add when users request it)

### Architecture Approach

**Component boundaries** follow single-responsibility: Gmail auth (separate from Auth.js), metadata fetcher (Gmail API interaction), workflow analyzer (AI classification), skill matcher (wrapper around existing hybrid search), diagnostic storage (new tables following established patterns), and dashboard UI (Recharts components).

**Major components:**
1. **Separate Gmail OAuth Flow** — Custom `/api/gmail/connect` + `/api/gmail/callback` routes, completely outside Auth.js (because Auth.js v5 doesn't support incremental authorization). Gmail tokens stored in `gmail_tokens` table (encrypted at rest with AES-256-GCM), NOT in Auth.js `accounts` table.
2. **Privacy Firewall (Analyze-and-Discard Pipeline)** — Fetch email metadata → classify in-memory (batched to Claude, 75 emails per call) → aggregate to anonymous patterns → store ONLY aggregates → discard raw data. Headers like From/Subject/Date never persist beyond the server action.
3. **Skill Matching via Existing Hybrid Search** — AI analysis outputs `skillSearchQuery` strings (e.g., "automate newsletter summarization"). These feed directly into existing `hybridSearchSkills()` with RRF scoring. No new matching infrastructure.
4. **Dashboard with Existing Recharts** — PieChart for category distribution, BarChart for time breakdown, skill recommendation cards. Follows same layout pattern as existing `/analytics` page.

**Data flow:** Gmail API (threads.list + threads.get) → in-memory aggregation → Claude classification (structured JSON) → skill matching → persist to `workflow_diagnostics` + `diagnostic_skill_matches` tables → render dashboard. Raw metadata lives only in server action scope, never in database.

### Critical Pitfalls

1. **Scope Escalation Breaks Existing Auth (CRITICAL)** — Adding Gmail scope to the Auth.js Google provider forces ALL existing users through re-consent on next login. Users who decline Gmail are locked out of the entire app. **Prevention:** Build a SEPARATE OAuth flow outside Auth.js (`/api/gmail/connect` route), triggered only when users click "Connect Gmail." Store tokens in `gmail_tokens` table, NOT `accounts` table. Mark OAuth consent screen as "Internal" user type in Google Cloud Console to bypass verification.

2. **`gmail.metadata` Scope Blocks Date Filtering (CRITICAL)** — The `gmail.metadata` scope prevents using the `q` parameter on `messages.list`. Without date filtering, analyzing 90 days requires fetching ALL message IDs in the mailbox (impractical for 100K+ messages, causes timeout/memory issues). **Prevention:** Use `gmail.readonly` scope BUT commit to ONLY requesting `format: 'metadata'` on all `messages.get` calls. This provides date filtering (`q=after:2025/11/16`) while accessing the same header-only data. Document transparently: "We use readonly scope for date filtering but never access message bodies."

3. **Access Token Expiry Causes Silent Failures (CRITICAL)** — Google access tokens expire after 1 hour. Auth.js v5 does NOT implement automatic refresh (confirmed across GitHub issues #3016, #8205). If a user returns after 1 hour, Gmail API calls fail with 401. **Prevention:** Proactive token refresh (check `expiresAt < Date.now() + 300000`, refresh 5 min before expiry). Use database-level mutex (`refreshingAt` timestamp column) to prevent race conditions. Handle `invalid_grant` gracefully (user revoked in Google settings) by marking connection as disconnected.

4. **Email Data Retained After Analysis (COMPLIANCE)** — Raw email headers accidentally persisted via temporary storage, LLM prompt logs, error stack traces, or browser DevTools network responses. **Prevention:** Process entirely in-memory (no database temp tables). Sanitize LLM prompts to send ONLY aggregated patterns, never raw subjects/senders. Disable request logging for `/api/gmail/*` routes. Add data deletion endpoint triggered on disconnect.

5. **Large Mailbox Analysis Causes Timeout/Exhaustion (SCALABILITY)** — Active users with 50K+ emails. Fetching metadata for each requires 50K API calls at 5 quota units each (250K units total). Per-user rate limit is 15K units/min = ~17 minutes. Server action times out. **Prevention:** Use batch requests (100 messages per batch, reduces HTTP overhead 99%). Limit analysis scope to last 90 days with date filtering (`q=after:...`). Implement sampling (2,000 message sample for 50K+ mailboxes). Set hard cap at 5,000 messages per analysis. Show progress indicator during scan.

## Implications for Roadmap

Based on research, Gmail diagnostic is a **2-3 phase milestone**. The core functionality (OAuth, fetch, analyze, display) is tightly coupled and should be built as a cohesive unit. Polish features (re-run comparison, deployment plan sequencing) can follow.

### Phase 1: Core Diagnostic (MVP)
**Rationale:** All table stakes features must work together. Users need the full flow (connect → analyze → see results → recommendations) to get value. Partial implementation delivers zero value.

**Delivers:**
- Separate Gmail OAuth flow with privacy-first consent UI
- `gmail_tokens` table (encrypted at rest, tenant-scoped, RLS)
- Email metadata fetch (90-day lookback, batched Gmail API calls, in-memory only)
- AI classification (Claude with structured output, batched 75 emails/call)
- Aggregate statistics (category distribution, time estimates, automation opportunities)
- `workflow_diagnostics` + `diagnostic_skill_matches` tables
- Skill matching via existing hybrid search
- Dashboard page with KPI cards, category donut chart, skill recommendation cards
- Disconnect/revoke functionality

**Addresses:**
- All "must have" features from FEATURES.md
- Privacy architecture (analyze-and-discard) from ARCHITECTURE.md
- Token encryption from STACK.md

**Avoids:**
- Pitfall 1 (scope escalation) via separate OAuth flow
- Pitfall 2 (scope limitation) by using `gmail.readonly` with `format: 'metadata'`
- Pitfall 3 (token expiry) via proactive refresh with mutex
- Pitfall 4 (data retention) via in-memory processing and sanitized prompts
- Pitfall 5 (large mailbox timeout) via batching, date filtering, and sampling

**Research needed:** None (all patterns established in research)

### Phase 2: Deployment Intelligence
**Rationale:** Phase 1 shows "what's wrong." Phase 2 answers "what to do about it" with actionable deployment sequencing. This is the differentiator vs generic email analytics tools.

**Delivers:**
- Deployment plan with sequenced skill rollout (ordered by ROI)
- Cumulative savings graph (stacked bar showing total saved after each step)
- FTE Days Saved projection integrated with My Leverage page
- One-click skill install from recommendation cards (existing flow, just link to it)
- Re-run comparison (before/after delta view)
- "Biggest opportunity" highlight card

**Uses:**
- Existing skill `hoursSaved` and `activitiesSaved` fields for ROI scoring
- Existing My Leverage FTE tracking logic
- Existing skill install flow

**Research needed:** None (pure UX/logic, no new integrations)

### Phase 3: Polish & Testing (Optional — prioritize based on v2 feedback)
**Rationale:** These features improve UX but aren't essential for launch. Add based on user feedback after Phase 1+2 deployment.

**Delivers:**
- Historical trend graph (requires 3+ scans over time, enable naturally after months)
- Email pattern insights (busiest hour, response time percentile)
- Configurable time range (7d, 30d, 90d — currently hardcoded to 90d)
- Exportable report (PDF/summary download)

**Research needed:** None

### Phase Ordering Rationale

- **Phase 1 must be atomic** because OAuth + fetch + analyze + display are tightly coupled. Users can't connect Gmail without seeing results. They can't get recommendations without classification. Breaking Phase 1 into sub-phases creates no intermediate value.
- **Phase 2 builds on Phase 1 results** by adding deployment sequencing logic. It touches NO new external APIs (Gmail, Anthropic), only internal logic and UI.
- **Phase 3 is truly optional** — every feature here is a "nice to have" that Phase 1+2 users can live without.

### Research Flags

**Phase 1: Core Diagnostic**
- **Skip research-phase** — All patterns verified in this research. Gmail API quota/rate limits confirmed. OAuth incremental authorization pattern confirmed (with caveats). AI structured output pattern proven in existing `ai-review.ts`. Skill matching reuses existing infrastructure. This is "implementation-ready."

**Phase 2: Deployment Intelligence**
- **Skip research-phase** — Pure logic and UI. No new integrations. ROI scoring algorithm is straightforward (skill `hoursSaved` × relevance score). FTE Days Saved calculation already exists in My Leverage page.

**Phase 3: Polish & Testing**
- **Skip research-phase** — Standard UX patterns. If exportable report needs specific format (PDF generation), research at that time.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | **HIGH** | `@googleapis/gmail` is official Google client, actively maintained. Anthropic SDK pattern proven in `ai-review.ts`. Recharts usage verified in 3+ existing components. All dependencies compatible with Next.js 16.1.6 + React 19. |
| **Features** | **MEDIUM-HIGH** | Table stakes features verified via competitive analysis (EmailMeter, EmailAnalytics, timetoreply). Time estimation model is heuristic (not measurement) — transparent methodology is key to maintain trust. Skill matching logic is novel but leverages proven hybrid search. |
| **Architecture** | **HIGH** | Separate OAuth flow pattern verified via Auth.js GitHub discussions (#4557, #11819). Analyze-and-discard privacy model verified via GDPR data minimization principles. Token encryption pattern standard (AES-256-GCM). Multi-tenant schema pattern established across 17+ existing tables. |
| **Pitfalls** | **HIGH** | All critical pitfalls verified via official Google docs (OAuth scope behavior, Gmail API quota limits, token lifecycle). Auth.js limitations confirmed via GitHub issues. Privacy risks verified via Google Workspace API User Data Policy and GDPR guides. |

**Overall confidence:** **HIGH** for implementation-readiness. The critical OAuth scope decision (use `gmail.readonly` for date filtering) is the only outstanding architectural choice.

### Gaps to Address

1. **OAuth Scope Decision (MUST RESOLVE BEFORE IMPLEMENTATION):**
   - **Issue:** `gmail.metadata` scope recommended by Stack/Features/Architecture researchers, BUT Pitfalls researcher found it blocks date filtering via `q` parameter.
   - **Impact:** Without date filtering, analyzing 90 days requires fetching ALL mailbox IDs (impractical for 50K+ message mailboxes).
   - **Resolution:** Use `gmail.readonly` scope but ONLY request `format: 'metadata'` on all `messages.get` calls. This provides identical privacy (headers only, no body/attachments) while enabling date filtering. Document transparently in privacy notice: "We use the readonly scope to filter emails by date, but we never access message bodies or attachments."
   - **Verification:** Test with `gmail.metadata` scope — confirm `messages.list({ q: 'after:2025/11/16' })` returns 0 results. Test with `gmail.readonly` scope — confirm date filtering works AND `format: 'metadata'` prevents body access.

2. **Time Estimation Model Validation (VALIDATE DURING ALPHA):**
   - **Issue:** Time-per-email estimates are heuristic (category-weighted model with thread depth factors), not measured. Model needs calibration against real-world benchmarks.
   - **Resolution:** During alpha testing, compare estimates against industry benchmarks (McKinsey: 28% of workweek = ~11 hrs, Workplace Email Statistics: 5-15.5 hrs/wk). Adjust category weights if estimates consistently over/under-shoot. Display transparent methodology: "Estimated based on email volume, thread depth, and response patterns."
   - **Risk:** If estimates are wildly inaccurate, users lose trust. Transparent methodology + ranges (not point estimates) mitigate this.

3. **Google OAuth Verification Timeline (INITIATE EARLY):**
   - **Issue:** `gmail.readonly` and `gmail.metadata` are both "Restricted" scopes. For external user type, verification takes 2-6 months + $500-$4,500 for CASA security assessment.
   - **Resolution:** If EverySkill is internal-only (single Google Workspace domain), set OAuth consent screen to "Internal" user type — bypasses verification entirely. If external, initiate verification during Phase 1 implementation (development can proceed in "Testing" mode with 100 test users).
   - **Blocker:** Cannot serve >100 users until verification completes (for external apps).

4. **AI Classification Accuracy (VALIDATE DURING ALPHA):**
   - **Issue:** Claude classifies emails from headers only (From, Subject, Date, List-Unsubscribe). Accuracy for ambiguous cases (newsletters vs human emails with marketing subject lines) is unverified.
   - **Resolution:** Two-pass approach: rule-based pass (List-Unsubscribe header = newsletter, noreply@ sender = notification, domain matching = internal/external) catches ~70% with HIGH confidence. AI classification pass handles remaining ~30% ambiguous cases. During alpha, manually review a sample of classifications to calibrate.
   - **Risk:** If classification is poor, recommendations are irrelevant. Structured output with Zod validation prevents hallucinated categories, but accuracy within valid categories needs validation.

## Sources

### Primary (HIGH confidence)

**Gmail API & OAuth (official Google docs):**
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) — `gmail.metadata` vs `gmail.readonly` scope definitions, restriction levels, `q` parameter limitation on `gmail.metadata`
- [Gmail API Usage Limits](https://developers.google.com/workspace/gmail/api/reference/quota) — Per-method quota costs (5 units for messages.list/get, 10 for threads.list/get), rate limits (15K units/user/min)
- [Gmail API Batch Requests](https://developers.google.com/workspace/gmail/api/guides/batch) — Max 100 requests per batch
- [Gmail API Performance Tips](https://developers.google.com/workspace/gmail/api/guides/performance) — gzip, partial responses, metadata format
- [Google OAuth Incremental Authorization](https://developers.google.com/identity/sign-in/web/incremental-auth) — `include_granted_scopes=true` pattern
- [Google OAuth Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) — Verification timeline, CASA security assessment
- [Google Granular OAuth Consent](https://workspaceupdates.googleblog.com/2025/11/granular-oauth-consent-in-webapps.html) — Per-scope checkboxes since Nov 2025
- [Google Workspace API User Data Policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy) — Data minimization, limited use requirements

**Auth.js Integration:**
- [Auth.js Google Provider](https://authjs.dev/getting-started/providers/google) — Scope configuration, offline access, refresh tokens
- [Auth.js Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation) — JWT callback token persistence pattern, race condition warning

**Codebase Verification (2026-02-14):**
- `apps/web/auth.config.ts` — Current Google provider config with default scopes, scope extension point
- `apps/web/auth.ts` — JWT callback with tenantId injection, no token refresh implemented
- `packages/db/src/schema/auth.ts` — `accounts` table with `access_token`, `refresh_token`, `expires_at`, `scope` columns
- `apps/web/lib/ai-review.ts` — Existing Anthropic SDK structured output pattern with `output_config: json_schema`
- `packages/db/src/services/hybrid-search.ts` — Existing `hybridSearchSkills()` with RRF scoring
- `apps/web/components/overview-tab.tsx` — Existing Recharts usage (BarChart, AreaChart)

### Secondary (MEDIUM confidence)

**Email Analytics Competitors:**
- [EmailMeter](https://www.emailmeter.com) — Enterprise email analytics dashboard patterns
- [EmailAnalytics](https://emailanalytics.com/) — Team email metrics and response time tracking
- [Email Industry Report 2025-2026](https://clean.email/blog/insights/email-industry-report-2026) — Volume benchmarks (~117-121 emails/day for office workers)
- [Workplace Email Statistics 2025](https://blog.cloudhq.net/workplace-email-statistics/) — Time spent on email (5-15.5 hrs/wk)

**Auth.js Community (confirms incremental auth limitations):**
- [NextAuth Discussion #4557: Set Scopes on signIn](https://github.com/nextauthjs/next-auth/discussions/4557) — Per-request scope not supported
- [NextAuth Discussion #11819: Persist Gmail Permissions](https://github.com/nextauthjs/next-auth/discussions/11819) — Workaround: separate OAuth flow
- [NextAuth Issue #8205: Google Refresh Token Not Provided](https://github.com/nextauthjs/next-auth/issues/8205) — Edge cases in token refresh

**Privacy & Compliance:**
- [GDPR and Email](https://gdpr.eu/email-encryption/) — Data minimization principles for email processing
- [Google Workspace GDPR Guides](https://measuredcollective.com/gdpr-google-workspace-how-to-stay-compliant-with-gdpr/) — DPA requirements

### Tertiary (LOW confidence — informational only)

**Community Analysis (confirms pain points, but anecdotal):**
- [GMass: OAuth Incremental Authorization Is Useless](https://www.gmass.co/blog/oauth-incremental-authorization-is-useless/) — Consent screen re-displays all scopes (not just new ones), developer must handle scope merging
- [Google CASA Security Assessment 2025](https://deepstrike.io/blog/google-casa-security-assessment-2025) — $500-$4,500 approved lab cost, 2-6 month timeline (for external apps)

---
*Research completed: 2026-02-14*
*Ready for roadmap: YES*
*Critical decision: Resolve OAuth scope choice (recommend `gmail.readonly` + `format: 'metadata'`) before Phase 1 implementation*
