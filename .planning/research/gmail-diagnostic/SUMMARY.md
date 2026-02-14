# Research Summary: Gmail Workflow Diagnostic

**Domain:** Email workflow analysis and AI-powered optimization recommendations
**Researched:** 2026-02-14
**Overall confidence:** HIGH

## Executive Summary

The Gmail Workflow Diagnostic feature extends EverySkill's existing Google OAuth integration to analyze email patterns and recommend workflow optimizations. The research reveals this is a surprisingly lightweight addition to the stack -- requiring at most 1 new npm dependency (`@googleapis/gmail`, already planned for v3.0) and zero changes to existing dependencies.

The core insight is that Claude (via the existing Anthropic SDK) replaces an entire NLP pipeline. Rather than adding `nlp.js`, `natural`, or custom classifiers, email metadata is sent to Claude in batches with structured JSON output -- the exact same pattern already proven in `ai-review.ts`. This means no training data, no model maintenance, and higher accuracy than rule-based classification.

The two highest-risk areas are: (1) Google's granular OAuth consent (rolled out Nov 2025), which allows users to uncheck Gmail access while keeping sign-in permissions -- every UI component must handle the "Gmail not granted" state gracefully; and (2) the privacy boundary between transient email metadata and persistent storage -- raw email headers must NEVER be written to the database, only computed aggregates.

The recommended scope is `gmail.metadata` (not `gmail.readonly`) -- it provides exactly the data needed (headers, labels, thread structure) without access to message bodies or attachments. Both scopes are "Restricted" level (same verification burden), but `gmail.metadata` signals stronger privacy intent and reduces data exposure surface.

## Key Findings

**Stack:** 0-1 new npm packages. `@googleapis/gmail` for API access (may already be installed from v3.0). Everything else uses existing Anthropic SDK, Recharts, Auth.js, and Drizzle ORM.

**Architecture:** Analyze-and-discard pattern -- fetch email metadata, classify in-memory with Claude, store only aggregate statistics. Raw email data never touches the database.

**Critical pitfall:** Granular OAuth consent means users can opt out of Gmail access. Every feature path must check `account.scope` before attempting Gmail API calls and provide a clear re-authorization path.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: OAuth & Gmail Service Foundation** - Extend Google provider scopes, build scope-gated UI component, implement Gmail service with token refresh and pagination
   - Addresses: OAuth scope extension, token management, metadata fetching
   - Avoids: Granular consent pitfall (scope gate built first)

2. **Phase 2: AI Classification Engine** - Build email classifier using Anthropic SDK, define classification schema, implement PII stripping for prompts
   - Addresses: Email categorization, automation potential scoring
   - Avoids: PII leakage pitfall (stripping rules defined before first API call)

3. **Phase 3: Dashboard & Visualization** - Build diagnostic dashboard with Recharts, display aggregate statistics, render skill recommendations
   - Addresses: Category distribution, response times, volume charts, skill matching
   - Avoids: Over-engineering pitfall (static charts only, no interactive filters in v1)

4. **Phase 4: Snapshot Storage & History** - Persist diagnostic snapshots, enable historical comparison, add JSONB schema versioning
   - Addresses: Historical comparison, trend detection
   - Avoids: JSONB drift pitfall (schema versioning from day one)

**Phase ordering rationale:**
- Phase 1 must come first because all other phases depend on Gmail API access
- Phase 2 depends on Phase 1 (needs metadata to classify) and produces the core analysis that Phase 3 visualizes
- Phase 3 depends on Phase 2 (needs classified data to display)
- Phase 4 is optional polish that depends on Phase 3 (needs a working dashboard before adding history)

**Research flags for phases:**
- Phase 1: Needs careful testing of granular consent flow. Auth.js v5 does not natively support incremental authorization.
- Phase 2: Classification accuracy depends on prompt engineering. Budget time for prompt iteration.
- Phase 3: Standard Recharts usage -- unlikely to need research.
- Phase 4: Standard Drizzle/JSONB -- unlikely to need research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (Gmail API package) | HIGH | Official Google package, already validated in v3.0 research, versions verified |
| Stack (OAuth integration) | HIGH | Auth.js Google provider scope extension documented and verified. Accounts table schema confirmed |
| Stack (AI classification) | HIGH | Same Anthropic SDK pattern as existing `ai-review.ts`. Proven in codebase |
| Stack (Recharts) | HIGH | Already used in 3 components. All needed chart types available |
| Features | HIGH | Table stakes are clear. Feature dependencies are straightforward |
| Architecture | HIGH | Analyze-and-discard pattern is well-understood. Component boundaries are clean |
| Pitfalls (granular consent) | HIGH | Google's rollout is documented and confirmed. Testing strategy is clear |
| Pitfalls (scope verification) | MEDIUM | Internal app bypass is documented but policy could change. External app verification timeline is uncertain |
| Cost estimates | MEDIUM | Based on Anthropic pricing and estimated email volumes. Actual cost depends on real usage patterns |

## Gaps to Address

- **Incremental authorization UX**: Auth.js v5 does not natively support requesting additional scopes after initial sign-in. The recommended workaround (sign out + sign in with new scopes) is functional but not ideal. Phase-specific research may be needed if a smoother UX is required.
- **Classification accuracy**: The AI classification approach is sound in principle but the actual prompt needs iteration with real email metadata. Budget for prompt engineering time.
- **Scan progress UX**: The best pattern for reporting progress during a 2-minute server action needs implementation experimentation. Options include streaming, polling, or chunked responses.
- **Google Workspace admin restrictions**: Some Workspace admins restrict which scopes third-party apps can request. This is outside EverySkill's control but should be documented for users who encounter it.
