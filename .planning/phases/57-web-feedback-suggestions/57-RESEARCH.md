# Phase 57: Web Feedback & Suggestions - Research

**Researched:** 2026-02-15
**Domain:** Skill feedback/suggestions UI, server actions, DB services, notifications
**Confidence:** HIGH

## Summary

Phase 57 adds structured improvement suggestions to skill detail pages. The existing `skill_feedback` table (created in Phase 55) already has all needed columns: `feedbackType='suggestion'`, `comment`, `suggestedContent`, `suggestedDiff`, `status`, `reviewedBy`, `reviewedAt`, `reviewNotes`. The notification system is fully operational with `createNotification()` service, `NotificationBell` component, and server actions for reading/marking notifications. No new schema or migrations are needed.

The codebase has strong, consistent patterns for everything this phase requires: `useActionState` + Zod validation for forms (see `rating-form.tsx`, `message-author-dialog.tsx`), server actions with auth/tenant guards (see `ratings.ts`, `skill-messages.ts`), fire-and-forget notifications via `createNotification()` (see `ratings.ts` line 119), and status badge patterns with color maps (see `admin-review-queue.tsx`, `admin-review-detail.tsx`). The skill detail page uses a tab system (`SkillDetailTabs`) that currently has "Details" and "AI Review" tabs -- a new "Suggestions" tab can be added following the same pattern.

**Primary recommendation:** Follow existing codebase patterns exactly. Create a DB service in `packages/db/src/services/skill-feedback.ts`, server actions in `apps/web/app/actions/skill-feedback.ts`, and client components for the suggestion form and suggestion list. Add a "Suggestions" tab to `SkillDetailTabs`. Use `createNotification()` with new types for suggestion notifications. Add `sanitizePayload()` to user-submitted text fields.

## Standard Stack

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | DB queries, inserts, updates | Already used everywhere |
| zod | (installed) | Server action input validation | Used in all server actions |
| next (App Router) | 16.1.6 | Server components, server actions, revalidatePath | Framework |
| react | 19.x | useActionState for forms | Already used in rating-form, message-author-dialog |

### Supporting (Already Available)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `sanitizePayload()` | Strip secrets from user input | Every text field in suggestion form |
| `createNotification()` | In-app notifications | When suggestion submitted, status changed |
| `revalidatePath()` | Bust SSR cache | After mutation server actions |

### No New Dependencies Needed
This phase requires zero new npm packages.

## Architecture Patterns

### Recommended File Structure
```
packages/db/src/services/
  skill-feedback.ts           # NEW: DB service for CRUD on skill_feedback

apps/web/app/actions/
  skill-feedback.ts           # NEW: Server actions (submitSuggestion, updateSuggestionStatus, replySuggestion)

apps/web/components/
  suggestion-form.tsx          # NEW: "use client" form for submitting suggestions
  suggestion-list.tsx          # NEW: "use client" list of suggestions with status badges
  suggestion-card.tsx          # NEW: Single suggestion with author actions (Accept/Dismiss/Reply)

apps/web/app/(protected)/skills/[slug]/
  page.tsx                     # MODIFY: fetch suggestions, pass to tabs

apps/web/components/
  skill-detail-tabs.tsx        # MODIFY: add "Suggestions" tab
```

### Pattern 1: Server Action with useActionState (from rating-form.tsx)
**What:** Form submits via native `action` prop, uses `useActionState` for state management
**When to use:** All form submissions in this phase
**Example:**
```typescript
// Server action (apps/web/app/actions/skill-feedback.ts)
"use server";
import { auth } from "@/auth";
import { db } from "@everyskill/db";
import { skillFeedback } from "@everyskill/db/schema";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sanitizePayload } from "@/lib/sanitize-payload";
import { createNotification } from "@everyskill/db/services/notifications";

const suggestionSchema = z.object({
  skillId: z.string().min(1),
  skillSlug: z.string().min(1),
  category: z.enum(["output_quality", "missing_feature", "error", "performance", "other"]),
  severity: z.enum(["nice_to_have", "important", "critical"]),
  comment: z.string().min(10, "Please provide at least 10 characters").max(2000),
  suggestedContent: z.string().max(5000).optional().transform(v => v || null),
});

export type SuggestionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

export async function submitSuggestion(
  prevState: SuggestionState,
  formData: FormData
): Promise<SuggestionState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "You must be signed in" };
  const tenantId = session.user.tenantId;
  if (!tenantId) return { message: "Tenant not resolved" };

  const parsed = suggestionSchema.safeParse({
    skillId: formData.get("skillId"),
    skillSlug: formData.get("skillSlug"),
    category: formData.get("category"),
    severity: formData.get("severity"),
    comment: formData.get("comment"),
    suggestedContent: formData.get("suggestedContent"),
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // Sanitize user input
  const { sanitized: sanitizedComment } = sanitizePayload(parsed.data.comment);
  const sanitizedContent = parsed.data.suggestedContent
    ? sanitizePayload(parsed.data.suggestedContent).sanitized
    : null;

  // Insert feedback row
  // ... (see DB service pattern below)

  // Fire-and-forget notification to author
  // ... (see notification pattern below)

  revalidatePath(`/skills/${parsed.data.skillSlug}`);
  return { success: true, message: "Suggestion submitted" };
}
```

```typescript
// Client component (apps/web/components/suggestion-form.tsx)
"use client";
import { useActionState } from "react";
import { submitSuggestion, SuggestionState } from "@/app/actions/skill-feedback";

const initialState: SuggestionState = {};

export function SuggestionForm({ skillId, skillSlug }: { skillId: string; skillSlug: string }) {
  const [state, formAction, isPending] = useActionState(submitSuggestion, initialState);
  // ... form with hidden fields, select dropdowns, textarea, submit button
}
```

### Pattern 2: DB Service (from review-decisions.ts, notifications.ts)
**What:** Thin service layer in `packages/db/src/services/` for DB operations
**When to use:** All database operations for skill_feedback
**Example:**
```typescript
// packages/db/src/services/skill-feedback.ts
import { eq, and, desc } from "drizzle-orm";
import { db } from "../client";
import { skillFeedback } from "../schema/skill-feedback";
import { users } from "../schema/users";

export interface CreateSuggestionParams {
  tenantId: string;
  skillId: string;
  userId: string;
  category: string;
  severity: string;
  comment: string;
  suggestedContent?: string | null;
  source?: string;
}

export async function createSuggestion(params: CreateSuggestionParams): Promise<string | null> {
  if (!db) return null;
  const [row] = await db.insert(skillFeedback).values({
    tenantId: params.tenantId,
    skillId: params.skillId,
    userId: params.userId,
    feedbackType: "suggestion",
    comment: params.comment,
    suggestedContent: params.suggestedContent ?? null,
    // Store category+severity in comment prefix or use qualityScore/sentiment creatively
    // Actually: use `suggested_diff` field for category, `quality_score` for severity mapping
    status: "pending",
    source: params.source ?? "web",
  }).returning({ id: skillFeedback.id });
  return row?.id ?? null;
}
```

### Pattern 3: Notification (from ratings.ts)
**What:** Fire-and-forget notification via `createNotification()`
**When to use:** When suggestion submitted (notify author) and when status changes (notify suggester)
**Example:**
```typescript
// Notify author when suggestion submitted
createNotification({
  tenantId,
  userId: skill.authorId,
  type: "suggestion_received",  // NEW type to add
  title: `New suggestion on ${skill.name}`,
  message: `${userName} submitted a ${severity} suggestion: "${comment.slice(0, 100)}..."`,
  actionUrl: `/skills/${skillSlug}`,
}).catch(() => {});

// Notify suggester when status changes
createNotification({
  tenantId,
  userId: suggestion.userId,
  type: "suggestion_status_changed",  // NEW type to add
  title: `Your suggestion was ${newStatus}`,
  message: `The author ${action} your suggestion on ${skillName}`,
  actionUrl: `/skills/${skillSlug}`,
}).catch(() => {});
```

### Pattern 4: Tab Extension (from skill-detail-tabs.tsx)
**What:** Add a third tab "Suggestions" to the existing tab component
**When to use:** Displaying suggestions alongside Details and AI Review
**Example:**
```typescript
// Modify SkillDetailTabs to accept suggestionsContent prop
type TabKey = "details" | "ai-review" | "suggestions";

interface SkillDetailTabsProps {
  children: ReactNode;
  aiReviewContent: ReactNode;
  suggestionsContent: ReactNode;  // NEW
  suggestionCount?: number;       // NEW: for badge
}
```

### Pattern 5: Status Badge Colors (from admin-review-queue.tsx)
**What:** Colored badges for suggestion status
**When to use:** Suggestion list items
**Example:**
```typescript
const SUGGESTION_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  dismissed: "bg-gray-100 text-gray-600",
  implemented: "bg-blue-100 text-blue-700",
};

const SUGGESTION_STATUS_LABELS: Record<string, string> = {
  pending: "Open",
  accepted: "Accepted",
  dismissed: "Dismissed",
  implemented: "Implemented",
};

const SEVERITY_COLORS: Record<string, string> = {
  nice_to_have: "bg-gray-100 text-gray-600",
  important: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  output_quality: "Output Quality",
  missing_feature: "Missing Feature",
  error: "Error",
  performance: "Performance",
  other: "Other",
};
```

### Anti-Patterns to Avoid
- **Do NOT use `toLocaleDateString()`:** Causes hydration mismatches. Use manual UTC formatting like `MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear()` (see admin-review-queue.tsx line 90-93).
- **Do NOT re-export types from "use server" files:** Causes runtime bundler errors. Export types directly from the action file and import them in client components.
- **Do NOT use `startTransition` dispatch for redirects:** Use native form `action` prop with `useActionState` instead.
- **Do NOT forget to serialize Dates:** Pass `.toISOString()` before sending from server to client components. Accept `string` in client interfaces.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input sanitization | Custom regex stripping | `sanitizePayload()` from `@/lib/sanitize-payload` | Handles 12+ secret patterns, battle-tested |
| Notifications | Custom notification table/bell | `createNotification()` + existing `NotificationBell` | Full system already exists |
| Form validation | Manual checks in server action | Zod schemas with `.safeParse()` | Consistent error shape, type inference |
| Status transitions | Ad-hoc if/else | Map of valid transitions (like `skill-status.ts`) | Prevents invalid state transitions |
| UUID generation | `uuid` library | `crypto.randomUUID()` | Already used in all schema `$defaultFn()` |

**Key insight:** The codebase already has 90%+ of the infrastructure. This phase is primarily wiring existing patterns to a new use case.

## Common Pitfalls

### Pitfall 1: Schema Field Mapping for Category/Severity
**What goes wrong:** The `skill_feedback` table was designed for multiple feedback types. It has no dedicated `category` or `severity` columns for suggestions.
**Why it happens:** The schema is generic across thumbs_up, thumbs_down, suggestion, training_example, bug_report.
**How to avoid:** Store category and severity in the `suggestedDiff` field as JSON: `JSON.stringify({ category, severity })`. Alternatively, use the `comment` field for user text and `suggestedDiff` for structured metadata. The `qualityScore` field (integer 1-10) could encode severity (1=nice_to_have, 5=important, 10=critical) but JSON in `suggestedDiff` is more readable.
**Warning signs:** If you find yourself adding migration columns, stop -- use existing fields creatively first.

### Pitfall 2: Status Lifecycle Mapping
**What goes wrong:** Requirements say `open -> accepted -> dismissed -> implemented` but schema has `status` defaulting to `pending`.
**Why it happens:** The schema uses `pending` as default status, which maps to "open" in the UI.
**How to avoid:** Map DB values to UI labels: `pending` = "Open" in UI, `accepted` = "Accepted", `dismissed` = "Dismissed", `implemented` = "Implemented". Only store these 4 values. Define valid transitions:
- `pending` -> `accepted` | `dismissed`
- `accepted` -> `implemented` | `dismissed`
- `dismissed` -> `pending` (reopen)
**Warning signs:** Allowing transitions that skip states.

### Pitfall 3: Notification Type Registration
**What goes wrong:** `createNotification` has a typed `type` parameter with a union of allowed strings.
**Why it happens:** The `CreateNotificationParams` interface restricts `type` to specific values.
**How to avoid:** Add `"suggestion_received"` and `"suggestion_status_changed"` to the `CreateNotificationParams.type` union in `packages/db/src/services/notifications.ts`. The notifications table column is just `TEXT`, so no migration needed.
**Warning signs:** TypeScript errors on `createNotification()` calls.

### Pitfall 4: Author vs. Non-Author View
**What goes wrong:** Both author and non-author see the same suggestion UI.
**Why it happens:** Not enough conditional rendering based on `isAuthor`.
**How to avoid:** Author sees: Accept/Dismiss/Reply buttons on each suggestion, full list of all suggestions. Non-author sees: their own suggestions with current status, a form to submit new suggestions, no action buttons on others' suggestions.
**Warning signs:** Non-authors seeing review actions, or authors not seeing pending suggestions.

### Pitfall 5: Reply Field Missing
**What goes wrong:** SUGGEST-03 requires Reply action but the schema has only `reviewNotes` (set on status change).
**Why it happens:** `reviewNotes` was designed for review decisions, not threaded replies.
**How to avoid:** Use `reviewNotes` for the author's reply text. A reply is a status-preserving action where the author sets `reviewNotes` without changing status (or set `reviewedBy` and `reviewedAt`). If threaded replies are needed later, that's a new table -- but for now, single reply via `reviewNotes` satisfies SUGGEST-03.
**Warning signs:** Trying to build a threading system when a single reply field suffices.

### Pitfall 6: Tenant ID in Queries
**What goes wrong:** Forgetting `tenantId` when inserting or querying skill_feedback.
**Why it happens:** RLS is ENABLED but not FORCED -- table owner bypasses RLS.
**How to avoid:** Always include `tenantId` from `session.user.tenantId` in inserts. For reads, the RLS policy should handle filtering, but explicit `where` clauses are safer and more portable.

## Code Examples

### Existing Pattern: Rating Form Server Action (verified)
Source: `apps/web/app/actions/ratings.ts`
- Lines 40-153: Complete server action with Zod validation, auth check, tenant check, DB operation, notification, revalidation
- This is the EXACT pattern to follow for `submitSuggestion`

### Existing Pattern: Notification Creation (verified)
Source: `apps/web/app/actions/ratings.ts` lines 106-129
```typescript
// Fire-and-forget notification to skill author
if (skill?.authorId && skill.authorId !== session.user.id) {
  createNotification({
    tenantId,
    userId: skill.authorId,
    type: "skill_rated",
    title: `New rating on ${skill.name}`,
    message: `${raterName} gave ${skill.name} ${stars}${commentExcerpt}`,
    actionUrl: `/skills/${skillSlug}`,
  }).catch(() => {});
}
```

### Existing Pattern: useActionState Form (verified)
Source: `apps/web/components/rating-form.tsx` lines 24-26
```typescript
const [state, formAction, isPending] = useActionState(submitRating, initialState);
// ... form uses action={formAction}
```

### Existing Pattern: Admin Review Actions (verified)
Source: `apps/web/components/admin-review-detail.tsx` lines 172-230
- Approve/Reject/Request Changes with notes textarea per action
- Same pattern for Accept/Dismiss/Reply on suggestions
- Uses `useState` for pending state per action type

### Existing Pattern: Tab System (verified)
Source: `apps/web/components/skill-detail-tabs.tsx`
- Simple client component with `useState<TabKey>`
- Tab bar with aria attributes
- Tab panels with `hidden` attribute

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useFormState` | `useActionState` | React 19 | Import from `react`, not `react-dom` |
| Client-side validation only | Zod on server action | Established pattern | All validation happens server-side, errors returned to client |
| Direct DB calls in actions | Service layer in packages/db | Established pattern | Separation of concerns, reusable across MCP/web |

## Open Questions

1. **Category/Severity Storage Strategy**
   - What we know: `skill_feedback` has no dedicated columns for suggestion category or severity
   - What's unclear: Best field to store this structured data
   - Recommendation: Store as JSON in `suggestedDiff` field: `{"category":"output_quality","severity":"critical"}`. This field is `TEXT` and unused for suggestion-type feedback. Parse on read. Alternative: use `qualityScore` for severity (1/5/10) and first line of `comment` for category, but JSON is cleaner.

2. **Reply Mechanism Depth**
   - What we know: `reviewNotes` field exists for author response
   - What's unclear: Whether threaded multi-reply is expected
   - Recommendation: Single reply via `reviewNotes` + `reviewedBy` + `reviewedAt`. The requirements say "Reply" as an action, not "threaded conversation". If multi-reply is needed later, add a `skill_feedback_replies` table in a future phase.

3. **Suggestion Count Badge on Tab**
   - What we know: Tab system exists but has no count badges
   - What's unclear: Whether to show pending count on tab label
   - Recommendation: Show count badge like "Suggestions (3)" for pending suggestions visible to the author. Non-authors see their own suggestion count.

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/skill-feedback.ts` -- full schema reviewed, all columns mapped
- `packages/db/src/schema/notifications.ts` -- notification table schema
- `packages/db/src/services/notifications.ts` -- createNotification API, type union
- `apps/web/app/actions/ratings.ts` -- complete server action pattern with Zod, auth, notifications
- `apps/web/components/rating-form.tsx` -- useActionState form pattern
- `apps/web/components/skill-detail-tabs.tsx` -- tab system structure
- `apps/web/app/(protected)/skills/[slug]/page.tsx` -- skill detail page data fetching
- `apps/web/components/admin-review-detail.tsx` -- Accept/Reject/Reply action UI pattern
- `apps/web/lib/sanitize-payload.ts` -- input sanitization utility
- `packages/db/src/services/index.ts` -- service export pattern
- `packages/db/src/relations/index.ts` -- skillFeedback relations confirmed

### Secondary (MEDIUM confidence)
- `apps/web/components/admin-review-queue.tsx` -- status badge color patterns
- `apps/web/app/actions/skill-messages.ts` -- fire-and-forget notification with error swallowing
- `packages/db/src/services/review-decisions.ts` -- insert-only service pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- every pattern has a verified existing example in the codebase
- Pitfalls: HIGH -- identified from direct code reading, not speculation
- Schema mapping: MEDIUM -- category/severity storage requires a design choice (JSON in suggestedDiff)

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable codebase, no external dependency changes expected)
