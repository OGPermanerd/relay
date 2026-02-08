# Phase 36: Admin Review UI - Research

**Researched:** 2026-02-08
**Domain:** Admin review queue UI, status transitions, immutable audit trail, text diffing
**Confidence:** HIGH

## Summary

Phase 36 builds the admin-facing review interface that completes the skill review pipeline established in Phases 34 (state machine + status column) and 35 (AI review integration + auto-approve). The existing infrastructure is mature: skills have a `status` column with 7 states, a pure-function state machine governs transitions, AI reviews are stored in `skill_reviews` with categories/scores, and the admin panel already has a layout with nav tabs, role-based access control via `isAdmin(session)`, and established patterns for server actions + data tables.

The core work is: (1) a new review queue page at `/admin/reviews` with pagination and filtering, (2) a review detail page showing skill content, AI scores, and optional diff view, (3) server actions for approve/reject/request-changes that transition status and store immutable decisions, (4) a `review_decisions` table for the immutable audit trail (distinct from the existing mutable `skill_reviews` table which stores AI review data), and (5) a pending review count badge in the admin nav.

The state machine already supports the required transitions: `ai_reviewed -> approved`, `ai_reviewed -> rejected`, `ai_reviewed -> changes_requested`, and `approved -> published`. The admin approve action chains `ai_reviewed -> approved -> published` in one operation. For diff view, since most skills store content inline (not via R2 versions), the practical approach is comparing the current draft content against the most recent published content snapshot -- but this requires storing the previous content at review time, or using the `reviewed_content_hash` to detect changes. The simplest approach: if a skill has a previous published version (previous content stored somewhere), show a diff. Otherwise, show just the full content.

**Primary recommendation:** Create a `review_decisions` table for immutable audit trail (separate from `skill_reviews`). Build the review queue as a server component with pagination via URL search params. Use the `diff` npm package for line-level text comparison rendered with Tailwind CSS (no heavy diff viewer component needed). Add a pending count query to the admin layout and pass it to a nav badge.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.42.0 | Schema, queries, migrations | Already in use throughout |
| next.js | ^16.1.6 | Server components, server actions, routing | App framework |
| react | ^19.0.0 | UI components, useActionState | Current framework |
| tailwindcss | ^4.0.0 | Styling | Used throughout |
| zod | ^3.25.0 | Input validation in server actions | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| diff | ^7.0.0 | Line-level text diffing for content comparison | ADMR-07 diff view - computing added/removed/unchanged lines |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `diff` npm package | `react-diff-viewer-continued` | Full React component with split/inline view, but 150KB+ bundle, heavy dependency. `diff` is 60KB, we render with Tailwind ourselves -- simpler, matches project pattern of minimal dependencies |
| `diff` npm package | `diff-match-patch` | Google library, great for character-level patches, but `diff` has better line-level API (`diffLines`) which is what we need for markdown content comparison |
| Custom diff rendering | `diff2html` | diff2html renders unified/split diff views from git-style patches. Overkill -- our diff is simple line-level comparison, not git patches |

**Installation:**
```bash
cd apps/web && pnpm add diff
```

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  schema/
    review-decisions.ts       # NEW: immutable audit trail table
  services/
    review-decisions.ts       # NEW: create + query review decisions
  migrations/
    0015_create_review_decisions.sql  # NEW: table creation

apps/web/
  app/(protected)/admin/
    reviews/
      page.tsx                # NEW: review queue (ADMR-01, ADMR-02)
      [skillId]/
        page.tsx              # NEW: review detail + actions (ADMR-03-07)
    layout.tsx                # MODIFY: add Reviews nav item + count badge
  app/actions/
    admin-reviews.ts          # NEW: approve/reject/request-changes actions
  components/
    admin-review-queue.tsx    # NEW: client component for queue table
    admin-review-detail.tsx   # NEW: client component for review actions
    review-diff-view.tsx      # NEW: diff rendering component
    admin-review-badge.tsx    # NEW: pending count badge for nav (ADMR-09)
  lib/
    review-queries.ts         # NEW: server-side queries for review queue + detail
```

### Pattern 1: Review Queue with Server-Side Pagination
**What:** Paginated review queue using URL search params (`?page=1&status=ai_reviewed&category=prompt`). Server component fetches the right page, passes to client component for interactions.
**When to use:** ADMR-01, ADMR-02.
**Example:**
```typescript
// apps/web/app/(protected)/admin/reviews/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getReviewQueue } from "@/lib/review-queries";
import { AdminReviewQueue } from "@/components/admin-review-queue";

interface ReviewsPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function AdminReviewsPage(props: ReviewsPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    redirect("/");
  }

  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const pageSize = 20;

  const { skills, total } = await getReviewQueue({
    tenantId: session.user.tenantId!,
    page,
    pageSize,
    status: searchParams.status,
    category: searchParams.category,
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Review Queue</h2>
      <AdminReviewQueue
        skills={skills}
        total={total}
        page={page}
        pageSize={pageSize}
      />
    </div>
  );
}
```

### Pattern 2: Immutable Review Decision Storage
**What:** Each admin review action (approve/reject/request-changes) inserts an immutable row into `review_decisions`. Rows are never updated or deleted.
**When to use:** ADMR-08 (audit trail).
**Example:**
```typescript
// packages/db/src/schema/review-decisions.ts
export const reviewDecisions = pgTable(
  "review_decisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    skillId: text("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id").notNull().references(() => users.id),
    action: text("action").notNull(), // "approved" | "rejected" | "changes_requested"
    notes: text("notes"),             // Required for reject/changes_requested, optional for approve
    aiScoresSnapshot: jsonb("ai_scores_snapshot").$type<ReviewCategories>(), // Snapshot of AI scores at decision time
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("review_decisions_skill_id_idx").on(table.skillId),
    index("review_decisions_tenant_id_idx").on(table.tenantId),
    index("review_decisions_reviewer_id_idx").on(table.reviewerId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

### Pattern 3: Admin Action Server Actions with State Machine + Audit Trail
**What:** Server action validates admin role, validates state transition, updates skill status, inserts review decision, all in a transaction.
**When to use:** ADMR-03, ADMR-04, ADMR-05.
**Example:**
```typescript
// apps/web/app/actions/admin-reviews.ts
"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { db, skills } from "@everyskill/db";
import { reviewDecisions } from "@everyskill/db/schema";
import { canTransition, type SkillStatus } from "@everyskill/db/services/skill-status";
import { getSkillReview } from "@everyskill/db/services/skill-reviews";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function approveSkillAction(skillId: string, notes?: string) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }
  if (!db) return { error: "Database not configured" };

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { id: true, status: true, tenantId: true },
  });
  if (!skill) return { error: "Skill not found" };

  const currentStatus = skill.status as SkillStatus;
  if (!canTransition(currentStatus, "approved")) {
    return { error: `Cannot approve from status '${currentStatus}'` };
  }

  // Snapshot AI scores for audit trail
  const aiReview = await getSkillReview(skillId);

  await db.transaction(async (tx) => {
    // Insert immutable decision record
    await tx.insert(reviewDecisions).values({
      tenantId: skill.tenantId,
      skillId,
      reviewerId: session.user.id!,
      action: "approved",
      notes: notes || null,
      aiScoresSnapshot: aiReview?.categories ?? null,
    });

    // Transition: ai_reviewed -> approved -> published
    await tx.update(skills)
      .set({ status: "approved", statusMessage: null, updatedAt: new Date() })
      .where(eq(skills.id, skillId));

    await tx.update(skills)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(skills.id, skillId));
  });

  revalidatePath("/admin/reviews");
  return { success: true };
}
```

### Pattern 4: Line-Level Diff Rendering with Tailwind
**What:** Use the `diff` npm package to compute line-level differences, then render with standard HTML + Tailwind classes (green for additions, red for removals).
**When to use:** ADMR-07 diff view.
**Example:**
```typescript
// apps/web/components/review-diff-view.tsx
"use client";

import { diffLines, type Change } from "diff";

interface ReviewDiffViewProps {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
}

export function ReviewDiffView({
  oldContent,
  newContent,
  oldLabel = "Previous Version",
  newLabel = "Current Version",
}: ReviewDiffViewProps) {
  const changes = diffLines(oldContent, newContent);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500">{oldLabel}</span>
        <span className="text-xs font-medium text-gray-500">{newLabel}</span>
      </div>
      <pre className="text-sm font-mono overflow-x-auto">
        {changes.map((change: Change, i: number) => (
          <div
            key={i}
            className={
              change.added
                ? "bg-green-50 text-green-800 border-l-4 border-green-400"
                : change.removed
                  ? "bg-red-50 text-red-800 border-l-4 border-red-400"
                  : "text-gray-700"
            }
          >
            {change.value.split("\n").filter(Boolean).map((line, j) => (
              <div key={j} className="px-4 py-0.5">
                <span className="select-none mr-2 text-gray-400">
                  {change.added ? "+" : change.removed ? "-" : " "}
                </span>
                {line}
              </div>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}
```

### Pattern 5: Pending Review Count in Admin Nav
**What:** Query count of skills with `status = 'ai_reviewed'` in the admin layout, pass to a badge component in the nav.
**When to use:** ADMR-09.
**Example:**
```typescript
// In admin layout.tsx, add to server component:
const pendingCount = await getPendingReviewCount(session.user.tenantId!);

// In nav items array:
{ label: "Reviews", href: "/admin/reviews", badge: pendingCount }

// Badge rendering:
{item.badge > 0 && (
  <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
    {item.badge}
  </span>
)}
```

### Anti-Patterns to Avoid

- **Storing review decisions in `skill_reviews` table:** The `skill_reviews` table stores AI review data and is updated via upsert (mutable). Review decisions must be immutable. Use a separate `review_decisions` table.
- **Using `audit_logs` for review decisions:** The audit log is a generic, fire-and-forget log. Review decisions need to be queryable (show history per skill) and are a first-class domain concept, not just a log entry. Write to BOTH: `review_decisions` for queryable history, `audit_logs` for SOC2 compliance.
- **Client-side pagination:** For 20 items per page, server-side pagination with URL search params is simpler and SSR-friendly. No need for client-side state management of pages.
- **Allowing review decision modification:** The requirement says "immutable" -- no UPDATE or DELETE on `review_decisions`. The table should not have an `updatedAt` column or any mutation functions. Insert-only.
- **Skipping state machine validation in admin actions:** Even for admins, always validate `canTransition()` before updating status. This prevents double-approvals and invalid state transitions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text diffing | Custom line-by-line comparison | `diff` npm package (`diffLines`) | Handles edge cases (trailing newlines, empty lines, whitespace), proven library, 60KB |
| State machine | Inline if/else | Existing `canTransition()` from `skill-status.ts` | Already tested, covers all 7 states |
| AI review display | Custom score UI | Existing `AiReviewDisplay` component | Already renders categories, scores, suggestions, color-coded badges |
| Admin role check | Inline session checks | Existing `isAdmin()` from `lib/admin.ts` | Single function, consistent across all admin pages |
| Audit log | Custom logging | Existing `writeAuditLog()` from `packages/db/src/services/audit.ts` | Fire-and-forget, already has the right schema |
| Pagination UI | Custom page controls | Standard `<Link>` with search params | Server component pattern, no client state needed |

**Key insight:** Phase 36 is primarily a UI assembly phase. The state machine, AI review data, admin role checks, and audit logging are all built. The new work is: (1) a new DB table for decisions, (2) query functions for the review queue, (3) server actions that combine existing primitives, and (4) React components for the admin UI.

## Common Pitfalls

### Pitfall 1: Approve Action Only Transitions to `approved`, Not `published`
**What goes wrong:** Admin approves a skill, it transitions to `approved` but stays there -- never reaches `published`. Skill is invisible to users.
**Why it happens:** The state machine has `ai_reviewed -> approved` and `approved -> published` as separate transitions. The admin action must chain both.
**How to avoid:** The approve action must perform TWO transitions in a transaction: `ai_reviewed -> approved`, then `approved -> published`. Both are valid per the state machine. This mirrors the auto-approve flow from Phase 35.
**Warning signs:** Skills stuck in `approved` status that never become visible.

### Pitfall 2: Reject Action Without Required Notes
**What goes wrong:** Admin rejects a skill without providing a reason. Author has no feedback for improvement.
**Why it happens:** The notes field is not validated as required for reject/changes_requested actions.
**How to avoid:** The reject and request-changes server actions must validate that `notes` is a non-empty string. The approve action can have optional notes. Enforce this with Zod validation in the server action.
**Warning signs:** Rejected skills with null/empty notes.

### Pitfall 3: Review Queue Shows Skills from Other Tenants
**What goes wrong:** Admin sees skills from other tenants in their review queue.
**Why it happens:** Missing `tenantId` filter in the review queue query.
**How to avoid:** Always filter by `eq(skills.tenantId, session.user.tenantId)` in review queue queries. The existing `getAdminSkills()` function in `admin-skills.ts` shows the correct pattern (line 37).
**Warning signs:** Admin sees skills they don't recognize. Cross-tenant data leakage.

### Pitfall 4: Diff View Fails When No Previous Version Exists
**What goes wrong:** The diff component receives `null` for previous content and crashes or shows nothing useful.
**Why it happens:** Most skills (90+) don't have a previous version -- they were created before the version system was active. Only 1 skill has a `published_version_id`.
**How to avoid:** Check if previous content is available. If not, show just the current content (full view, no diff). The diff view is conditional: "Show diff if previous version exists, otherwise show full content." The UI should indicate "New skill -- no previous version to compare."
**Warning signs:** Error rendering diff component on skills without version history.

### Pitfall 5: Double-Click Approve Creates Duplicate Review Decisions
**What goes wrong:** Admin clicks approve twice quickly. Two decision rows are inserted, and the second `canTransition("published", "approved")` fails.
**Why it happens:** No optimistic UI lock on the approve button, and the first request hasn't completed when the second is sent.
**How to avoid:** (1) The server action validates `canTransition` -- the second request will fail gracefully with an error. (2) The client component should use `useActionState` or `useState` to disable the button during the pending state, matching the existing pattern in `admin-skills-table.tsx`.
**Warning signs:** "Cannot approve from status 'published'" error after double-clicking.

### Pitfall 6: Review Queue Count Doesn't Update After Action
**What goes wrong:** Admin approves a skill, navigates back to the review list, but the pending count badge in the nav still shows the old number.
**Why it happens:** The admin layout is a server component that caches the count. `revalidatePath("/admin/reviews")` may not revalidate the parent layout.
**How to avoid:** Call `revalidatePath("/admin")` (parent path) or `revalidatePath("/admin/reviews")` and `revalidatePath("/admin")` in the server action. The admin layout will re-render with a fresh count on next navigation.
**Warning signs:** Stale badge count after taking review actions.

### Pitfall 7: Stale Diff -- Comparing Wrong Content Versions
**What goes wrong:** The diff view compares the current `skills.content` against some previous snapshot, but the content changed between when the AI review was generated and when the admin reviews it.
**Why it happens:** The `reviewed_content_hash` in `skill_reviews` tracks what was reviewed, but the actual content could theoretically change (though the state machine should prevent edits during review).
**How to avoid:** The state machine blocks content edits during `pending_review`, `ai_reviewed`, and `approved` states (only `draft` and `changes_requested` allow edits). So the content at review time is stable. For diff purposes, compare `skills.content` (current draft) against the previous published version's content. If no previous version exists, show full content.
**Warning signs:** Diff showing changes that the admin didn't expect.

## Code Examples

### Review Decisions Migration (0015_create_review_decisions.sql)
```sql
-- Immutable audit trail for admin review decisions
-- Rows are INSERT-only, never updated or deleted
CREATE TABLE IF NOT EXISTS review_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,  -- 'approved', 'rejected', 'changes_requested'
  notes TEXT,
  ai_scores_snapshot JSONB,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS review_decisions_skill_id_idx ON review_decisions(skill_id);
CREATE INDEX IF NOT EXISTS review_decisions_tenant_id_idx ON review_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS review_decisions_reviewer_id_idx ON review_decisions(reviewer_id);

-- Enable RLS (not forced -- table owner bypasses during single-tenant phase)
ALTER TABLE review_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON review_decisions
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
```

### Review Queue Query Function
```typescript
// apps/web/lib/review-queries.ts
import { db, skills, users, skillReviews } from "@everyskill/db";
import { eq, and, sql, desc, count } from "drizzle-orm";

interface ReviewQueueParams {
  tenantId: string;
  page: number;
  pageSize: number;
  status?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getReviewQueue(params: ReviewQueueParams) {
  if (!db) return { skills: [], total: 0 };

  const conditions = [
    eq(skills.tenantId, params.tenantId),
  ];

  // Default: show skills awaiting review (ai_reviewed)
  // Also allow filtering to see rejected, changes_requested, etc.
  if (params.status) {
    conditions.push(eq(skills.status, params.status));
  } else {
    // Default filter: show ai_reviewed (awaiting admin action)
    conditions.push(eq(skills.status, "ai_reviewed"));
  }

  if (params.category) {
    conditions.push(eq(skills.category, params.category));
  }

  if (params.dateFrom) {
    conditions.push(sql`${skills.createdAt} >= ${params.dateFrom}::timestamptz`);
  }
  if (params.dateTo) {
    conditions.push(sql`${skills.createdAt} <= ${params.dateTo}::timestamptz`);
  }

  const whereClause = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: skills.id,
        name: skills.name,
        slug: skills.slug,
        category: skills.category,
        status: skills.status,
        authorName: users.name,
        authorId: skills.authorId,
        createdAt: skills.createdAt,
        updatedAt: skills.updatedAt,
      })
      .from(skills)
      .leftJoin(users, eq(skills.authorId, users.id))
      .where(whereClause)
      .orderBy(desc(skills.updatedAt))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
    db
      .select({ total: count() })
      .from(skills)
      .where(whereClause),
  ]);

  return {
    skills: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total,
  };
}

export async function getPendingReviewCount(tenantId: string): Promise<number> {
  if (!db) return 0;

  const [result] = await db
    .select({ count: count() })
    .from(skills)
    .where(and(
      eq(skills.tenantId, tenantId),
      eq(skills.status, "ai_reviewed"),
    ));

  return result.count;
}
```

### Review Detail Query (Including AI Scores)
```typescript
// apps/web/lib/review-queries.ts (continued)
export async function getReviewDetail(skillId: string, tenantId: string) {
  if (!db) return null;

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, skillId), eq(skills.tenantId, tenantId)),
    with: {
      author: { columns: { id: true, name: true, image: true } },
    },
  });

  if (!skill) return null;

  // Fetch AI review data
  const aiReview = await getSkillReview(skillId);

  // Fetch review decision history
  const decisions = await db
    .select({
      id: reviewDecisions.id,
      action: reviewDecisions.action,
      notes: reviewDecisions.notes,
      reviewerName: users.name,
      createdAt: reviewDecisions.createdAt,
    })
    .from(reviewDecisions)
    .leftJoin(users, eq(reviewDecisions.reviewerId, users.id))
    .where(eq(reviewDecisions.skillId, skillId))
    .orderBy(desc(reviewDecisions.createdAt));

  return { skill, aiReview, decisions };
}
```

### Reject Action with Required Notes
```typescript
// apps/web/app/actions/admin-reviews.ts (continued)
import { z } from "zod";

const rejectSchema = z.object({
  skillId: z.string().min(1),
  notes: z.string().min(1, "Rejection reason is required"),
});

export async function rejectSkillAction(skillId: string, notes: string) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }
  if (!db) return { error: "Database not configured" };

  const parsed = rejectSchema.safeParse({ skillId, notes });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.notes?.[0] || "Invalid input" };
  }

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { id: true, status: true, tenantId: true },
  });
  if (!skill) return { error: "Skill not found" };

  if (!canTransition(skill.status as SkillStatus, "rejected")) {
    return { error: `Cannot reject from status '${skill.status}'` };
  }

  const aiReview = await getSkillReview(skillId);

  await db.transaction(async (tx) => {
    await tx.insert(reviewDecisions).values({
      tenantId: skill.tenantId,
      skillId,
      reviewerId: session.user.id!,
      action: "rejected",
      notes: parsed.data.notes,
      aiScoresSnapshot: aiReview?.categories ?? null,
    });

    await tx.update(skills)
      .set({
        status: "rejected",
        statusMessage: `Rejected: ${parsed.data.notes}`,
        updatedAt: new Date(),
      })
      .where(eq(skills.id, skillId));
  });

  revalidatePath("/admin/reviews");
  return { success: true };
}
```

### Admin Layout with Review Count Badge
```typescript
// apps/web/app/(protected)/admin/layout.tsx
import { getPendingReviewCount } from "@/lib/review-queries";

const adminNavItems = [
  { label: "Settings", href: "/admin/settings" },
  { label: "Reviews", href: "/admin/reviews" },  // NEW
  { label: "Skills", href: "/admin/skills" },
  { label: "Merge", href: "/admin/merge" },
  { label: "API Keys", href: "/admin/keys" },
  { label: "Compliance", href: "/admin/compliance" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!isAdmin(session)) {
    redirect("/");
  }

  const pendingCount = await getPendingReviewCount(
    session.user?.tenantId || "default-tenant-000-0000-000000000000"
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
      <nav className="mt-4 flex gap-4 border-b border-gray-200 pb-3">
        {adminNavItems.map((item) => (
          <Link key={item.href} href={item.href} className="...">
            {item.label}
            {item.label === "Reviews" && pendingCount > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {pendingCount}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
```

## Diff View Strategy

### Current Data Reality

| Fact | Evidence |
|------|----------|
| 91 published skills, 5 draft skills | `SELECT status, COUNT(*) FROM skills GROUP BY status` |
| Only 1 skill has a `published_version_id` | `SELECT COUNT(*) FROM skills WHERE published_version_id IS NOT NULL` returns 1 |
| Only 1 row in `skill_versions` table | `SELECT COUNT(*) FROM skill_versions` returns 1 |
| Content is stored inline in `skills.content` column | Schema shows `content: text("content").notNull()` |

### Diff Approach

Given that the versioning system is not yet widely used (only 1 skill version exists), the diff view must handle two cases:

1. **Skill has been previously published and is now resubmitted:** Compare `skills.content` (current) against the content from the last published version. But since content isn't snapshotted on publish, we need a practical workaround.

2. **New skill (never published):** Show full content, no diff. Display a "New skill" indicator.

**Practical approach for Phase 36:** Since the `skills.content` column is the single source of truth and versions aren't widely used yet, the diff view will:
- On resubmission after `changes_requested`, the previous content (at time of rejection/changes-requested) isn't stored anywhere. The `reviewed_content_hash` in `skill_reviews` only tells us IF content changed, not WHAT changed.
- **Recommendation:** For Phase 36, show full content view for all skills. Show AI review scores alongside. Mark the diff feature as "available when version history is populated" -- a future enhancement once the R2 versioning pipeline is active. This is honest: diffing requires two content snapshots, and the current schema doesn't reliably store the "before" snapshot.
- **Alternative (if diff is required):** Add a `previous_content` text column to `review_decisions` that snapshots the current `skills.content` at the time of each review decision. Then on resubmission, compare the skill's new content against the snapshot from the last decision. This adds storage cost but solves the problem without requiring the full versioning pipeline.

**Recommended path:** Use the alternative -- snapshot `skills.content` into `review_decisions.previous_content` whenever a decision is made. On the next review, compare current content against the latest previous snapshot. This is simple, self-contained, and doesn't depend on R2 versioning.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No admin review | Admin review queue | Phase 36 (now) | Skills not auto-approved go through human review |
| AI review as advisory | AI review as pipeline gate + admin input | Phase 35 | Admins see AI scores to inform decisions |
| No audit trail for reviews | Immutable review_decisions table | Phase 36 (now) | Compliance, accountability, decision history |
| Content stored only in skills table | Content snapshot in review decisions | Phase 36 (now) | Enables diff view for resubmissions |

**Deprecated/outdated:**
- None. Phase 36 builds on all existing infrastructure without deprecating anything.

## Open Questions

1. **Should the diff view compare line-by-line or word-by-word?**
   - What we know: Skill content is markdown text, typically 50-500 lines. Line-level diff is standard for code/markdown review.
   - What's unclear: Whether word-level diff would be more useful for prose-heavy skills.
   - Recommendation: Use `diffLines` from the `diff` package for the initial implementation. It's the standard for code review UIs and maps naturally to the green/red line rendering. Word-level can be added later if admins request it.

2. **Should approve auto-publish or require a separate publish step?**
   - What we know: The state machine has `approved -> published` as separate transitions. The auto-approve flow (Phase 35) chains them.
   - What's unclear: Whether admins might want to approve but delay publishing (e.g., scheduled publish).
   - Recommendation: For Phase 36, approve = publish immediately (chain the transitions). A separate "scheduled publish" feature can come later. This matches the auto-approve behavior and keeps the admin workflow simple.

3. **What should happen when admin requests changes -- can the author see the feedback?**
   - What we know: The `statusMessage` column on skills already shows error messages to authors on the My Skills page.
   - What's unclear: Whether `statusMessage` is the right channel for admin feedback, or if the author should see the decision notes.
   - Recommendation: Set `statusMessage` to the admin's feedback notes when requesting changes. The author will see this on their My Skills page, just like they see AI review failure messages. The `review_decisions` table stores the full immutable record separately.

4. **Should the review queue show skills in `pending_review` status (AI review in progress/failed)?**
   - What we know: The default filter should be `ai_reviewed` (skills ready for admin action). `pending_review` means AI review is running or failed.
   - What's unclear: Whether admins should see pending_review skills (to monitor pipeline health).
   - Recommendation: Default filter to `ai_reviewed`. Allow filtering by other statuses (pending_review, rejected, changes_requested) via dropdown. Admins can check pipeline health by switching filters.

## Sources

### Primary (HIGH confidence)
- `packages/db/src/services/skill-status.ts` -- State machine with 7 states, transition rules, auto-approve logic (77 lines)
- `packages/db/src/services/skill-reviews.ts` -- AI review upsert/get functions (92 lines)
- `packages/db/src/schema/skills.ts` -- Skills schema with status + statusMessage columns (89 lines)
- `packages/db/src/schema/skill-reviews.ts` -- Skill reviews schema with categories JSONB (80 lines)
- `packages/db/src/schema/audit-logs.ts` -- Existing audit log schema pattern (24 lines)
- `apps/web/app/(protected)/admin/layout.tsx` -- Admin layout with nav tabs + role check (37 lines)
- `apps/web/app/(protected)/admin/skills/page.tsx` -- Existing admin page pattern (42 lines)
- `apps/web/app/actions/admin-skills.ts` -- Existing admin action patterns with isAdmin + useActionState (127 lines)
- `apps/web/components/admin-skills-table.tsx` -- Existing admin table pattern with checkboxes + actions (252 lines)
- `apps/web/components/ai-review-display.tsx` -- Existing AI review score rendering (162 lines)
- `apps/web/app/actions/submit-for-review.ts` -- Current submit flow with state machine + AI review (124 lines)
- `apps/web/components/my-skills-list.tsx` -- Status badge colors/labels (153 lines)
- `.planning/phases/34-review-pipeline-foundation/34-VERIFICATION.md` -- Phase 34 complete, all 9 requirements satisfied
- `.planning/phases/35-ai-review-integration/35-VERIFICATION.md` -- Phase 35 complete, all 6 requirements satisfied
- Database queries confirming 91 published skills, 5 drafts, 1 skill version, 0 review decisions

### Secondary (MEDIUM confidence)
- [diff npm package](https://www.npmjs.com/package/diff) -- `diffLines` API for line-level text comparison
- [react-diff-viewer-continued](https://www.npmjs.com/package/react-diff-viewer-continued) -- Considered but rejected (too heavy for this use case)
- Phase 32 research (admin panel patterns, role checks, data tables)

### Tertiary (LOW confidence)
- None. All findings are based on verified codebase analysis and official npm packages.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Only 1 new dependency (`diff`), everything else is existing stack
- Architecture: HIGH -- Extends existing admin panel patterns directly, all integration points verified in source code
- State machine integration: HIGH -- Verified transitions in `skill-status.ts`, confirmed `canTransition` validates all paths
- Review decisions table: HIGH -- Follows existing schema patterns (tenant isolation, RLS, pgPolicy), modeled after `skill_reviews` + `audit_logs`
- Diff view: MEDIUM -- The `diff` package API is standard, but the content snapshot strategy for "previous version" comparison is a design decision not yet validated in production
- Pitfalls: HIGH -- Each pitfall derived from direct code analysis (e.g., approve must chain two transitions, notes required for rejection, tenant isolation in queries)

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable domain, no external dependencies changing)
