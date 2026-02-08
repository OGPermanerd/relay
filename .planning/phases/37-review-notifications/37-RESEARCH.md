# Phase 37: Review Notifications - Research

**Researched:** 2026-02-08
**Domain:** Notification dispatch for skill review lifecycle events
**Confidence:** HIGH

## Summary

The EverySkill platform already has a mature notification infrastructure from Phase 33: a `notifications` table with `type`, `title`, `message`, `actionUrl`, and `metadata` columns; a `notification_preferences` table with per-type email/in-app boolean toggles; a `createNotification` service; Resend-based email dispatch with React Email templates; and a notification bell UI with a dropdown list component.

Adding review notifications requires: (1) expanding the notification `type` union to include five new review event types, (2) adding two new preference columns (`review_notifications_email` and `review_notifications_in_app`) to the `notification_preferences` table via migration, (3) creating a review notification email template, (4) building a `notifyReviewEvent()` dispatch function following the exact pattern of `notifyGroupingProposal()`, (5) wiring dispatch calls into `submit-for-review.ts` and `admin-reviews.ts`, (6) adding a `getAdminsInTenant()` service function, and (7) updating the notification bell UI to render review notification types with appropriate icons and action URLs.

**Primary recommendation:** Follow the established fire-and-forget notification dispatch pattern from `apps/web/lib/notifications.ts`, creating a single `notifyReviewEvent()` function that handles all five review notification types. Use a single DB migration to add the two new preference columns. Reuse the existing `EmailLayout` component and create one `ReviewNotificationEmail` template with conditional rendering for each event type.

## Standard Stack

### Core (Already Installed)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| `@everyskill/db` (drizzle-orm 0.42.0) | DB schema, services, queries | Already used for all data access |
| `resend` | Email delivery | Already configured in `apps/web/lib/email.ts` |
| `@react-email/components` | Email templates | Already used for 3 email templates |
| `@react-email/render` | Server-side email rendering | Already used in notification dispatch |

### No New Dependencies Required
All required infrastructure exists. No new npm packages needed.

## Architecture Patterns

### Existing Notification Flow (Reference Pattern)

The grouping proposal notification flow in `apps/web/lib/notifications.ts` is the canonical pattern:

```
Server Action (trigger)
  -> notifyGroupingProposal() (fire-and-forget dispatch)
    -> getOrCreatePreferences() (check user prefs)
    -> createNotification() (in-app, if enabled)
    -> render() + sendEmail() (email, if enabled)
```

All review notifications MUST follow this exact pattern.

### Notification Type System

Current types (string union, not DB enum):
```typescript
// packages/db/src/services/notifications.ts line 12
type: "grouping_proposal" | "trending_digest" | "platform_update"
```

New types to add:
```typescript
type: "grouping_proposal" | "trending_digest" | "platform_update"
    | "review_submitted"      // RVNT-01: skill submitted for review
    | "review_approved"       // RVNT-02: skill approved
    | "review_rejected"       // RVNT-03: skill rejected
    | "review_changes_requested" // RVNT-04: changes requested
    | "review_published"      // RVNT-05: skill published
```

**Important:** The `type` column is a plain `text` column, NOT a pg enum. Adding new types requires only updating the TypeScript union in `CreateNotificationParams` -- no migration needed for the type field itself.

### Preference System

Current preferences (one row per user):
```typescript
// packages/db/src/schema/notification-preferences.ts
groupingProposalEmail: boolean    // default true
groupingProposalInApp: boolean    // default true
trendingDigest: digestFrequencyEnum  // "none" | "daily" | "weekly"
platformUpdatesEmail: boolean     // default true
platformUpdatesInApp: boolean     // default true
```

Per RVNT-06, all review notifications share a single toggle. Add:
```typescript
reviewNotificationsEmail: boolean  // default true
reviewNotificationsInApp: boolean  // default true
```

This requires a DB migration to add two columns to `notification_preferences`.

### Recommended Project Structure for Changes

```
packages/db/src/
  schema/notification-preferences.ts    # Add 2 new boolean columns
  services/notifications.ts             # Expand type union
  services/notification-preferences.ts  # Expand updatePreferences type
  services/user.ts                      # Add getAdminsInTenant()
  services/index.ts                     # Export getAdminsInTenant
  migrations/0016_add_review_notification_prefs.sql  # New migration

apps/web/
  lib/notifications.ts                  # Add notifyReviewEvent() function
  emails/review-notification.tsx        # New email template
  app/actions/submit-for-review.ts      # Wire RVNT-01 (+ auto-approve RVNT-05)
  app/actions/admin-reviews.ts          # Wire RVNT-02, 03, 04, 05
  app/actions/notification-preferences.ts  # Add new pref fields
  app/(protected)/settings/notifications/
    notification-preferences-form.tsx   # Add "Review Notifications" section
  components/notification-list.tsx      # Add review notification type icons
```

### Pattern: Review Notification Dispatch Function

Following `notifyGroupingProposal()` pattern:

```typescript
// apps/web/lib/notifications.ts
export async function notifyReviewEvent(params: {
  tenantId: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  type: "review_submitted" | "review_approved" | "review_rejected"
      | "review_changes_requested" | "review_published";
  skillName: string;
  skillSlug: string;
  notes?: string;       // admin feedback for reject/changes_requested
  reviewerName?: string; // admin who took action
}): Promise<void> {
  try {
    const preferences = await getOrCreatePreferences(params.recipientId, params.tenantId);

    // In-app notification (respects single toggle for all review types)
    if (preferences?.reviewNotificationsInApp !== false) {
      await createNotification({
        tenantId: params.tenantId,
        userId: params.recipientId,
        type: params.type,
        title: REVIEW_NOTIFICATION_TITLES[params.type],
        message: buildReviewMessage(params),
        actionUrl: buildReviewActionUrl(params),
        metadata: { skillName: params.skillName, notes: params.notes },
      });
    }

    // Email (respects single toggle)
    if (preferences?.reviewNotificationsEmail !== false) {
      const html = await render(ReviewNotificationEmail({ ... }));
      await sendEmail({ to: params.recipientEmail, subject: ..., html });
    }
  } catch (error) {
    console.error("[NOTIFICATION ERROR] Failed to dispatch review notification:", error);
  }
}
```

### Pattern: Admin Discovery for RVNT-01

RVNT-01 requires notifying ALL admins in the tenant when a skill is submitted. The existing `getUsersInTenant()` returns all users with their `role` field. A new `getAdminsInTenant()` function should filter to `role = 'admin'`:

```typescript
// packages/db/src/services/user.ts
export async function getAdminsInTenant(tenantId: string) {
  if (!db) return [];
  return db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")));
}
```

### Pattern: Wiring into Server Actions

**submit-for-review.ts** (RVNT-01 + auto-approve RVNT-05):

The `submitForReview()` function has two paths after AI review:
1. **Auto-approved** (lines 83-98): transitions directly to `published`. Trigger RVNT-05 (author notified of publish). Do NOT trigger RVNT-01 since no admin review was needed.
2. **Not auto-approved** (lines 100-104): transitions to `ai_reviewed` for human review. Trigger RVNT-01 to notify all admins.

Key data available at this point:
- `session.user.id` -- the author (submitter)
- `skillId` -- the skill being submitted
- `skill.name` -- available from the query on line 26
- Skill `tenantId` is NOT currently fetched -- must add `tenantId: true` to the columns selection
- Author email/name are NOT available -- must query from session or users table

**admin-reviews.ts** (RVNT-02, 03, 04):

The three admin actions (`approveSkillAction`, `rejectSkillAction`, `requestChangesAction`) all follow the same pattern:
1. Validate admin auth
2. Fetch skill (currently selects: `id, status, tenantId, content`)
3. Execute state transition in transaction

**Critical gap:** None of these actions currently fetch `skill.authorId`. Must add `authorId: true` to the columns selection. Then look up the author's email/name to send notification.

For RVNT-05 (publish notification): `approveSkillAction` transitions `approved -> published` inside its transaction. After the transaction succeeds, fire RVNT-05 notification to the author.

### Anti-Patterns to Avoid

- **Do NOT put notification dispatch inside DB transactions.** Notification dispatch involves network I/O (email sending). Keep it outside the transaction, after the commit, as fire-and-forget.
- **Do NOT block the server action on notification delivery.** Use the fire-and-forget pattern (try/catch with console.error, never re-throw).
- **Do NOT create separate notification types per event for preference toggling.** RVNT-06 specifies a single toggle. All five review notification types share `reviewNotificationsEmail` / `reviewNotificationsInApp`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email rendering | Custom HTML string building | `@react-email/components` + `render()` | Already established pattern, handles CSS inlining |
| Email delivery | SMTP client / nodemailer | `resend` via `sendEmail()` wrapper | Already configured with stub mode for dev |
| Notification preferences | Custom preference logic | `getOrCreatePreferences()` | Handles race conditions, default creation |
| Admin role check | Custom role query | `isAdmin(session)` from `@/lib/admin` | Reads from JWT, no DB query needed |
| Admin user discovery | Filtering `getUsersInTenant()` results in JS | New `getAdminsInTenant()` with SQL WHERE | Efficient, single query |

## Common Pitfalls

### Pitfall 1: Missing authorId in Admin Review Actions
**What goes wrong:** `admin-reviews.ts` actions don't currently select `authorId` from the skill. Without it, you can't notify the author.
**Why it happens:** The actions were built before notifications were a requirement.
**How to avoid:** Add `authorId: true` to the `columns` selection in all three admin review actions. Then query the user table for the author's email and name.
**Warning signs:** `skill.authorId` is undefined at notification dispatch time.

### Pitfall 2: Missing tenantId in Submit-for-Review
**What goes wrong:** `submit-for-review.ts` doesn't currently select `tenantId` from the skill. Without it, you can't query admin users or create notifications.
**Why it happens:** The action uses `session.user.id` to scope the query but doesn't need tenantId for its current logic.
**How to avoid:** Add `tenantId: true` to the `columns` selection. Or use `session.user.tenantId` from the JWT.
**Warning signs:** `tenantId` is undefined when calling `getAdminsInTenant()`.

### Pitfall 3: Notification Dispatch Inside Transaction
**What goes wrong:** If you put `notifyReviewEvent()` inside the DB transaction in `admin-reviews.ts`, the transaction holds open while email sending happens. If email fails, it could roll back the review decision.
**Why it happens:** Natural instinct to put related operations together.
**How to avoid:** Always dispatch notifications AFTER the transaction commits. The pattern is: `await db.transaction(async (tx) => { ... }); await notifyReviewEvent(...)`.

### Pitfall 4: Auto-Approve Notification Logic
**What goes wrong:** When auto-approve triggers in `submitForReview()`, the skill goes `pending_review -> ai_reviewed -> approved -> published` in one action. If you naively trigger RVNT-01 (submitted for review), admins get a notification about a skill that was already auto-approved and published.
**Why it happens:** Two notification triggers in the same code path.
**How to avoid:** Only trigger RVNT-01 when `autoApproved === false`. When auto-approved, trigger RVNT-05 (published) instead. The author doesn't need a "submitted" notification since they triggered the action.

### Pitfall 5: Migration Column Defaults
**What goes wrong:** Adding NOT NULL columns to `notification_preferences` without defaults causes errors for existing rows.
**Why it happens:** Forgetting the DEFAULT clause.
**How to avoid:** Always use `DEFAULT true` for new boolean preference columns, matching the pattern of existing columns.

### Pitfall 6: Hydration Mismatch with Dates
**What goes wrong:** Server-rendered notification timestamps don't match client hydration.
**Why it happens:** Node.js and browser Intl differ.
**How to avoid:** Use `.toISOString()` before passing dates to client components. Already handled in `getMyNotifications()` action.

## Code Examples

### Migration: Add Review Notification Preferences

```sql
-- 0016_add_review_notification_prefs.sql
ALTER TABLE notification_preferences
  ADD COLUMN review_notifications_email boolean NOT NULL DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN review_notifications_in_app boolean NOT NULL DEFAULT true;
```

### Schema Update: notification-preferences.ts

```typescript
// Add to notificationPreferences table definition:
reviewNotificationsEmail: boolean("review_notifications_email").notNull().default(true),
reviewNotificationsInApp: boolean("review_notifications_in_app").notNull().default(true),
```

### Service Update: Expand Notification Type Union

```typescript
// packages/db/src/services/notifications.ts
export interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  type: "grouping_proposal" | "trending_digest" | "platform_update"
      | "review_submitted" | "review_approved" | "review_rejected"
      | "review_changes_requested" | "review_published";
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}
```

### Service: getAdminsInTenant

```typescript
// packages/db/src/services/user.ts
import { and } from "drizzle-orm";

export async function getAdminsInTenant(tenantId: string) {
  if (!db) return [];
  try {
    return await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")));
  } catch {
    return [];
  }
}
```

### Notification Title/Message Mapping

```typescript
const REVIEW_TITLES: Record<string, string> = {
  review_submitted: "Skill Submitted for Review",
  review_approved: "Skill Approved",
  review_rejected: "Skill Rejected",
  review_changes_requested: "Changes Requested",
  review_published: "Skill Published",
};

function buildActionUrl(type: string, skillSlug: string): string {
  switch (type) {
    case "review_submitted":
      return `/admin/reviews`;  // admin goes to review queue
    case "review_approved":
    case "review_published":
      return `/skills/${skillSlug}`;  // author goes to their skill
    case "review_rejected":
    case "review_changes_requested":
      return `/my-skills`;  // author goes to edit their skill
    default:
      return "/";
  }
}
```

### Wiring in submit-for-review.ts (RVNT-01 + RVNT-05)

```typescript
// After line 107 (after revalidatePath), before return:
if (autoApproved) {
  // RVNT-05: Notify author their skill was published (auto-approved)
  // Author is session.user, so just fire to self (they still want the confirmation)
  notifyReviewEvent({
    tenantId: session.user.tenantId!,
    recipientId: session.user.id,
    recipientEmail: session.user.email!,
    recipientName: session.user.name || "there",
    type: "review_published",
    skillName: skill.name,
    skillSlug: skill.slug ?? skillId,
  }).catch(() => {}); // fire-and-forget
} else {
  // RVNT-01: Notify all admins that a skill needs review
  const admins = await getAdminsInTenant(session.user.tenantId!);
  for (const admin of admins) {
    notifyReviewEvent({
      tenantId: session.user.tenantId!,
      recipientId: admin.id,
      recipientEmail: admin.email,
      recipientName: admin.name || "there",
      type: "review_submitted",
      skillName: skill.name,
      skillSlug: skill.slug ?? skillId,
      reviewerName: session.user.name || "Unknown",
    }).catch(() => {}); // fire-and-forget
  }
}
```

### Wiring in admin-reviews.ts (RVNT-02, 03, 04, 05)

```typescript
// In approveSkillAction, after transaction:
// Need to fetch author info
const author = await db.query.users.findFirst({
  where: eq(users.id, skill.authorId),
  columns: { id: true, email: true, name: true },
});
if (author) {
  // RVNT-02: Notify author of approval
  notifyReviewEvent({
    tenantId: skill.tenantId,
    recipientId: author.id,
    recipientEmail: author.email,
    recipientName: author.name || "there",
    type: "review_approved",
    skillName: skill.name,  // need to add name to columns
    skillSlug: skill.slug,  // need to add slug to columns
    notes,
    reviewerName: session.user.name || "Admin",
  }).catch(() => {});

  // RVNT-05: Notify author of publication (approve transitions to published)
  notifyReviewEvent({
    tenantId: skill.tenantId,
    recipientId: author.id,
    recipientEmail: author.email,
    recipientName: author.name || "there",
    type: "review_published",
    skillName: skill.name,
    skillSlug: skill.slug,
  }).catch(() => {});
}
```

### Notification Bell: Type-to-Icon Mapping

The `notification-list.tsx` component currently renders a generic unread dot. To add type-specific icons per RVNT-07, add an icon mapping:

```typescript
function getNotificationIcon(type: string) {
  switch (type) {
    case "review_submitted":
      return /* clipboard/document icon */;
    case "review_approved":
      return /* checkmark/green icon */;
    case "review_rejected":
      return /* x-circle/red icon */;
    case "review_changes_requested":
      return /* pencil/yellow icon */;
    case "review_published":
      return /* globe/rocket icon */;
    case "grouping_proposal":
      return /* link/chain icon */;
    default:
      return /* bell icon */;
  }
}
```

### Preferences Form: New Section

```typescript
// Add between Platform Updates section and save button:
{/* Section 4: Review Notifications */}
<div className="border-t border-gray-200 p-6">
  <h2 className="text-base font-medium text-gray-900">Review Notifications</h2>
  <p className="mt-1 text-sm text-gray-500">
    When your skills are reviewed or when skills need your review
  </p>
  <div className="mt-4 space-y-3">
    <label className="flex items-center gap-3">
      <input type="checkbox" name="reviewNotificationsEmail" defaultChecked={...} ... />
      <span className="text-sm text-gray-700">Email notifications</span>
    </label>
    <label className="flex items-center gap-3">
      <input type="checkbox" name="reviewNotificationsInApp" defaultChecked={...} ... />
      <span className="text-sm text-gray-700">In-app notifications</span>
    </label>
  </div>
</div>
```

## Key Data Flow: Who Gets Notified

| Event | Trigger Point | Recipients | Data Needed |
|-------|--------------|------------|-------------|
| RVNT-01: Submitted | `submit-for-review.ts` (autoApproved=false) | All tenant admins | `getAdminsInTenant(tenantId)` |
| RVNT-02: Approved | `admin-reviews.ts` approveSkillAction | Skill author | `skill.authorId` -> user lookup |
| RVNT-03: Rejected | `admin-reviews.ts` rejectSkillAction | Skill author | `skill.authorId` -> user lookup |
| RVNT-04: Changes Requested | `admin-reviews.ts` requestChangesAction | Skill author | `skill.authorId` -> user lookup |
| RVNT-05: Published | `admin-reviews.ts` approveSkillAction OR `submit-for-review.ts` (autoApproved=true) | Skill author | `skill.authorId` -> user lookup |

## Files That Need Modification (Complete List)

| File | Change | Why |
|------|--------|-----|
| `packages/db/src/schema/notification-preferences.ts` | Add 2 boolean columns | RVNT-06 preference toggle |
| `packages/db/src/services/notifications.ts` | Expand type union | Support new notification types |
| `packages/db/src/services/notification-preferences.ts` | Expand updatePreferences type | Allow saving new prefs |
| `packages/db/src/services/user.ts` | Add `getAdminsInTenant()` | RVNT-01 admin discovery |
| `packages/db/src/services/index.ts` | Export `getAdminsInTenant` | Make available to app |
| `packages/db/src/migrations/0016_*.sql` | New migration file | Add columns to DB |
| `apps/web/lib/notifications.ts` | Add `notifyReviewEvent()` | Dispatch function |
| `apps/web/emails/review-notification.tsx` | New file | Email template |
| `apps/web/app/actions/submit-for-review.ts` | Wire RVNT-01, RVNT-05 | Trigger on submit |
| `apps/web/app/actions/admin-reviews.ts` | Wire RVNT-02, 03, 04, 05; add authorId/name/slug to columns | Trigger on review decisions |
| `apps/web/app/actions/notification-preferences.ts` | Add new pref fields to get/save | Preferences API |
| `apps/web/app/(protected)/settings/notifications/notification-preferences-form.tsx` | Add review section | RVNT-06 UI |
| `apps/web/components/notification-list.tsx` | Add type-specific icons | RVNT-07 bell UI |

## Open Questions

1. **Should auto-approved skills send RVNT-05 to the author?**
   - What we know: The author triggered the action and gets the `{ success: true, autoApproved: true }` response immediately.
   - What's unclear: Do they also need an in-app notification and email saying "published"?
   - Recommendation: YES, send it. The notification serves as a persistent record and email confirmation. The slight redundancy is better than a gap.

2. **Should RVNT-02 (approved) and RVNT-05 (published) be sent separately?**
   - What we know: In `approveSkillAction`, the skill goes `approved -> published` in one transaction. These are logically the same event.
   - What's unclear: Does the author want two notifications?
   - Recommendation: Send only RVNT-05 (published) from `approveSkillAction`. The approval is implicit in the publication. This avoids double-notification spam.

3. **Notification bell icon implementation**
   - What we know: The current `notification-list.tsx` uses only a blue unread dot, no type-specific icons.
   - Recommendation: Add inline SVG icons matching the Heroicons style already used by the bell button. Use color coding: green for approved/published, red for rejected, yellow for changes_requested, blue for submitted.

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/notifications.ts` - notification table schema
- `packages/db/src/schema/notification-preferences.ts` - preferences schema
- `packages/db/src/services/notifications.ts` - notification CRUD service
- `packages/db/src/services/notification-preferences.ts` - preferences service
- `packages/db/src/services/user.ts` - user service with `getUsersInTenant()`
- `packages/db/src/schema/users.ts` - user schema with `role` enum (admin/member)
- `apps/web/lib/notifications.ts` - `notifyGroupingProposal()` dispatch pattern
- `apps/web/lib/email.ts` - Resend-based email service
- `apps/web/lib/admin.ts` - `isAdmin()` helper
- `apps/web/emails/platform-update.tsx` - email template pattern
- `apps/web/emails/grouping-proposal.tsx` - email template with CTA
- `apps/web/emails/components/email-layout.tsx` - shared email layout
- `apps/web/app/actions/submit-for-review.ts` - submission server action
- `apps/web/app/actions/admin-reviews.ts` - approve/reject/request-changes actions
- `apps/web/app/actions/admin-notifications.ts` - platform update dispatch (reference)
- `apps/web/app/actions/notification-preferences.ts` - preferences server actions
- `apps/web/components/notification-bell.tsx` - bell UI component
- `apps/web/components/notification-list.tsx` - notification dropdown list
- `apps/web/app/(protected)/settings/notifications/notification-preferences-form.tsx` - preferences form

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all infrastructure already exists, no new dependencies
- Architecture: HIGH - established patterns in codebase, straightforward extension
- Pitfalls: HIGH - identified through direct code analysis of existing server actions

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable infrastructure, unlikely to change)
