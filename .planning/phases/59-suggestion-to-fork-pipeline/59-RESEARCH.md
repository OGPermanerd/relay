# Phase 59: Suggestion-to-Fork Pipeline - Research

**Researched:** 2026-02-15
**Domain:** Suggestion workflow, fork system, skill versioning (internal codebase)
**Confidence:** HIGH

## Summary

This phase connects the existing suggestion system (Phase 57) to the existing fork and versioning systems. The codebase already has all the building blocks: `forkSkill()` server action creates forks with `forkedFromId` tracking, `updateSuggestionStatus()` handles status transitions, and `skill_feedback` already has a `suggestedContent` field. The work is primarily UI and glue logic -- adding an "Accept & Fork" button to the suggestion card, a new server action that chains fork creation with suggestion linking, and auto-status-update when linked forks get published.

The key schema gap is that `skill_feedback` has no column to link an accepted suggestion to the resulting fork or version. A new nullable `implementedBySkillId` column on `skill_feedback` is needed for traceability (SFORK-03). For the auto-implemented status update (SFORK-04), a trigger in the publish flow (`submitForReview` and `admin-reviews.ts`) can check if any suggestions reference the newly published skill.

**Primary recommendation:** Add one DB column (`implementedBySkillId` on `skill_feedback`), create an `acceptAndForkSuggestion` server action that wraps the existing `forkSkill` logic with suggestion context pre-population, and add "Apply Inline" for small changes that updates skill content directly via `acceptImprovedSkill` pattern.

## Standard Stack

### Core (all existing -- no new dependencies)
| Library | Version | Purpose | Already in Codebase |
|---------|---------|---------|---------------------|
| drizzle-orm | 0.42.0 | Schema, queries, migrations | Yes |
| next.js | 16.1.6 | Server actions, routing | Yes |
| zod | latest | Form validation | Yes |
| react 19 | latest | useActionState for forms | Yes |

### Supporting (all existing)
| Library | Purpose | Where Used |
|---------|---------|------------|
| @everyskill/storage | R2 upload for new versions | `apps/web/app/actions/skills.ts` |
| @everyskill/db | DB client, schemas, services | Throughout |

### No New Dependencies Required
This phase is pure internal wiring. No new npm packages needed.

## Architecture Patterns

### Existing Fork System (HIGH confidence -- read from source)

**`forkSkill()` in `apps/web/app/actions/fork-skill.ts`:**
- Takes `skillId` from FormData, optional `improve` flag
- Fetches parent skill (id, name, description, category, content, tags, visibility, authorId)
- Creates new skill with `forkedFromId: parent.id`, `status: "draft"`, `visibility: "personal"`
- Names fork as `${parent.name} (Fork)`
- Computes `forkedAtContentHash` from stripped body for drift detection
- Creates `skill_versions` record (version 1, empty contentUrl)
- Generates embedding fire-and-forget
- Redirects to `/skills/${newSlug}` (or `?improve=1` for AI improvement)

**Key insight:** Fork creates a DRAFT skill. The author must then submit for review to publish. This is where SFORK-04 hook goes.

### Existing Suggestion System (HIGH confidence -- read from source)

**Schema: `skill_feedback` table:**
- `id`, `tenantId`, `skillId`, `userId`, `feedbackType` ("suggestion")
- `status`: "pending" -> "accepted" -> "implemented" (or "dismissed")
- `comment`, `suggestedContent`, `suggestedDiff` (JSON: {category, severity})
- `reviewedBy`, `reviewedAt`, `reviewNotes`
- NO column linking to resulting fork/version (this is the gap)

**Status transitions (enforced in DB service):**
```
pending -> accepted, dismissed
accepted -> implemented, dismissed
dismissed -> pending (reopen)
```

**Suggestion card (`suggestion-card.tsx`):**
- Shows: user, time, status badge, severity badge, category, comment, suggestedContent
- Author actions by status:
  - pending: Accept, Dismiss, Reply
  - accepted: Mark Implemented, Dismiss, Reply
  - dismissed: Reopen
  - implemented: Reply only
- Currently "Accept" just sets status to "accepted" -- no fork/version creation

### Existing Inline Content Update Pattern (HIGH confidence)

**`acceptImprovedSkill()` in `apps/web/app/actions/ai-review.ts`:**
- Updates `skills.content` directly (no new version record)
- Also updates `name` and `description` if suggested
- Revalidates the skill page
- This is the pattern for SFORK-02 (small inline changes)

### Existing "Create as Variation" Flow

**In `checkAndCreateSkill()`:** FormData field `_variationOf` sets `forkedFromId` on new skill. This is used from the similarity check flow. Same concept applies here.

### Recommended Project Structure (changes only)

```
apps/web/
  app/actions/
    skill-feedback.ts     # ADD: acceptAndForkSuggestion(), applyInlineSuggestion()
    fork-skill.ts         # NO CHANGES (reuse forkSkill logic internally)
    submit-for-review.ts  # ADD: check for linked suggestions after publish
    admin-reviews.ts      # ADD: same check after admin publish
  components/
    suggestion-card.tsx    # ADD: "Accept & Fork" button, "Apply Inline" button
packages/db/
  src/
    schema/skill-feedback.ts    # ADD: implementedBySkillId column
    services/skill-feedback.ts  # ADD: linkSuggestionToSkill(), getLinkedSuggestions()
    migrations/0034_*.sql       # ADD: migration for new column
```

## Architecture: Detailed Design

### SFORK-01: Accept & Fork

**Flow:**
1. Author clicks "Accept & Fork" on suggestion card
2. New server action `acceptAndForkSuggestion(feedbackId)`:
   a. Validate auth + author check
   b. Fetch suggestion (including `suggestedContent`, `comment`)
   c. Fetch the parent skill
   d. Create fork (same logic as `forkSkill()` but with pre-populated content)
   e. If `suggestedContent` exists, use it as fork content (replacing parent content)
   f. Set suggestion status to "accepted"
   g. Set `implementedBySkillId` on the feedback row to the new fork's ID
   h. Redirect to fork page with `?improve=1` to enter AI improvement mode
3. The fork is created as draft -- author customizes and publishes

**Key difference from plain fork:** The forked skill's content incorporates the suggestion's `suggestedContent` if available, and the suggestion gets linked for traceability.

### SFORK-02: Apply Inline (Small Changes)

**Flow:**
1. Author clicks "Apply Inline" on suggestion card (only shown when `suggestedContent` exists)
2. New server action `applyInlineSuggestion(feedbackId)`:
   a. Validate auth + author check
   b. Fetch suggestion with `suggestedContent`
   c. Update the skill's `content` field with the suggested content (like `acceptImprovedSkill`)
   d. Create a new `skill_versions` record (increment version number)
   e. Set suggestion status to "implemented"
   f. Set `implementedBySkillId` to the skill's own ID
   g. Revalidate the skill page
3. No redirect needed -- page refreshes with updated content

**When to show "Apply Inline":** Only when `suggestedContent` is present and non-empty. If suggestion is just a comment with no concrete content, only "Accept & Fork" is available.

### SFORK-03: Traceability Link

**Schema change:**
```sql
ALTER TABLE skill_feedback ADD COLUMN implemented_by_skill_id TEXT REFERENCES skills(id);
```

**Usage:**
- Set when suggestion is accepted & forked (points to new fork skill ID)
- Set when suggestion is applied inline (points to the original skill ID)
- Queried to show "Implemented in: [Fork Name]" link on suggestion card
- Also enables reverse lookup: on a fork page, show "Based on suggestion from [User]"

### SFORK-04: Auto-Implemented Status

**Trigger points (two places):**
1. `submitForReview()` in `submit-for-review.ts` -- when auto-approved, skill goes to "published"
2. `approveSkill()` in `admin-reviews.ts` -- when admin approves

**Logic (add after status transitions to "published"):**
```typescript
// After skill is published, check if any suggestions point to it
const linkedSuggestions = await db
  .select({ id: skillFeedback.id })
  .from(skillFeedback)
  .where(
    and(
      eq(skillFeedback.implementedBySkillId, skillId),
      eq(skillFeedback.status, "accepted")
    )
  );

// Auto-transition accepted -> implemented
for (const s of linkedSuggestions) {
  await db.update(skillFeedback)
    .set({ status: "implemented", reviewedAt: new Date() })
    .where(eq(skillFeedback.id, s.id));
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fork creation logic | Duplicate fork code in new action | Extract shared `createForkFromSkill()` helper from `forkSkill()` | Avoid drift between two fork paths |
| Status transitions | Manual status checks | Use existing `VALID_SUGGESTION_TRANSITIONS` map | Already enforced, tested |
| Content updates | Raw SQL updates | Follow `acceptImprovedSkill()` pattern | Handles revalidation, auth checks |
| Version numbering | Manual counting | Query `MAX(version) + 1` from skill_versions | Prevents duplicates under concurrency |

## Common Pitfalls

### Pitfall 1: Fork Content Merging
**What goes wrong:** Blindly replacing fork content with `suggestedContent` loses the EverySkill frontmatter that gets prepended during skill creation.
**Why it happens:** `suggestedContent` is raw text from the user; the fork needs frontmatter to function.
**How to avoid:** Apply `suggestedContent` as the RAW body, then let the fork creation flow add frontmatter on top (same as `checkAndCreateSkill` does with `stripEverySkillFrontmatter` + `buildEverySkillFrontmatter`).
**Warning signs:** Forked skills missing tracking hooks in their YAML header.

### Pitfall 2: Redirect After Fork in useActionState
**What goes wrong:** `redirect()` in server actions throws a special Next.js error. If called inside try/catch, it gets swallowed.
**Why it happens:** Next.js redirect mechanism uses thrown errors internally.
**How to avoid:** Never wrap `redirect()` in try/catch. The existing `forkSkill()` action handles this correctly -- follow the same pattern.
**Warning signs:** Fork action completes but page doesn't navigate.

### Pitfall 3: Race Condition on Auto-Implemented Status
**What goes wrong:** If the publish flow checks for linked suggestions before the `implementedBySkillId` is set, the auto-transition never fires.
**Why it happens:** Accept & Fork and Publish are separate user actions; the link must be set during fork creation.
**How to avoid:** Set `implementedBySkillId` in the same transaction as fork creation, not after redirect.
**Warning signs:** Suggestions stuck in "accepted" after the linked fork is published.

### Pitfall 4: Inline Apply Without Version Record
**What goes wrong:** Applying inline changes without creating a `skill_versions` record breaks the version history.
**Why it happens:** The `acceptImprovedSkill()` pattern only updates `skills.content` -- it does NOT create version records.
**How to avoid:** For "Apply Inline", create a new version record after updating content. Query `MAX(version)` from `skill_versions` for the skill and increment.
**Warning signs:** Version history shows gaps or the skill page shows stale version info.

### Pitfall 5: Hydration Mismatch on Dates
**What goes wrong:** Using `toLocaleDateString()` in the suggestion card causes server/client hydration mismatch.
**Why it happens:** Node.js and browser have different Intl implementations.
**How to avoid:** Already handled -- `suggestion-card.tsx` uses UTC-safe manual formatting. Keep using the same pattern for any new date displays.

## Code Examples

### Example 1: Accept & Fork Server Action Pattern
```typescript
// Source: Based on existing forkSkill() in apps/web/app/actions/fork-skill.ts
// and updateSuggestionStatus() in apps/web/app/actions/skill-feedback.ts

export async function acceptAndForkSuggestion(
  prevState: AcceptForkState,
  formData: FormData
): Promise<AcceptForkState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const feedbackId = formData.get("feedbackId") as string;

  // 1. Fetch suggestion
  const suggestion = await db.query.skillFeedback.findFirst({
    where: eq(skillFeedback.id, feedbackId),
    columns: { skillId: true, suggestedContent: true, comment: true, status: true },
  });

  // 2. Verify author owns the skill
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, suggestion.skillId),
  });
  if (skill.authorId !== session.user.id) return { error: "Not authorized" };

  // 3. Create fork with suggestion context
  const forkContent = suggestion.suggestedContent || skill.content;
  const forkName = `${skill.name} (Fork)`;
  const slug = await generateUniqueSlug(forkName, db);

  const [newSkill] = await db.insert(skills).values({
    tenantId: session.user.tenantId,
    name: forkName,
    slug,
    description: `${skill.description}\n\nBased on suggestion: ${suggestion.comment}`,
    category: skill.category,
    content: forkContent,
    forkedFromId: skill.id,
    authorId: session.user.id,
    status: "draft",
    visibility: "personal",
  }).returning({ id: skills.id, slug: skills.slug });

  // 4. Link suggestion to fork and update status
  await db.update(skillFeedback).set({
    status: "accepted",
    implementedBySkillId: newSkill.id,
    reviewedBy: session.user.id,
    reviewedAt: new Date(),
  }).where(eq(skillFeedback.id, feedbackId));

  // 5. Redirect (throws -- must be outside try/catch)
  redirect(`/skills/${newSkill.slug}?improve=1`);
}
```

### Example 2: Suggestion Card Button Addition
```typescript
// Source: Based on existing suggestion-card.tsx button patterns

{/* In the "pending" status actions section */}
{status === "pending" && (
  <>
    <button onClick={() => handleAcceptAndFork()}>
      Accept & Fork
    </button>
    {suggestion.suggestedContent && (
      <button onClick={() => handleApplyInline()}>
        Apply Inline
      </button>
    )}
    <button onClick={() => handleStatusUpdate("dismissed")}>
      Dismiss
    </button>
  </>
)}

{/* In the "accepted" status actions section */}
{status === "accepted" && suggestion.implementedBySkillId && (
  <Link href={`/skills/${suggestion.implementedBySlug}`}>
    View Fork
  </Link>
)}
```

### Example 3: Migration for implementedBySkillId
```sql
-- Source: Following pattern from existing migrations
ALTER TABLE skill_feedback ADD COLUMN implemented_by_skill_id TEXT REFERENCES skills(id);
CREATE INDEX skill_feedback_implemented_by_idx ON skill_feedback(implemented_by_skill_id);
```

### Example 4: Auto-Implemented Status Check
```typescript
// Source: Pattern to add in submit-for-review.ts after publish
// After: await db.update(skills).set({ status: "published" })

import { autoImplementLinkedSuggestions } from "@everyskill/db/services/skill-feedback";

// Fire-and-forget: mark linked suggestions as implemented
autoImplementLinkedSuggestions(skillId).catch(() => {});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual "Mark Implemented" button | Will have auto-implemented on publish | Phase 59 | Reduces manual bookkeeping |
| Accept suggestion, separately fork | Accept & Fork in one action | Phase 59 | Streamlined author workflow |
| No traceability suggestion -> fork | `implementedBySkillId` column | Phase 59 | Full audit trail |

## Key Observations from Codebase

1. **The `suggestedContent` field is already perfect for pre-populating forks.** When a user submits a suggestion, they can optionally provide replacement content. This maps directly to fork content pre-population.

2. **The `suggestedDiff` field stores JSON `{category, severity}` as a string.** It is NOT used for actual content diffs. The name is misleading -- it is metadata about the suggestion type.

3. **Fork creation already handles content hash tracking** via `forkedAtContentHash`. The suggestion fork should do the same.

4. **The existing "Create as Variation" flow in `checkAndCreateSkill`** uses a hidden `_variationOf` FormData field to set `forkedFromId`. The Accept & Fork flow follows a similar pattern but wraps it in the suggestion acceptance.

5. **`skill_feedback.skillVersionId`** already exists as a nullable FK to `skill_versions`. This was planned for tracking which version a suggestion was made against. It is NOT currently populated. Consider setting it during "Apply Inline" to point to the new version created.

6. **Two publish paths exist:** `submitForReview()` (auto-approve path) and `approveSkill()` in `admin-reviews.ts`. Both need the auto-implemented check for SFORK-04.

## Open Questions

1. **Should "Accept & Fork" redirect to the fork page or stay on the current page?**
   - What we know: Existing `forkSkill()` redirects to the new fork page with optional `?improve=1`
   - What's unclear: Author might want to accept multiple suggestions and fork once
   - Recommendation: Redirect to fork page (consistent with existing fork UX). Multiple-suggestion acceptance can be a future enhancement.

2. **Should "Apply Inline" create a new skill_versions record?**
   - What we know: `acceptImprovedSkill()` does NOT create version records -- it just updates `skills.content`. But the phase requirements say "create new skill_version inline."
   - What's unclear: Whether the overhead of R2 upload is warranted for small suggestion applies
   - Recommendation: YES, create version record (per SFORK-02 requirement). Skip R2 upload (set `contentUrl` to empty string like fork does), just hash the content. This maintains version history without R2 cost.

3. **What happens to the "Mark Implemented" button after this phase?**
   - What we know: It currently exists on accepted suggestions as a manual status update
   - Recommendation: Keep it as a fallback -- auto-implemented handles the happy path, but manual marking handles edge cases (e.g., author made changes outside the suggestion flow).

## Sources

### Primary (HIGH confidence)
- `apps/web/app/actions/fork-skill.ts` -- complete forkSkill() implementation
- `apps/web/app/actions/skill-feedback.ts` -- updateSuggestionStatus, submitSuggestion, replySuggestion
- `apps/web/app/actions/ai-review.ts` -- acceptImprovedSkill (inline update pattern)
- `apps/web/app/actions/skills.ts` -- checkAndCreateSkill (variation-of pattern)
- `apps/web/components/suggestion-card.tsx` -- current UI, action buttons, SuggestionCardData interface
- `apps/web/components/suggestion-list.tsx` -- filtering, sorting, visibility logic
- `packages/db/src/schema/skill-feedback.ts` -- full schema with all columns
- `packages/db/src/schema/skills.ts` -- skills table with forkedFromId, publishedVersionId
- `packages/db/src/schema/skill-versions.ts` -- version record structure
- `packages/db/src/services/skill-feedback.ts` -- VALID_SUGGESTION_TRANSITIONS, CRUD functions
- `packages/db/src/relations/index.ts` -- all relationship definitions
- `apps/web/app/actions/submit-for-review.ts` -- publish flow (auto-approve path)
- `apps/web/app/actions/admin-reviews.ts` -- publish flow (admin path)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all existing codebase components, no new deps
- Architecture: HIGH -- clear patterns from existing fork and suggestion systems
- Pitfalls: HIGH -- identified from actual code patterns (frontmatter stripping, redirect throws, version records)
- Schema changes: HIGH -- single nullable column addition, straightforward migration

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (internal codebase, stable patterns)
