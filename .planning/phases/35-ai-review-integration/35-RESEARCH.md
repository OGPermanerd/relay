# Phase 35: AI Review Integration - Research

**Researched:** 2026-02-08
**Domain:** AI review pipeline automation, MCP tool development, state machine transitions
**Confidence:** HIGH

## Summary

Phase 35 transforms the existing fire-and-forget AI review system into a pipeline gate that automatically triggers when a skill enters `pending_review`, transitions to `ai_reviewed` on success, and handles failures with visible error state. It also adds auto-approve logic for high-scoring skills and three new MCP tools (`review_skill`, `submit_for_review`, `check_review_status`).

The existing infrastructure is mature: `generateSkillReview()` in `apps/web/lib/ai-review.ts` already produces structured scores via Anthropic SDK v0.72.1 with JSON schema output, the `skill_reviews` table stores review data with content hash deduplication, and the `skill-status.ts` state machine defines `pending_review -> ai_reviewed` as a valid transition. The primary work is: (1) adding an error state column to skills for failed reviews, (2) wiring the submit-for-review action to trigger AI review with proper error handling instead of fire-and-forget, (3) adding auto-approve threshold logic, (4) adding `@anthropic-ai/sdk` to the MCP package or extracting the review function, and (5) implementing three new MCP tool registrations.

**Primary recommendation:** Modify the `submitForReview` action to trigger AI review inline (await, not fire-and-forget), add a `statusMessage` text column to `skills` for error state visibility, implement auto-approve threshold as a configurable constant (default 7, all three categories), and add `@anthropic-ai/sdk` as a dependency to `apps/mcp` so MCP tools can call `generateSkillReview` directly via a shared extraction in `packages/db` or a duplicated lightweight function.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.72.1 | AI review generation via Claude | Already used in apps/web, proven structured output with json_schema |
| @modelcontextprotocol/sdk | ^1.25.3 | MCP tool registration | Already used in apps/mcp for all existing tools |
| drizzle-orm | ^0.42.0 | Database operations | Already used project-wide |
| zod | ^3.25.0 | Input validation for MCP tools | Already used in all MCP tool definitions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @everyskill/db | workspace:* | Shared DB schema, services, client | All database operations in both web and MCP |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Adding @anthropic-ai/sdk to MCP | API endpoint on web that MCP calls | Adds network hop, auth complexity, and latency; MCP already has DB access so direct SDK call is simpler |
| Shared package for AI review | Duplicate the function in MCP | AI review function is 50 lines, duplication is acceptable; shared package adds build complexity |
| Database column for error state | Separate review_errors table | Over-engineering; a statusMessage column on skills is simpler and the error state is transient |

**Installation:**
```bash
cd apps/mcp && pnpm add @anthropic-ai/sdk
```

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  services/
    skill-status.ts          # Add auto-approve logic here
    skill-reviews.ts         # Existing, no changes needed
  schema/
    skills.ts                # Add statusMessage column

apps/web/
  lib/
    ai-review.ts             # Existing, no changes needed
  app/actions/
    submit-for-review.ts     # Wire AI review trigger here (MAIN CHANGE)

apps/mcp/src/
  tools/
    review-skill.ts          # NEW: MCPR-01
    submit-for-review.ts     # NEW: MCPR-02
    check-review-status.ts   # NEW: MCPR-03
    index.ts                 # Add imports for new tools
```

### Pattern 1: Inline AI Review on Submit (Not Fire-and-Forget)
**What:** When `submitForReview` transitions a skill to `pending_review`, it immediately awaits the AI review call, transitions to `ai_reviewed` on success, or stays in `pending_review` with a `statusMessage` on failure.
**When to use:** This is THE core pattern for RVPL-03/RVPL-04.
**Example:**
```typescript
// apps/web/app/actions/submit-for-review.ts
export async function submitForReview(skillId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!db) return { error: "Database not configured" };

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, skillId), eq(skills.authorId, session.user.id)),
    columns: { id: true, status: true, name: true, description: true, content: true, category: true },
  });
  if (!skill) return { error: "Skill not found" };
  if (!canTransition(skill.status as SkillStatus, "pending_review")) {
    return { error: `Cannot submit for review from status '${skill.status}'` };
  }

  // Step 1: Transition to pending_review immediately
  await db.update(skills)
    .set({ status: "pending_review", statusMessage: null, updatedAt: new Date() })
    .where(eq(skills.id, skillId));

  // Step 2: Run AI review (NOT fire-and-forget)
  try {
    const reviewOutput = await generateSkillReview(
      skill.name, skill.description ?? "", skill.content, skill.category ?? "prompt"
    );
    const { summary, suggestedDescription, ...categories } = reviewOutput;
    const contentHash = await hashContent(skill.content);

    await upsertSkillReview({
      skillId, requestedBy: session.user.id,
      categories, summary, suggestedDescription,
      reviewedContentHash: contentHash, modelName: REVIEW_MODEL,
    });

    // Step 3: Check auto-approve threshold
    const autoApproved = checkAutoApprove(categories);
    const nextStatus = autoApproved ? "approved" : "ai_reviewed";

    await db.update(skills)
      .set({ status: nextStatus, statusMessage: null, updatedAt: new Date() })
      .where(eq(skills.id, skillId));

    // Step 4: If auto-approved, also publish
    if (autoApproved) {
      await db.update(skills)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(skills.id, skillId));
    }

    revalidatePath("/my-skills");
    return { success: true, autoApproved };
  } catch (error) {
    // Step 3 (error): Stay in pending_review with visible error
    await db.update(skills)
      .set({ statusMessage: "AI review failed. Please try again later.", updatedAt: new Date() })
      .where(eq(skills.id, skillId));

    revalidatePath("/my-skills");
    return { error: "AI review service is temporarily unavailable. Your skill is saved and you can retry." };
  }
}
```

### Pattern 2: Auto-Approve Threshold Check
**What:** Pure function that checks if all three AI review scores meet a configurable threshold.
**When to use:** After AI review completes successfully, before determining next status.
**Example:**
```typescript
// packages/db/src/services/skill-status.ts
export const DEFAULT_AUTO_APPROVE_THRESHOLD = 7;

export function checkAutoApprove(
  categories: { quality: { score: number }; clarity: { score: number }; completeness: { score: number } },
  threshold: number = DEFAULT_AUTO_APPROVE_THRESHOLD
): boolean {
  return (
    categories.quality.score >= threshold &&
    categories.clarity.score >= threshold &&
    categories.completeness.score >= threshold
  );
}
```

### Pattern 3: MCP Tool with Auth + DB Access
**What:** MCP tool that requires authentication, queries DB, and returns structured JSON.
**When to use:** All three new MCP tools follow this pattern.
**Example:**
```typescript
// apps/mcp/src/tools/check-review-status.ts
import { z } from "zod";
import { server } from "../server.js";
import { db } from "@everyskill/db";
import { getUserId, getTenantId } from "../auth.js";

server.registerTool(
  "check_review_status",
  {
    description: "Check the review status of your submitted skills. Returns status, AI review scores if available, and any error messages.",
    inputSchema: {
      skillId: z.string().optional().describe("Check a specific skill by ID. Omit to see all your submitted skills."),
    },
  },
  async ({ skillId }) => {
    const userId = getUserId();
    if (!userId) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Authentication required. Set EVERYSKILL_API_KEY." }) }],
        isError: true,
      };
    }
    if (!db) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) }],
        isError: true,
      };
    }
    // Query skills + reviews, return status info
    // ... (implementation follows existing MCP tool patterns)
  }
);
```

### Pattern 4: MCP review_skill with Anthropic SDK
**What:** The `review_skill` MCP tool needs to call the Anthropic API directly from the MCP server process.
**When to use:** MCPR-01 requirement.
**Key decision:** The AI review logic (`generateSkillReview`) lives in `apps/web/lib/ai-review.ts` and cannot be imported from MCP (different package). Options:
1. **Duplicate the function in MCP** (recommended) -- it's ~50 lines, self-contained, uses only `@anthropic-ai/sdk` and `zod`
2. **Extract to a shared package** (over-engineering for 50 lines)
3. **Call a web API endpoint** (adds latency, auth complexity)

```typescript
// apps/mcp/src/tools/review-skill.ts
// Duplicate the review generation function (50 lines from apps/web/lib/ai-review.ts)
// + tool registration that fetches skill, runs review, stores result, returns scores
```

### Anti-Patterns to Avoid
- **Fire-and-forget for pipeline AI review:** The existing `autoGenerateReview().catch(() => {})` pattern in `skills.ts` swallows errors. The pipeline review MUST use try/catch with explicit error state.
- **Reusing autoGenerateReview():** This function was designed for advisory reviews and swallows errors. Write a new inline flow in `submitForReview`.
- **Adding a separate review_decisions table for Phase 35:** The research suggested this but it's over-engineering for this phase. The `skill_reviews` table already stores the AI review data, and the `skills.status` column tracks the pipeline state. A separate `review_decisions` table makes sense for Phase 36 (admin review audit trail), not Phase 35.
- **Adding an `ai_reviewing` intermediate state:** The state machine already has `pending_review -> ai_reviewed`. Adding `ai_reviewing` would require a new state in the enum, new UI handling, and the transition is synchronous from the user's perspective (they wait for the result). Keep it simple: `pending_review` means "AI review is running or failed."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured AI output | Custom JSON parsing | Anthropic `output_config.format.json_schema` | Already proven in ai-review.ts line 127-129, handles edge cases |
| Content hash | Manual hashing | Existing `hashContent()` from `apps/web/lib/content-hash.ts` | Web Crypto API, works in Node and Edge |
| State machine validation | Inline if/else chains | Existing `canTransition()` from `packages/db/src/services/skill-status.ts` | Pure function, tested, 7 states defined |
| MCP tool registration | Raw MCP protocol | `server.registerTool()` from `@modelcontextprotocol/sdk` | Type-safe, validates input schema via zod |
| Review upsert | Custom SQL | Existing `upsertSkillReview()` from `packages/db/src/services/skill-reviews.ts` | Handles ON CONFLICT, tenant isolation |

**Key insight:** Phase 35's core logic is gluing together existing pieces (AI review function + state machine + MCP tool registration). The only new code is the orchestration in `submitForReview` and the three MCP tool handlers.

## Common Pitfalls

### Pitfall 1: AI Review Runs Fire-and-Forget (Skill Gets Stuck)
**What goes wrong:** If AI review is triggered with `.catch(() => {})` and the API call fails, the skill stays in `pending_review` forever with no indication of failure.
**Why it happens:** The existing `autoGenerateReview()` in `skills.ts` uses exactly this pattern because it was advisory. Copying this pattern for pipeline reviews is natural but wrong.
**How to avoid:** The `submitForReview` action must `await` the AI review call inside a try/catch. On failure, set `statusMessage` on the skill row and return an error to the user. The skill remains in `pending_review` (valid state for retry) but with a visible error message.
**Warning signs:** If `submitForReview` returns `{ success: true }` before the AI review completes, the pattern is wrong.

### Pitfall 2: State Machine Doesn't Allow Auto-Approve Path
**What goes wrong:** The current `VALID_TRANSITIONS` has `ai_reviewed -> approved` but NOT `pending_review -> approved`. If auto-approve skips the `ai_reviewed` state, the state machine blocks it.
**Why it happens:** Auto-approve is a shortcut path not in the original state machine design.
**How to avoid:** Two approaches: (a) go through `ai_reviewed` then `approved` programmatically (two transitions in sequence), or (b) add `pending_review -> approved` to VALID_TRANSITIONS. Approach (a) is cleaner because it maintains the audit trail (skill was reviewed, then approved). The auto-approve flow should be: `pending_review -> ai_reviewed -> approved -> published`, all within the same `submitForReview` call.
**Warning signs:** `canTransition("pending_review", "approved")` returns false.

### Pitfall 3: MCP Server Cannot Import apps/web Modules
**What goes wrong:** Trying to import `generateSkillReview` from `apps/web/lib/ai-review.ts` into `apps/mcp/src/tools/review-skill.ts` fails because they are separate packages with different build systems.
**Why it happens:** `apps/web` uses Next.js bundler, `apps/mcp` uses tsup. Cross-app imports don't work in this monorepo structure.
**How to avoid:** Duplicate the `generateSkillReview` function in the MCP tool file. It's ~50 lines with only `@anthropic-ai/sdk` and `zod` as dependencies. Add `@anthropic-ai/sdk` to `apps/mcp/package.json`.
**Warning signs:** Build errors mentioning "Cannot find module" or "next/server" references.

### Pitfall 4: ANTHROPIC_API_KEY Not Available in MCP Server
**What goes wrong:** The MCP server runs as a standalone process (stdio transport). Environment variables like `ANTHROPIC_API_KEY` may not be configured in the MCP server's environment.
**Why it happens:** MCP servers launched by Claude Desktop get their env from the MCP config, not from the web app's `.env.local`.
**How to avoid:** The `review_skill` MCP tool must check for `ANTHROPIC_API_KEY` at call time and return a clear error message if missing: "ANTHROPIC_API_KEY is required. Add it to your MCP server configuration." Document this in the tool description.
**Warning signs:** "API key not set" errors only in MCP context, not web context.

### Pitfall 5: Auto-Approve Bypasses Published Status
**What goes wrong:** Auto-approve transitions to `approved` but not `published`. Skills that are approved but not published are invisible to the public.
**Why it happens:** The state machine has `approved -> published` as a separate transition, intended for admin workflow where approval and publishing are distinct steps.
**How to avoid:** For auto-approved skills, chain the transitions: `ai_reviewed -> approved -> published` in one call. The auto-approve path is: AI scores meet threshold -> skip admin queue -> publish immediately.
**Warning signs:** Skills stuck in `approved` status that nobody ever transitions to `published`.

### Pitfall 6: Retry After AI Review Failure Creates Duplicate Reviews
**What goes wrong:** Author clicks "Submit for Review" again after a failure. The upsert in `skill-reviews.ts` handles this correctly (ON CONFLICT replaces), but the status transition `pending_review -> pending_review` is not in VALID_TRANSITIONS.
**Why it happens:** The skill is already in `pending_review` and the author wants to retry.
**How to avoid:** Add a retry mechanism that does NOT require a status transition. If skill is already in `pending_review`, the retry just runs the AI review again and transitions to `ai_reviewed` on success. Alternatively, add a "Retry Review" button that calls a different action (or the same action with retry logic). The simplest approach: check if status is already `pending_review` and skip the transition step, going straight to the AI review call.
**Warning signs:** "Cannot submit for review from status 'pending_review'" error when retrying.

### Pitfall 7: MCP submit_for_review Duplicates Web Logic
**What goes wrong:** The MCP `submit_for_review` tool reimplements the entire submit + AI review flow, creating two divergent code paths.
**Why it happens:** MCP tools can't import server actions from `apps/web`.
**How to avoid:** Extract the core logic (state check -> transition -> AI review -> auto-approve check) into a function in `packages/db/src/services/` or keep the web action as source of truth and have the MCP tool call the same DB operations directly. The MCP tool needs to: (1) verify ownership, (2) check canTransition, (3) update status, (4) run AI review, (5) check auto-approve. This is unavoidable duplication but should be kept minimal.

## Code Examples

### Error State Column Migration
```sql
-- 0014_add_status_message.sql
ALTER TABLE skills ADD COLUMN IF NOT EXISTS status_message TEXT;
```

### Schema Update
```typescript
// packages/db/src/schema/skills.ts - add to table definition
statusMessage: text("status_message"), // Error message for failed reviews, null when no error
```

### Submit-for-Review with AI Review (Full Pattern)
```typescript
// apps/web/app/actions/submit-for-review.ts
"use server";

import { auth } from "@/auth";
import { db, skills } from "@everyskill/db";
import { eq, and } from "drizzle-orm";
import { canTransition, checkAutoApprove, type SkillStatus } from "@everyskill/db/services/skill-status";
import { upsertSkillReview } from "@everyskill/db/services/skill-reviews";
import { revalidatePath } from "next/cache";
import { generateSkillReview, REVIEW_MODEL } from "@/lib/ai-review";
import { hashContent } from "@/lib/content-hash";

export async function submitForReview(skillId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!db) return { error: "Database not configured" };

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, skillId), eq(skills.authorId, session.user.id)),
    columns: { id: true, status: true, name: true, description: true, content: true, category: true },
  });
  if (!skill) return { error: "Skill not found" };

  const currentStatus = skill.status as SkillStatus;

  // Allow both initial submit (draft -> pending_review) and retry (already pending_review)
  if (currentStatus !== "pending_review" && !canTransition(currentStatus, "pending_review")) {
    return { error: `Cannot submit for review from status '${skill.status}'` };
  }

  // Transition to pending_review (clear any previous error)
  if (currentStatus !== "pending_review") {
    await db.update(skills)
      .set({ status: "pending_review", statusMessage: null, updatedAt: new Date() })
      .where(eq(skills.id, skillId));
  } else {
    // Retry: clear previous error message
    await db.update(skills)
      .set({ statusMessage: null, updatedAt: new Date() })
      .where(eq(skills.id, skillId));
  }

  try {
    const reviewOutput = await generateSkillReview(
      skill.name, skill.description ?? "", skill.content, skill.category ?? "prompt"
    );
    const { summary, suggestedDescription, ...categories } = reviewOutput;
    const contentHash = await hashContent(skill.content);

    await upsertSkillReview({
      skillId,
      requestedBy: session.user.id,
      categories,
      summary,
      suggestedDescription,
      reviewedContentHash: contentHash,
      modelName: REVIEW_MODEL,
    });

    // Check auto-approve
    const autoApproved = checkAutoApprove(categories);
    const finalStatus: SkillStatus = autoApproved ? "published" : "ai_reviewed";

    await db.update(skills)
      .set({ status: finalStatus, statusMessage: null, updatedAt: new Date() })
      .where(eq(skills.id, skillId));

    revalidatePath("/my-skills");
    return { success: true, autoApproved };
  } catch (error) {
    console.error("AI review failed for skill", skillId, error);
    await db.update(skills)
      .set({
        statusMessage: "AI review failed — please try again later or contact support.",
        updatedAt: new Date(),
      })
      .where(eq(skills.id, skillId));

    revalidatePath("/my-skills");
    return { error: "AI review is temporarily unavailable. Your skill is saved and you can retry." };
  }
}
```

### MCP review_skill Tool (Duplicated AI Review)
```typescript
// apps/mcp/src/tools/review-skill.ts
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { server } from "../server.js";
import { db } from "@everyskill/db";
import { getUserId, getTenantId } from "../auth.js";

// Self-contained review generation (duplicated from apps/web/lib/ai-review.ts)
const REVIEW_MODEL = process.env.AI_REVIEW_MODEL || "claude-sonnet-4-20250514";

async function generateReview(name: string, description: string, content: string, category: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });
  // ... (same SYSTEM_PROMPT, REVIEW_JSON_SCHEMA, and API call as ai-review.ts)
}

server.registerTool(
  "review_skill",
  {
    description: "Trigger an AI review of a skill. Returns quality, clarity, and completeness scores with actionable suggestions. Requires ANTHROPIC_API_KEY.",
    inputSchema: {
      skillId: z.string().describe("ID of the skill to review"),
    },
  },
  async ({ skillId }) => {
    const userId = getUserId();
    if (!userId) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Authentication required" }) }], isError: true };
    }
    // Fetch skill, run review, store result, return scores
  }
);
```

### Displaying Error State in My Skills
```typescript
// apps/web/components/my-skills-list.tsx - add to MySkillItem interface
export interface MySkillItem {
  // ... existing fields
  statusMessage: string | null; // Error message when AI review fails
}

// In the component, show error message below the status badge:
{skill.statusMessage && (
  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
    <span>{skill.statusMessage}</span>
    <button onClick={() => submitForReview(skill.id)} className="underline">
      Retry
    </button>
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fire-and-forget AI review | Awaited AI review with error handling | Phase 35 | Skills no longer get stuck in limbo |
| Manual AI review request | Auto-trigger on submit-for-review | Phase 35 | Authors don't need to separately request review |
| All reviewed skills enter admin queue | High-scoring skills auto-approve | Phase 35 | Reduces admin workload |
| Web-only review workflow | MCP-based review tools | Phase 35 | Authors can review/submit/check from Claude |

**Deprecated/outdated:**
- `autoGenerateReview()` in `apps/web/app/actions/skills.ts` (line 110): Fire-and-forget pattern that swallows errors. Should NOT be used for pipeline reviews. The advisory auto-review on skill creation can remain fire-and-forget since it's not part of the pipeline.

## Open Questions

1. **Auto-approve threshold value**
   - What we know: Research suggests "all categories >= 7" as default. This is arbitrary.
   - What's unclear: What distribution of scores existing skills have. A threshold of 7 might auto-approve everything or nothing.
   - Recommendation: Use 7 as default, make it a constant in `skill-status.ts`. Can be made configurable per-tenant via `site_settings` later. Start with a constant for Phase 35.

2. **Should auto-approve go directly to published or stop at approved?**
   - What we know: State machine has `approved -> published` as separate transitions. The admin queue expects `ai_reviewed` skills.
   - What's unclear: Whether there's a use case for "approved but not published" without admin intervention.
   - Recommendation: Auto-approve should go straight to `published` (skip both admin queue AND the separate publish step). The auto-approve path replaces the entire admin review workflow for high-quality skills.

3. **MCP review_skill: should it also trigger status transitions?**
   - What we know: MCPR-01 says "triggers AI review from within Claude conversation, returns scores and suggestions." It does NOT mention status transitions.
   - What's unclear: Whether review_skill should be advisory-only (return scores, no state change) or pipeline-integrated (trigger review + transition).
   - Recommendation: `review_skill` should be advisory-only -- run AI review, store result, return scores, but do NOT change skill status. Status transitions are handled by `submit_for_review`. This keeps tool responsibilities clean: review = get scores, submit = enter pipeline.

4. **Should the state machine allow pending_review -> pending_review for retries?**
   - What we know: The retry scenario (AI review failed, author wants to try again) doesn't fit the current state machine.
   - What's unclear: Whether to add a self-transition or bypass the state machine for retries.
   - Recommendation: Don't add self-transitions. Instead, check if status is already `pending_review` at the top of `submitForReview` and skip the transition step, going straight to the AI review call. This keeps the state machine clean.

## Sources

### Primary (HIGH confidence)
- `apps/web/lib/ai-review.ts` -- Verified AI review function implementation (147 lines, Anthropic SDK structured output)
- `packages/db/src/services/skill-status.ts` -- Verified state machine (56 lines, 7 states, transition rules)
- `packages/db/src/services/skill-reviews.ts` -- Verified upsert/get/toggle functions (92 lines)
- `packages/db/src/schema/skills.ts` -- Verified schema (89 lines, status column exists)
- `packages/db/src/schema/skill-reviews.ts` -- Verified schema (80 lines, categories JSONB, content hash)
- `apps/web/app/actions/submit-for-review.ts` -- Verified current submit action (35 lines, state machine check)
- `apps/web/app/actions/ai-review.ts` -- Verified on-demand review action (159 lines)
- `apps/web/app/actions/skills.ts` -- Verified fire-and-forget autoGenerateReview (line 110-141)
- `apps/mcp/src/tools/create.ts` -- Verified MCP tool registration pattern (273 lines)
- `apps/mcp/src/auth.ts` -- Verified MCP auth module (91 lines, userId/tenantId caching)
- `apps/mcp/package.json` -- Verified: NO @anthropic-ai/sdk dependency currently
- `.planning/phases/34-review-pipeline-foundation/34-VERIFICATION.md` -- Phase 34 complete, all 9 requirements satisfied

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` -- Pitfall 3 (dual identity of AI review) is well-documented
- `.planning/research/FEATURES.md` -- Auto-approval threshold feature spec
- `.planning/research/SUMMARY.md` -- Phase structure and dependency analysis

### Tertiary (LOW confidence)
- Auto-approve threshold of 7: Based on research inference, not data-driven. Flag for tuning after observing real score distributions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in use, versions verified from package.json
- Architecture: HIGH -- Extends proven patterns (MCP tools, state machine, DB services), all integration points verified in source code
- Pitfalls: HIGH -- Each pitfall verified against actual source code (fire-and-forget pattern at skills.ts line 138, state machine at skill-status.ts line 33, MCP build at apps/mcp/tsconfig.json)
- Auto-approve threshold: LOW -- The value of 7 is arbitrary; needs real data to validate

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable domain, no external API changes expected)
