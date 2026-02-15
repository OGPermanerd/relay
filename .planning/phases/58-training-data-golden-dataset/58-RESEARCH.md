# Phase 58: Training Data & Golden Dataset - Research

**Researched:** 2026-02-15
**Domain:** Skill training examples, golden dataset seeding, usage-based capture with consent
**Confidence:** HIGH

## Summary

Phase 58 adds the ability for skill authors to seed golden input/output examples and for real usage data to be captured as training examples with explicit consent. The existing `skill_feedback` table already has all required columns (`exampleInput`, `exampleOutput`, `expectedOutput`, `qualityScore`) and the `feedbackType='training_example'` discriminator. No schema migration is needed.

The implementation follows the exact same pattern as Phase 57's suggestion feature: a new server action for creating training examples, a new client component for the form, display in the skill detail tabs, and a DB service function. The two new concerns beyond suggestions are: (1) a tenant-level opt-in setting for usage-based capture (adding a column to `site_settings`), and (2) a per-user consent toggle (adding a field to `user_preferences` JSONB).

**Primary recommendation:** Follow the Phase 57 suggestion pattern exactly -- server action + Zod validation + sanitizePayload + DB service + client form component + new tab in SkillDetailTabs. Add `trainingDataCaptureEnabled` boolean to `site_settings` schema and `trainingDataConsent` boolean to the `user_preferences` JSONB interface. No new tables needed.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App framework | Project standard |
| Drizzle ORM | 0.42.0 | Database queries | Project standard |
| Zod | latest | Form validation | Used in all server actions |
| React 19 | latest | UI (useActionState) | Project standard |

### Supporting (already in project)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `sanitize-payload.ts` | Secret detection/stripping | ALL user-submitted text before DB insert |
| `@everyskill/db` | Schema + services | All DB operations |

### No New Dependencies Needed
Everything required is already in the project. No npm installs needed.

## Architecture Patterns

### Existing Pattern to Follow: Phase 57 Suggestion Flow

The suggestion feature from Phase 57 is the exact template:

```
Server Page (skills/[slug]/page.tsx)
  |-- Fetches data in parallel Promise.all
  |-- Passes to SkillDetailTabs as prop
  |-- SkillDetailTabs renders tab + panel

Server Action (app/actions/skill-feedback.ts)
  |-- Zod validation
  |-- auth() check
  |-- sanitizePayload() on user text
  |-- DB service call
  |-- revalidatePath()

DB Service (packages/db/src/services/skill-feedback.ts)
  |-- Insert with feedbackType discriminator
  |-- Query with feedbackType filter

Client Component (components/suggestion-form.tsx)
  |-- useActionState hook
  |-- Hidden fields for skillId/skillSlug
  |-- Form inputs with validation feedback
```

### Where Each Piece Goes

```
packages/db/src/
  schema/
    skill-feedback.ts        # ALREADY HAS all columns (exampleInput, exampleOutput, expectedOutput)
    site-settings.ts         # ADD trainingDataCaptureEnabled boolean column
    user-preferences.ts      # ADD trainingDataConsent to UserPreferencesData interface
  services/
    skill-feedback.ts        # ADD createTrainingExample(), getTrainingExamplesForSkill(), getTrainingExampleCount()
    site-settings.ts         # NO CHANGES (generic upsert already works)
    user-preferences.ts      # NO CHANGES (generic JSONB update already works)
  migrations/
    0034_add_training_data_settings.sql  # ADD column to site_settings

apps/web/
  app/actions/
    skill-feedback.ts        # ADD submitTrainingExample action, captureUsageAsTraining action
  components/
    training-example-form.tsx # NEW - golden example input form (author only)
    training-example-list.tsx # NEW - list of training examples for a skill
    skill-detail-tabs.tsx     # MODIFY - add "Training" tab
  app/(protected)/skills/[slug]/
    page.tsx                  # MODIFY - fetch training example count, pass to tabs
```

### SkillDetailTabs Extension Pattern

Current tabs: `details | ai-review | suggestions`
New tabs: `details | ai-review | suggestions | training`

The `SkillDetailTabs` component uses a `TabKey` union type and a `tabs` array. Extension is straightforward:

```typescript
// Current
type TabKey = "details" | "ai-review" | "suggestions";

// Extended
type TabKey = "details" | "ai-review" | "suggestions" | "training";
```

New props needed:
```typescript
interface SkillDetailTabsProps {
  children: ReactNode;
  aiReviewContent: ReactNode;
  suggestionsContent?: ReactNode;
  suggestionCount?: number;
  trainingContent?: ReactNode;        // NEW
  trainingExampleCount?: number;       // NEW
  showTrainingTab?: boolean;           // NEW - only show for authors
}
```

### Training Example DB Record Shape

Using existing `skill_feedback` columns:
```typescript
{
  tenantId: string,
  skillId: string,
  userId: string,           // author who seeded it, or user who consented
  usageEventId?: string,    // set when captured from real usage
  feedbackType: "training_example",
  exampleInput: string,     // the input text
  exampleOutput: string,    // the actual/expected output text
  expectedOutput?: string,  // optional "gold standard" output (for golden examples)
  qualityScore?: number,    // 1-10 quality rating
  source: "web" | "usage_capture",  // distinguish golden vs captured
  status: "pending",        // or "approved" for golden examples from author
}
```

### Tenant-Level Setting

Add to `site_settings` schema:
```typescript
trainingDataCaptureEnabled: boolean("training_data_capture_enabled").notNull().default(false),
```

This controls whether the "Capture from Usage" feature is available at all. When false, only manual golden example seeding works.

### Per-User Consent

Add to `UserPreferencesData` interface in `user-preferences.ts`:
```typescript
export interface UserPreferencesData {
  preferredCategories: (...)[];
  defaultSort: "uses" | "quality" | "rating" | "days_saved";
  claudeMdWorkflowNotes: string;
  trainingDataConsent: boolean;  // NEW - defaults to false
}
```

The JSONB approach means no migration needed for this -- just update the interface and default. The `getOrCreateUserPreferences` already merges with code defaults.

### Usage Capture Flow

The `/api/track` route receives usage events with `tool_input_snippet` and `tool_output_snippet` in metadata. To capture as training data:

1. After inserting the tracking event, check:
   - Is `trainingDataCaptureEnabled` in tenant's site_settings?
   - Does the user have `trainingDataConsent: true` in preferences?
2. If both true, sanitize the input/output snippets and insert a `training_example` row
3. Link via `usageEventId`

This is a fire-and-forget operation, same as the token measurement insert pattern already in the track route.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret detection | Custom regex scanner | `sanitizePayload()` from `apps/web/lib/sanitize-payload.ts` | Already handles 12 secret patterns including API keys, tokens, connection strings |
| Form validation | Manual checks | Zod schemas in server actions | Project standard, provides field-level errors |
| Tab UI | Custom tab system | Extend existing `SkillDetailTabs` component | Already has ARIA roles, keyboard handling pattern |
| Tenant settings toggle | Custom settings table | Add column to existing `site_settings` table | Already has cache, upsert, service layer |
| User consent toggle | Separate consent table | Add to `user_preferences` JSONB | Already has getOrCreate, merge-with-defaults pattern |

## Common Pitfalls

### Pitfall 1: Missing Sanitization on Captured Usage Data
**What goes wrong:** Usage data from MCP hooks contains real user content that may include secrets (API keys, passwords in tool inputs).
**Why it happens:** The track route currently does NOT sanitize `tool_input_snippet` / `tool_output_snippet` -- it just stores them as metadata.
**How to avoid:** Always run `sanitizePayload()` on both `exampleInput` and `exampleOutput` before inserting training_example records, regardless of source (manual or captured).
**Warning signs:** `[REDACTED]` tokens appearing in training data means the sanitizer caught something.

### Pitfall 2: Golden Examples vs Captured Examples Confusion
**What goes wrong:** No way to distinguish author-seeded golden examples from usage-captured examples.
**Why it happens:** Both use `feedbackType='training_example'`.
**How to avoid:** Use the `source` column: `source='web'` for golden examples seeded via the form, `source='usage_capture'` for captured from real usage. The `usageEventId` being non-null also indicates a captured example.
**Warning signs:** Count queries not filtering by source when they should.

### Pitfall 3: Consent Check Race Condition
**What goes wrong:** User revokes consent but in-flight usage events still get captured.
**Why it happens:** The track route and consent check are not transactional.
**How to avoid:** This is acceptable -- the window is milliseconds. If needed later, a background cleanup job can remove captured examples for users who revoked consent. Don't over-engineer this now.

### Pitfall 4: Serialization Hydration Mismatch
**What goes wrong:** Passing Date objects from server to client components causes hydration errors.
**Why it happens:** React 19 server/client boundary requires serializable data.
**How to avoid:** Always use `.toISOString()` before passing dates to client components. Accept `string` in client interfaces. This is already done for suggestions (see `serializedSuggestions` in page.tsx).

### Pitfall 5: Admin Settings Form Hidden Fields
**What goes wrong:** Adding a new setting to `site_settings` without updating hidden fields in ALL form sections of `admin-settings-form.tsx`.
**Why it happens:** Each section's form preserves other settings as hidden inputs. A new setting must be added as a hidden input in every other section's form.
**How to avoid:** Add `trainingDataCaptureEnabled` as a hidden input in the Semantic Similarity, Skill Downloads, and Gmail Diagnostics form sections. Better yet, consider adding a dedicated section for training data settings.

### Pitfall 6: No isGoldenExample Column Exists
**What goes wrong:** The requirements mention `isGoldenExample` but it does NOT exist in the schema.
**Why it happens:** Early architecture docs proposed it but it was never added to the migration.
**How to avoid:** Use `source='web'` + `status='approved'` to identify golden examples, OR distinguish by whether the userId matches the skill's authorId. No need for a separate boolean column.

## Code Examples

### Server Action: Submit Golden Training Example
```typescript
// Based on submitSuggestion pattern in app/actions/skill-feedback.ts

const trainingExampleSchema = z.object({
  skillId: z.string().min(1),
  skillSlug: z.string().min(1),
  exampleInput: z.string().min(1, "Input is required").max(5000),
  exampleOutput: z.string().min(1, "Expected output is required").max(5000),
  qualityScore: z.coerce.number().int().min(1).max(10).optional(),
});

export async function submitTrainingExample(
  prevState: TrainingExampleState,
  formData: FormData
): Promise<TrainingExampleState> {
  const session = await auth();
  if (!session?.user?.id) return { message: "Sign in required" };

  // Only skill author can seed golden examples
  // ... verify authorId matches session.user.id

  const sanitizedInput = sanitizePayload(parsed.data.exampleInput).sanitized;
  const sanitizedOutput = sanitizePayload(parsed.data.exampleOutput).sanitized;

  await createTrainingExample({
    tenantId: session.user.tenantId,
    skillId: parsed.data.skillId,
    userId: session.user.id,
    exampleInput: sanitizedInput,
    exampleOutput: sanitizedOutput,
    source: "web",
    status: "approved", // golden examples auto-approved
  });

  revalidatePath(`/skills/${parsed.data.skillSlug}`);
  return { success: true };
}
```

### DB Service: Create Training Example
```typescript
// Add to packages/db/src/services/skill-feedback.ts

export async function createTrainingExample(params: {
  tenantId: string;
  skillId: string;
  userId: string;
  exampleInput: string;
  exampleOutput: string;
  expectedOutput?: string;
  qualityScore?: number;
  source?: string;
  status?: string;
  usageEventId?: string;
}): Promise<string | null> {
  if (!db) return null;

  const [inserted] = await db
    .insert(skillFeedback)
    .values({
      tenantId: params.tenantId,
      skillId: params.skillId,
      userId: params.userId,
      feedbackType: "training_example",
      exampleInput: params.exampleInput,
      exampleOutput: params.exampleOutput,
      expectedOutput: params.expectedOutput ?? null,
      qualityScore: params.qualityScore ?? null,
      source: params.source ?? "web",
      status: params.status ?? "pending",
      usageEventId: params.usageEventId ?? null,
    })
    .returning({ id: skillFeedback.id });

  return inserted?.id ?? null;
}
```

### DB Service: Get Training Example Count
```typescript
export async function getTrainingExampleCount(skillId: string): Promise<number> {
  if (!db) return 0;

  const [result] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(skillFeedback)
    .where(
      and(
        eq(skillFeedback.skillId, skillId),
        eq(skillFeedback.feedbackType, sql`'training_example'`)
      )
    );

  return result?.count ?? 0;
}
```

### Usage Capture in Track Route
```typescript
// Add to apps/web/app/api/track/route.ts after the token measurement block

// 7c. Capture as training example if consent given (fire-and-forget)
if (parsed.data.tool_input_snippet && parsed.data.tool_output_snippet) {
  void captureUsageAsTraining({
    tenantId: keyResult.tenantId,
    userId: keyResult.userId,
    skillId: parsed.data.skill_id,
    inputSnippet: parsed.data.tool_input_snippet,
    outputSnippet: parsed.data.tool_output_snippet,
  });
}
```

### Migration: Add Training Data Setting
```sql
-- 0034_add_training_data_settings.sql
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS training_data_capture_enabled BOOLEAN NOT NULL DEFAULT false;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate training_examples table | Reuse skill_feedback with feedbackType discriminator | Phase 55 decision | Fewer tables, shared indexes, unified feedback model |
| isGoldenExample boolean column | Use source + status + authorId check | Phase 55 actual implementation | No extra column needed |
| Separate consent table | JSONB field in user_preferences | Existing pattern | No migration for new preference fields |

## Key Findings

### Schema is Ready (No Migration for Training Examples)
The `skill_feedback` table already has `example_input`, `example_output`, `expected_output`, and `quality_score` columns (added in migration 0030). The `feedbackType='training_example'` discriminator is documented in the schema. No new table or columns needed for the core training example storage.

### One Small Migration Needed
Only one migration is needed: adding `training_data_capture_enabled` boolean to `site_settings`. The per-user consent lives in the `user_preferences` JSONB column and needs no migration.

### Existing Patterns Cover Everything
- Form UI: `SuggestionForm` pattern
- List UI: `SuggestionList` pattern
- Server actions: `submitSuggestion` pattern
- DB services: `createSuggestion` / `getSuggestionsForSkill` pattern
- Tabs: `SkillDetailTabs` extension pattern
- Settings: `AdminSettingsForm` toggle pattern
- Sanitization: `sanitizePayload` already exists and tested
- Usage capture: Track route fire-and-forget pattern (like token measurements)

### Training Example Count Display
TRAIN-05 requires displaying the count on the skill detail page. The count should be fetched in the page's Promise.all and passed as a prop. Similar to how `pendingSuggestionCount` is shown on the Suggestions tab label, `trainingExampleCount` should appear on the Training tab label.

### Note: No `training_example_count` Column on Skills Table
The architecture research mentioned a denormalized `training_example_count` on the `skills` table, but it was never added. For now, query the count directly from `skill_feedback`. If performance becomes an issue later, add a denormalized column (same pattern as `totalFeedback`).

## Open Questions

1. **Should captured training examples require author approval?**
   - What we know: Golden examples are auto-approved (author creates them). Captured usage examples have `status='pending'`.
   - What's unclear: Should authors review/approve captured examples before they count?
   - Recommendation: Default captured examples to `status='pending'` and let the author approve/dismiss them (reuse suggestion status workflow). This provides quality control.

2. **Should the training tab be visible to non-authors?**
   - What we know: Suggestions tab is visible to all signed-in users.
   - What's unclear: Training examples may contain sensitive business context.
   - Recommendation: Show the training tab only to the skill author and admins. Non-authors only see the count in the stat card.

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/skill-feedback.ts` -- confirmed columns: exampleInput, exampleOutput, expectedOutput, qualityScore
- `packages/db/src/migrations/0030_create_skill_feedback.sql` -- confirmed columns exist in DB
- `packages/db/src/schema/site-settings.ts` -- confirmed existing boolean toggle pattern
- `packages/db/src/schema/user-preferences.ts` -- confirmed JSONB preferences pattern
- `apps/web/app/actions/skill-feedback.ts` -- confirmed server action pattern with sanitization
- `packages/db/src/services/skill-feedback.ts` -- confirmed DB service CRUD pattern
- `apps/web/components/skill-detail-tabs.tsx` -- confirmed tab extension pattern
- `apps/web/components/suggestion-form.tsx` -- confirmed form component pattern
- `apps/web/lib/sanitize-payload.ts` -- confirmed sanitizePayload() and sanitizeObject() API
- `apps/web/app/api/track/route.ts` -- confirmed usage event flow with fire-and-forget pattern

### Secondary (MEDIUM confidence)
- `apps/web/components/admin-settings-form.tsx` -- admin settings toggle UI pattern
- `apps/web/app/actions/admin-settings.ts` -- admin settings server action pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- follows exact patterns from Phase 57 suggestions feature
- Pitfalls: HIGH -- based on direct code reading of existing patterns and known gotchas
- Schema readiness: HIGH -- verified columns exist in both Drizzle schema AND SQL migration

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable internal codebase, no external dependency changes)
