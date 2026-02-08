# Phase 31: Skills & Upload Enhancements - Research

**Researched:** 2026-02-08
**Domain:** Upload UX, AI review pipeline, relative timestamps, in-app messaging
**Confidence:** HIGH

## Summary

This phase enhances the skill upload experience across seven requirements: relative timestamps platform-wide (SKILL-01), a rich similarity pane on upload (SKILL-02), hiding the semantic/name match label (SKILL-03), a "message author" feature for proposing grouping (SKILL-04), auto-generated AI review on upload (SKILL-05), AI-suggested description modifications (SKILL-06), and feeding AI review data into duplicate detection (SKILL-07).

The codebase already has solid infrastructure for all of these. Similarity detection (`lib/similar-skills.ts`) supports both semantic (Ollama/pgvector) and ILIKE fallback. AI review (`lib/ai-review.ts`) uses the Anthropic SDK v0.72.1 with Claude Sonnet 4 and outputs structured JSON via prompt-based extraction. The upload form (`components/skill-upload-form.tsx`) uses `useActionState` with a combined `checkAndCreateSkill` server action. Timestamps are currently formatted as absolute dates ("Jan 15, 2026") across ~15 component locations, with a mix of manual UTC formatting and `toLocaleDateString()` calls (the latter causing hydration mismatches, as noted in MEMORY.md).

**Primary recommendation:** Implement the seven requirements as incremental modifications to existing infrastructure -- the relative timestamp utility is a new shared module, the similarity pane is a reworked version of the existing SimilarSkillsWarning component, AI review auto-triggers in the server action after skill creation, and the "message author" feature needs a new `skill_messages` DB table plus lightweight UI.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.72.1 | AI review generation + description suggestions | Already installed, has `zodOutputFormat` helper for structured outputs |
| drizzle-orm | 0.42.0 | Database schema, queries, migrations | Project standard ORM |
| zod | 3.25.0 | Schema validation for form data + AI output parsing | Already used for review output schema |
| react | 19.0.0 | UI components with `useActionState` | Project framework |
| next | 16.1.6 | Server actions, routing, revalidation | Project framework |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| recharts | 3.7.0 | Analytics charts (not directly needed this phase) | If any visual enhancements needed |
| tailwindcss | 4.0.0 | Styling all new components | All UI work |

### No New Dependencies Needed
This phase requires zero new npm packages. The relative timestamp utility is a ~30-line pure function. The messaging feature uses existing DB patterns. The enhanced AI review uses the already-installed Anthropic SDK with its `zodOutputFormat` helper.

## Architecture Patterns

### Recommended File Structure
```
apps/web/
  lib/
    relative-time.ts           # NEW: formatRelativeTime() utility
    similar-skills.ts           # MODIFY: add AI review data to scoring
    ai-review.ts               # MODIFY: add description suggestion output
  components/
    relative-time.tsx           # NEW: <RelativeTime date={...} /> component
    similarity-pane.tsx         # NEW: right-hand pane for upload flow
    similar-skills-warning.tsx  # MODIFY: remove matchType label display
    similar-skills-section.tsx  # MODIFY: remove matchType label display
    skill-upload-form.tsx       # MODIFY: integrate similarity pane + auto-review
    message-author-dialog.tsx   # NEW: modal for proposing skill grouping
  app/
    actions/
      skills.ts                # MODIFY: auto-trigger AI review after creation
      skill-messages.ts        # NEW: send/list skill grouping proposals
packages/db/src/
  schema/
    skill-messages.ts          # NEW: skill_messages table
  services/
    skill-messages.ts          # NEW: CRUD for messages
  relations/
    index.ts                   # MODIFY: add skillMessages relations
  migrations/
    0009_create_skill_messages.sql  # NEW: migration
```

### Pattern 1: Relative Timestamp Utility (SKILL-01)
**What:** A pure function that converts a Date to relative format: "1d 5h 3min ago" for < 1 year, "1y 5d ago" for >= 1 year.
**When to use:** Every timestamp display across the platform.
**Why hand-build:** `Intl.DurationFormat` is not available in Node.js 22 (verified: throws "not a constructor"). `Intl.RelativeTimeFormat` produces "3 hours ago" not "1d 5h 3min ago". The required format is custom and compact, best served by a ~30-line utility.

**Example:**
```typescript
// apps/web/lib/relative-time.ts
export function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const years = Math.floor(days / 365);

  if (years >= 1) {
    const remainingDays = days - years * 365;
    return remainingDays > 0
      ? `${years}y ${remainingDays}d ago`
      : `${years}y ago`;
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0 && days < 7) parts.push(`${minutes % 60}min`);

  return parts.length > 0 ? parts.join(" ") + " ago" : "just now";
}
```

**Hydration safety:** This function uses `Date.now()` which differs between server and client render. Wrap in a client component:
```typescript
// apps/web/components/relative-time.tsx
"use client";
import { useState, useEffect } from "react";
import { formatRelativeTime } from "@/lib/relative-time";

export function RelativeTime({ date }: { date: Date | string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(formatRelativeTime(date));
    const interval = setInterval(() => setText(formatRelativeTime(date)), 60_000);
    return () => clearInterval(interval);
  }, [date]);
  return <span>{text}</span>;
}
```

### Pattern 2: Enhanced AI Review with Description Suggestions (SKILL-05, SKILL-06)
**What:** Extend the AI review to include `suggestedDescription` in its output, and auto-trigger on upload instead of on-demand.
**When to use:** In the `checkAndCreateSkill` server action, fire-and-forget after skill creation.

**Example -- enhanced review schema:**
```typescript
// apps/web/lib/ai-review.ts -- enhanced output
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const EnhancedReviewSchema = z.object({
  quality: ReviewCategorySchema,
  clarity: ReviewCategorySchema,
  completeness: ReviewCategorySchema,
  summary: z.string(),
  suggestedDescription: z.string().describe(
    "An improved version of the skill description that the author can copy. Keep the same meaning but improve clarity, specificity, and searchability."
  ),
});

// Use structured outputs for guaranteed schema compliance
const response = await client.messages.create({
  model: REVIEW_MODEL,
  max_tokens: 2048,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: userPrompt }],
  output_config: { format: zodOutputFormat(EnhancedReviewSchema) },
});
```

### Pattern 3: Auto-Review on Upload (SKILL-05)
**What:** After skill creation succeeds, fire-and-forget an AI review generation.
**When to use:** In `checkAndCreateSkill` server action, after the skill is persisted.

```typescript
// In apps/web/app/actions/skills.ts -- after skill creation
// Fire-and-forget: generate embedding AND AI review
generateSkillEmbedding(newSkill.id, name, description).catch(() => {});
autoGenerateReview(newSkill.id, name, description, rawContent, category).catch(() => {});
```

### Pattern 4: Skill Messages Table (SKILL-04)
**What:** A new `skill_messages` table for users to propose grouping their skill under an existing similar skill.
**When to use:** When a user clicks "Message Author" on a similar skill during upload.

```typescript
// packages/db/src/schema/skill-messages.ts
export const skillMessages = pgTable("skill_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  fromUserId: text("from_user_id").notNull().references(() => users.id),
  toUserId: text("to_user_id").notNull().references(() => users.id),
  subjectSkillId: text("subject_skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  proposedParentSkillId: text("proposed_parent_skill_id").references(() => skills.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
}, (table) => [
  index("skill_messages_to_user_idx").on(table.toUserId),
  index("skill_messages_tenant_id_idx").on(table.tenantId),
  pgPolicy("tenant_isolation", {
    as: "restrictive", for: "all",
    using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
  }),
]);
```

### Pattern 5: Rich Similarity Pane (SKILL-02)
**What:** A right-side panel that shows AI-summarized matches with highlighted semantic overlaps when uploading a skill.
**When to use:** Replace the existing inline `SimilarSkillsWarning` with a side-panel layout.

The existing upload page uses `max-w-2xl` centered layout. The similarity pane should use a two-column layout: form on the left, similarity pane on the right (collapsible on mobile).

### Anti-Patterns to Avoid
- **Using `Intl.DurationFormat`:** Not available in Node.js 22. Will crash at runtime.
- **Using `toLocaleDateString()` or `toLocaleString()` for any date display:** Causes hydration mismatches (documented in MEMORY.md). Use the new `<RelativeTime>` client component instead.
- **Blocking skill creation on AI review:** The review should be fire-and-forget. If the API is down, the skill still gets created.
- **Making the similarity pane a separate page/route:** It should be an inline panel within the upload form, shown as results come back.
- **Storing AI review suggestions in a separate table:** Extend the existing `skill_reviews.categories` JSONB to include `suggestedDescription`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured AI output parsing | Manual JSON.parse + regex cleanup | `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod` | Guarantees schema compliance via constrained decoding; no parsing errors |
| Complex relative time library | Full i18n-aware duration formatter | Simple 30-line `formatRelativeTime()` utility | The format spec is custom ("1d 5h 3min ago"), no library matches it exactly |
| Real-time messaging system | WebSocket chat, read receipts, typing indicators | Simple DB-backed message table + server actions | SKILL-04 is "propose grouping", not chat. Simple CRUD suffices |
| Email notifications for messages | Transactional email service integration | In-app notification badge + messages list page | Email adds infrastructure complexity; in-app is sufficient for v1 |

**Key insight:** This phase is about incremental improvements to existing infrastructure, not building new systems. Every feature touches existing code and should be implemented as extensions of proven patterns.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with Relative Timestamps
**What goes wrong:** `formatRelativeTime()` returns different values on server vs client because `Date.now()` differs.
**Why it happens:** Server renders at build/request time, client hydrates later. The time difference changes the output string.
**How to avoid:** Use a `"use client"` component with `useEffect` that sets the text only after mount. SSR renders empty string or skeleton, client fills in the actual relative time.
**Warning signs:** Next.js console warnings about text content mismatch.

### Pitfall 2: AI Review Rate Limits
**What goes wrong:** Auto-triggering AI review on every upload could hit Anthropic API rate limits during bulk uploads.
**Why it happens:** Each review makes one Claude API call. Multiple simultaneous uploads create concurrent calls.
**How to avoid:** Fire-and-forget pattern with `.catch(() => {})`. If it fails, the skill is created without a review. Consider adding a simple in-memory throttle if needed.
**Warning signs:** 429 responses from Anthropic API.

### Pitfall 3: Voyage AI Rate Limits in Tests
**What goes wrong:** E2E tests that trigger skill creation also trigger embedding generation via Voyage/Ollama.
**Why it happens:** The `generateSkillEmbedding` fire-and-forget call runs during tests.
**How to avoid:** Already documented in MEMORY.md: use `test.skip()` gracefully for embedding-dependent tests.
**Warning signs:** Flaky test failures with network timeout errors.

### Pitfall 4: Stale Similarity Results After AI Review Enhancement (SKILL-07)
**What goes wrong:** Similarity detection doesn't use AI review data because it was computed before the review existed.
**Why it happens:** Embeddings are generated on upload, but AI review runs after. If SKILL-07 wants to incorporate review data, the embedding needs regeneration.
**How to avoid:** After AI review completes, regenerate the embedding using the combined text: `${name} ${description} ${reviewSummary}`. This makes the embedding richer for future similarity matches.
**Warning signs:** Similar skills not being found despite having relevant AI review content.

### Pitfall 5: Missing Tenant ID in New Messages Table
**What goes wrong:** Skill messages created without tenant_id fail RLS checks.
**Why it happens:** Following existing pattern but forgetting to pass tenant ID through the action chain.
**How to avoid:** Copy the established pattern: use `DEFAULT_TENANT_ID` constant (matching the 18+ files that already use it).
**Warning signs:** Empty query results, "permission denied" style errors from RLS.

### Pitfall 6: Upload Form Layout Break with Side Panel
**What goes wrong:** Adding a right-side similarity pane breaks the centered `max-w-2xl` layout of the upload form.
**Why it happens:** The parent `NewSkillPage` constrains width to `max-w-2xl`.
**How to avoid:** Move the width constraint into the form itself and wrap in a flex container: `<div class="flex gap-6 max-w-5xl mx-auto"><div class="flex-1 max-w-2xl">...form...</div><div class="w-80">...pane...</div></div>`.
**Warning signs:** Form fields becoming too narrow, pane overlapping form.

## Code Examples

### Relative Time Utility with Tests
```typescript
// apps/web/lib/relative-time.ts
// Verified pattern: no external dependencies needed

export function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const years = Math.floor(days / 365);

  if (years >= 1) {
    const remainingDays = days - years * 365;
    return remainingDays > 0 ? `${years}y ${remainingDays}d ago` : `${years}y ago`;
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  const remHours = hours % 24;
  if (remHours > 0) parts.push(`${remHours}h`);
  const remMinutes = minutes % 60;
  // Only show minutes if less than 7 days to keep display compact
  if (remMinutes > 0 && days < 7) parts.push(`${remMinutes}min`);

  return parts.length > 0 ? parts.join(" ") + " ago" : "just now";
}
```

### Enhanced AI Review with Structured Outputs (SKILL-06)
```typescript
// apps/web/lib/ai-review.ts -- using zodOutputFormat
// Source: Anthropic structured outputs docs (GA as of 2026)
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const EnhancedReviewSchema = z.object({
  quality: z.object({ score: z.number(), suggestions: z.array(z.string()) }),
  clarity: z.object({ score: z.number(), suggestions: z.array(z.string()) }),
  completeness: z.object({ score: z.number(), suggestions: z.array(z.string()) }),
  summary: z.string(),
  suggestedDescription: z.string(),
});

export async function generateSkillReview(
  skillName: string,
  skillDescription: string,
  skillContent: string,
  skillCategory: string
): Promise<z.infer<typeof EnhancedReviewSchema>> {
  const client = getClient();
  const response = await client.messages.create({
    model: REVIEW_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(skillName, skillDescription, skillContent, skillCategory) }],
    output_config: { format: zodOutputFormat(EnhancedReviewSchema) },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text content");
  return EnhancedReviewSchema.parse(JSON.parse(textBlock.text));
}
```

### Auto-Review Fire-and-Forget (SKILL-05)
```typescript
// In apps/web/app/actions/skills.ts -- after skill creation + embedding
async function autoGenerateReview(
  skillId: string, name: string, description: string,
  content: string, category: string, userId: string
): Promise<void> {
  try {
    const reviewOutput = await generateSkillReview(name, description, content, category);
    const { summary, suggestedDescription, ...categories } = reviewOutput;
    const contentHash = await hashContent(content);
    await upsertSkillReview({
      skillId,
      requestedBy: userId,
      categories,
      summary,
      reviewedContentHash: contentHash,
      modelName: REVIEW_MODEL,
    });
  } catch {
    // Intentionally swallowed -- review is optional
  }
}
```

### Skill Message Server Action (SKILL-04)
```typescript
// apps/web/app/actions/skill-messages.ts
"use server";
import { auth } from "@/auth";
import { db } from "@everyskill/db";
import { skillMessages } from "@everyskill/db/schema/skill-messages";

const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

export async function sendGroupingProposal(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const toUserId = formData.get("toUserId") as string;
  const subjectSkillId = formData.get("subjectSkillId") as string;
  const proposedParentSkillId = formData.get("proposedParentSkillId") as string;
  const message = formData.get("message") as string;

  if (!toUserId || !subjectSkillId || !message) return { error: "Missing fields" };
  if (!db) return { error: "Database not configured" };

  await db.insert(skillMessages).values({
    tenantId: DEFAULT_TENANT_ID,
    fromUserId: session.user.id,
    toUserId,
    subjectSkillId,
    proposedParentSkillId: proposedParentSkillId || undefined,
    message,
  });

  return { success: true };
}
```

## Timestamp Locations Audit (SKILL-01)

All locations that currently display dates and need conversion to relative timestamps:

| File | Current Format | Line(s) | Notes |
|------|---------------|---------|-------|
| `components/skill-detail.tsx` | `toLocaleDateString("en-US", ...)` | 46 | **Hydration risk** -- uses locale-sensitive API |
| `components/skills-table-row.tsx` | Manual UTC `MONTHS[d.getUTCMonth()]...` | 96-111 | Safe pattern, needs replacement |
| `components/my-skills-list.tsx` | Manual UTC `formatDate()` | 8-11, 66 | Safe pattern, needs replacement |
| `components/ai-review-display.tsx` | Manual UTC `MONTHS[...]` | 48-57 | Safe pattern, needs replacement |
| `components/reviews-list.tsx` | `toLocaleDateString()` | 56 | **Hydration risk** |
| `components/admin-key-manager.tsx` | `toLocaleDateString()` | 65, 339 | **Hydration risk** |
| `components/api-key-manager.tsx` | `toLocaleDateString()` | 66, 332, 338 | **Hydration risk** |
| `components/employee-detail-modal.tsx` | `toLocaleDateString()` | 100, 155 | **Hydration risk** |
| `components/employees-tab.tsx` | `toLocaleDateString()` | 193 | **Hydration risk** |
| `app/(protected)/users/[id]/page.tsx` | `toLocaleDateString("en-US", ...)` | 89 | **Hydration risk** -- server component (no mismatch, but still needs conversion) |
| `components/skill-analytics-modal.tsx` | `toLocaleDateString(...)` | 136, 141 | Chart axis labels -- may keep absolute for charts |
| `components/usage-area-chart.tsx` | `toLocaleDateString(...)` | 41, 46 | Chart axis labels -- may keep absolute for charts |
| `components/admin-settings-form.tsx` | Manual UTC | 20 | Safe pattern, needs replacement |

**Note:** Chart axis labels (skill-analytics-modal, usage-area-chart) may be better kept as absolute dates for readability. The requirement says "all timestamps across the platform" but chart axes showing "3d ago" on an x-axis would be confusing. Recommend keeping chart axes as-is and converting all human-readable timestamps in cards/lists/details.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON-mode prompting (manual parse) | `output_config` + `zodOutputFormat` structured outputs | GA 2025-11, beta header no longer needed | Guaranteed schema compliance, no parse failures |
| On-demand AI review (button click) | Auto-generated on upload (fire-and-forget) | This phase | Users get immediate feedback without extra step |
| `toLocaleDateString()` for dates | `<RelativeTime>` client component | This phase | Fixes hydration mismatches, improves UX |
| Separate similarity check + create | Combined `checkAndCreateSkill` | Phase 16 | Already done -- extend, don't refactor |

**Deprecated/outdated:**
- The `output_format` parameter in Anthropic SDK is deprecated in favor of `output_config.format`. The current SDK (0.72.1) supports both, but new code should use `output_config`.
- The beta header `anthropic-beta: structured-outputs-2025-11-13` is no longer needed. Structured outputs are GA.

## DB Schema Changes

### New Table: `skill_messages`
Required for SKILL-04 ("message author to propose grouping").

No existing messaging/notification infrastructure exists in the codebase. This is the first messaging feature.

**Migration approach:** Follow existing pattern (see `0006_create_audit_logs.sql`). Create a new SQL migration `0009_create_skill_messages.sql` with the table, indexes, and RLS policy.

### Modified Table: `skill_reviews`
The `categories` JSONB column needs to also store `suggestedDescription`. Since it's JSONB and the field is optional, this is backward-compatible with no migration needed. Just update the TypeScript types.

## Open Questions

1. **Chart axis timestamps -- relative or absolute?**
   - What we know: SKILL-01 says "all timestamps across the platform"
   - What's unclear: Chart axes with "3d ago" labels would be hard to read
   - Recommendation: Keep chart axes absolute, convert all other timestamps. If the user insists on charts too, we can do it in a follow-up.

2. **Where does `suggestedDescription` get stored?**
   - What we know: The `skill_reviews` table has a `summary` text field and `categories` JSONB field
   - What's unclear: Whether to add a new column or put it in JSONB
   - Recommendation: Add `suggestedDescription` as a new text column on `skill_reviews`. It's a first-class feature, not a nested category. This requires a small migration.

3. **Message author -- is it a notification system or just a messages page?**
   - What we know: SKILL-04 says "message author to propose grouping"
   - What's unclear: Whether there should be a notification badge, email, or just a page
   - Recommendation: Start with a simple messages page at `/messages` with unread count in the nav. No email integration for v1.

4. **Should AI review feed into similarity via enriched embeddings or separate scoring?**
   - What we know: SKILL-07 says "AI review used in duplicate/similarity checks"
   - What's unclear: Whether to re-embed with review text or use review scores as a secondary signal
   - Recommendation: Re-embed with enriched text (`${name} ${description} ${reviewSummary}`) after review completes. This naturally makes the embedding capture the AI's understanding of the skill.

## Sources

### Primary (HIGH confidence)
- Codebase analysis of `apps/web/lib/ai-review.ts` -- current AI review implementation
- Codebase analysis of `apps/web/lib/similar-skills.ts` -- current similarity detection
- Codebase analysis of `apps/web/components/skill-upload-form.tsx` -- current upload flow
- Codebase analysis of `packages/db/src/schema/` -- all table schemas
- Codebase analysis of `apps/web/components/` -- all timestamp usage locations
- Anthropic structured outputs docs (https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- `output_config` + `zodOutputFormat` API
- Node.js 22 runtime verification -- `Intl.DurationFormat` throws "not a constructor"
- Installed SDK verification -- `@anthropic-ai/sdk` v0.72.1 has `zodOutputFormat` in `helpers/zod`

### Secondary (MEDIUM confidence)
- MDN docs for `Intl.DurationFormat` -- confirms "Baseline 2025", not yet in Node.js 22
- MDN docs for `Intl.RelativeTimeFormat` -- confirmed it produces "3 hours ago" format, not the required "1d 5h 3min ago"

### Tertiary (LOW confidence)
- None. All findings verified against codebase and official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in codebase
- Architecture: HIGH -- extends existing patterns (server actions, fire-and-forget, JSONB columns)
- Pitfalls: HIGH -- hydration mismatch pattern documented in MEMORY.md, API rate limits documented
- Timestamp audit: HIGH -- grep-verified against all component files
- AI review enhancement: HIGH -- verified `zodOutputFormat` exists in installed SDK
- Messaging feature: MEDIUM -- new feature with no prior infrastructure, but follows established DB patterns

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days -- stable domain, no fast-moving dependencies)
