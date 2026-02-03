---
phase: 17-ai-review-pipeline
plan: 02
subsystem: api
tags: [anthropic-sdk, claude-haiku, structured-output, server-action, ai-review, zod, json-schema]

# Dependency graph
requires:
  - phase: 17-ai-review-pipeline/01
    provides: skill_reviews schema, service layer (getSkillReview, upsertSkillReview, toggleReviewVisibility), @anthropic-ai/sdk
provides:
  - generateSkillReview function calling Claude Haiku 4.5 with structured JSON output
  - requestAiReview server action with auth, content hash dedup, API call, and upsert
  - toggleAiReviewVisibility server action for author visibility toggle
  - ReviewOutputSchema and ReviewOutput type for six-category review structure
  - AiReviewState type for server action state management
affects: [17-03 (UI components consume server actions and display review data)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Manual JSON schema for output_config.format (Zod v3 lacks toJSONSchema)", "XML-tagged content delimiting for LLM prompts", "Anti-prompt-injection via system prompt"]

key-files:
  created:
    - apps/web/lib/ai-review.ts
    - apps/web/app/actions/ai-review.ts
  modified: []

key-decisions:
  - "Manual JSON schema instead of zodOutputFormat: Zod v3.25 lacks toJSONSchema() required by SDK helper"
  - "Categories field stores only the six category objects, summary stored separately (matches service layer UpsertSkillReviewParams)"
  - "stop_reason check uses 'end_turn' (not 'end_stop' as originally planned -- verified from SDK types)"

patterns-established:
  - "Structured output pattern: Construct JSON schema manually for output_config.format when zodOutputFormat is unavailable"
  - "Content dedup pattern: hashContent + existing review comparison before API call"

# Metrics
duration: 4min
completed: 2026-02-03
---

# Phase 17 Plan 02: Server Action & AI Review Logic Summary

**Claude Haiku 4.5 structured output review generation with manual JSON schema, content hash dedup, and author-only server actions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-03T21:05:49Z
- **Completed:** 2026-02-03T21:09:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `generateSkillReview` function that calls Claude Haiku 4.5 with structured JSON output via `output_config.format`
- Built `requestAiReview` server action with full auth, author-only authorization, content hash dedup, and error handling
- Built `toggleAiReviewVisibility` server action for author review visibility control
- Peer review system prompt with scoring guidelines and anti-prompt-injection protection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AI review generation library** - `3f94bfb` (feat)
2. **Task 2: Create requestAiReview server action** - `1fc06a0` (feat)

## Files Created/Modified
- `apps/web/lib/ai-review.ts` - Zod schemas, JSON schema, Anthropic client, system prompt, generateSkillReview function
- `apps/web/app/actions/ai-review.ts` - requestAiReview and toggleAiReviewVisibility server actions with auth, dedup, and error handling

## Decisions Made
- **Manual JSON schema instead of zodOutputFormat:** The `zodOutputFormat` helper from `@anthropic-ai/sdk/helpers/zod` requires Zod v4's `z.toJSONSchema()` function. Project uses Zod v3.25.76 which lacks this. Constructed equivalent JSON schema object manually -- clean, type-safe, and avoids adding a dependency.
- **Categories destructured from summary:** The `ReviewOutput` includes both category scores and summary. The server action destructures `{ summary, ...categories }` before persisting, matching the service layer's `UpsertSkillReviewParams` which expects categories and summary as separate fields.
- **stop_reason uses `end_turn`:** The plan specified `end_stop` but the Anthropic SDK types define the correct value as `end_turn`. Verified from SDK type definitions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] zodOutputFormat incompatible with Zod v3**
- **Found during:** Task 1 (AI review library creation)
- **Issue:** `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod` calls `z.toJSONSchema()` which only exists in Zod v4. Project uses Zod v3.25.76.
- **Fix:** Constructed the JSON schema manually as a plain object matching the `JSONOutputFormat` interface (`{ type: "json_schema", schema: {...} }`). The plan anticipated this as a fallback approach.
- **Files modified:** `apps/web/lib/ai-review.ts`
- **Verification:** TypeScript compiles, JSON schema structure matches ReviewOutputSchema exactly
- **Committed in:** 3f94bfb

**2. [Rule 1 - Bug] stop_reason value corrected from `end_stop` to `end_turn`**
- **Found during:** Task 1 (AI review library creation)
- **Issue:** Plan specified checking `stop_reason === "end_stop"` but SDK types define the correct value as `end_turn`
- **Fix:** Used correct `"end_turn"` value, verified from SDK type definitions
- **Files modified:** `apps/web/lib/ai-review.ts`
- **Verification:** TypeScript compiles with correct string literal type
- **Committed in:** 3f94bfb

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. The manual JSON schema approach was explicitly noted as a fallback in the plan. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required

**ANTHROPIC_API_KEY must be configured** (documented in 17-01-SUMMARY.md):
- Source: Anthropic Console -> API Keys (https://console.anthropic.com/settings/keys)
- Add to `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`

## Next Phase Readiness
- Server actions and AI review library ready for Plan 03 (UI components)
- `requestAiReview` can be consumed by a form with `useActionState`
- `toggleAiReviewVisibility` ready for visibility toggle UI
- `AiReviewState` type exported for client component state handling

---
*Phase: 17-ai-review-pipeline*
*Completed: 2026-02-03*
