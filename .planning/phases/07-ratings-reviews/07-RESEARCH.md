# Phase 7: Ratings & Reviews - Research

**Researched:** 2026-01-31
**Domain:** User ratings, reviews, aggregations, Server Actions with form handling
**Confidence:** HIGH

## Summary

This phase implements user ratings and reviews for skills, building on the existing infrastructure established in prior phases. The `ratings` table already exists (created in Phase 4) with the exact schema needed: `id`, `skillId`, `userId`, `rating`, `comment`, `hoursSavedEstimate`, `createdAt`. The `updateSkillRating` service in `@everyskill/db` already calculates and denormalizes the average rating to the skills table.

The main implementation work involves:
1. Creating a rating form component on the skill detail page
2. Implementing a Server Action for rating submission with validation
3. Displaying aggregated ratings and user-submitted time estimates
4. Calculating FTE Days Saved using user estimates when available (overriding creator estimates)

The architecture follows the established patterns from Phase 5 (skill upload): Server Actions with `useActionState` for form handling, Zod for validation, and `revalidatePath` for cache invalidation.

**Primary recommendation:** Add a rating form to the existing skill detail page, use the existing `updateSkillRating` service after rating insertion, and modify FTE Days Saved calculation to prefer user-submitted time estimates over creator estimates when available.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^15.1.0 | Server Actions, form handling | Already in project |
| React | ^19.0.0 | `useActionState` for form state | Already in project |
| Zod | ^3.25.0 | Server-side validation | Already in project |
| @everyskill/db | workspace | Database operations, ratings schema | Existing infrastructure |

### Already Available (No Installation Needed)
| Capability | Location | Notes |
|------------|----------|-------|
| Ratings table schema | `@everyskill/db/src/schema/ratings.ts` | Complete with rating, comment, hoursSavedEstimate |
| Ratings relations | `@everyskill/db/src/relations/index.ts` | skill, user relations defined |
| updateSkillRating service | `@everyskill/db/src/services/skill-metrics.ts` | Recalculates averageRating from ratings table |
| formatRating utility | `@everyskill/db/src/services/skill-metrics.ts` | Converts integer to display string |
| getSkillStats | `apps/web/lib/skill-stats.ts` | Already queries totalRatings count |
| Skill detail page | `apps/web/app/(protected)/skills/[slug]/page.tsx` | Where rating form will be added |
| Server Action pattern | `apps/web/app/actions/skills.ts` | Template for new rating action |
| Form component pattern | `apps/web/components/skill-upload-form.tsx` | Template for rating form |

**Installation:** No new packages required. All dependencies are already in place.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── app/
│   ├── (protected)/
│   │   └── skills/
│   │       └── [slug]/
│   │           └── page.tsx          # Add rating form integration
│   └── actions/
│       ├── skills.ts                 # Existing skill actions
│       └── ratings.ts                # New: Server Action for rating submission
├── components/
│   ├── skill-detail.tsx              # Update to include rating form
│   ├── rating-form.tsx               # New: Client component with useActionState
│   ├── star-rating-input.tsx         # New: Interactive 1-5 star selector
│   └── reviews-list.tsx              # New: Display existing reviews
└── lib/
    └── skill-stats.ts                # Update FTE calculation for user estimates
```

### Pattern 1: Rating Server Action
**What:** Server Action for submitting ratings with validation and duplicate prevention
**When to use:** Rating form submission
**Example:**
```typescript
// Source: Established pattern from apps/web/app/actions/skills.ts
// app/actions/ratings.ts
'use server'

import { auth } from '@/auth'
import { db, ratings, updateSkillRating } from '@everyskill/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

const ratingSchema = z.object({
  skillId: z.string().uuid('Invalid skill ID'),
  rating: z.coerce.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
  comment: z.string().max(2000, 'Comment must be 2000 characters or less').optional(),
  hoursSavedEstimate: z.coerce.number().min(0).max(1000).optional(),
})

export type RatingState = {
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

export async function submitRating(
  prevState: RatingState,
  formData: FormData
): Promise<RatingState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { message: 'You must be signed in to rate skills' }
  }

  const parsed = ratingSchema.safeParse({
    skillId: formData.get('skillId'),
    rating: formData.get('rating'),
    comment: formData.get('comment'),
    hoursSavedEstimate: formData.get('hoursSavedEstimate'),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { skillId, rating, comment, hoursSavedEstimate } = parsed.data

  if (!db) {
    return { message: 'Database not configured' }
  }

  try {
    // Check for existing rating from this user
    const existing = await db.query.ratings.findFirst({
      where: and(
        eq(ratings.skillId, skillId),
        eq(ratings.userId, session.user.id)
      ),
    })

    if (existing) {
      // Update existing rating
      await db
        .update(ratings)
        .set({
          rating,
          comment: comment ?? null,
          hoursSavedEstimate: hoursSavedEstimate ?? null,
        })
        .where(eq(ratings.id, existing.id))
    } else {
      // Insert new rating
      await db.insert(ratings).values({
        skillId,
        userId: session.user.id,
        rating,
        comment: comment ?? null,
        hoursSavedEstimate: hoursSavedEstimate ?? null,
      })
    }

    // Recalculate denormalized average
    await updateSkillRating(skillId)

    revalidatePath(`/skills`) // Revalidate skill cards
    revalidatePath(`/skills/${skillId}`) // Revalidate detail page

    return { success: true }
  } catch (error) {
    console.error('Failed to submit rating:', error)
    return { message: 'Failed to submit rating. Please try again.' }
  }
}
```

### Pattern 2: Rating Form Component
**What:** Client component with star rating input and optional fields
**When to use:** Skill detail page for logged-in users
**Example:**
```typescript
// components/rating-form.tsx
'use client'

import { useActionState } from 'react'
import { submitRating, RatingState } from '@/app/actions/ratings'
import { StarRatingInput } from './star-rating-input'

interface RatingFormProps {
  skillId: string
  skillSlug: string
  existingRating?: {
    rating: number
    comment: string | null
    hoursSavedEstimate: number | null
  }
}

const initialState: RatingState = {}

export function RatingForm({ skillId, skillSlug, existingRating }: RatingFormProps) {
  const [state, formAction, isPending] = useActionState(submitRating, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="skillId" value={skillId} />

      {state.message && (
        <div className="rounded-md bg-red-50 p-3 text-red-700">{state.message}</div>
      )}
      {state.success && (
        <div className="rounded-md bg-green-50 p-3 text-green-700">
          {existingRating ? 'Rating updated!' : 'Thank you for your rating!'}
        </div>
      )}

      {/* Star Rating Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Your Rating <span className="text-red-500">*</span>
        </label>
        <StarRatingInput
          name="rating"
          defaultValue={existingRating?.rating}
          disabled={isPending}
        />
        {state.errors?.rating && (
          <p className="mt-1 text-sm text-red-600">{state.errors.rating[0]}</p>
        )}
      </div>

      {/* Optional Comment */}
      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
          Comment (optional)
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={3}
          defaultValue={existingRating?.comment ?? ''}
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="Share your experience with this skill..."
        />
      </div>

      {/* Time Saved Estimate */}
      <div>
        <label htmlFor="hoursSavedEstimate" className="block text-sm font-medium text-gray-700">
          Hours Saved (optional)
        </label>
        <input
          type="number"
          id="hoursSavedEstimate"
          name="hoursSavedEstimate"
          min="0"
          max="1000"
          step="0.5"
          defaultValue={existingRating?.hoursSavedEstimate ?? ''}
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          placeholder="How many hours did this save you?"
        />
        <p className="mt-1 text-sm text-gray-500">
          Your estimate helps calculate accurate time savings
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        {isPending ? 'Submitting...' : existingRating ? 'Update Rating' : 'Submit Rating'}
      </button>
    </form>
  )
}
```

### Pattern 3: Star Rating Input Component
**What:** Interactive star selector using radio buttons for accessibility
**When to use:** Rating form star input
**Example:**
```typescript
// components/star-rating-input.tsx
'use client'

import { useState } from 'react'

interface StarRatingInputProps {
  name: string
  defaultValue?: number
  disabled?: boolean
}

export function StarRatingInput({ name, defaultValue, disabled }: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number>(defaultValue ?? 0)

  const displayValue = hovered ?? selected

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <label
          key={value}
          className="cursor-pointer"
          onMouseEnter={() => !disabled && setHovered(value)}
          onMouseLeave={() => setHovered(null)}
        >
          <input
            type="radio"
            name={name}
            value={value}
            checked={selected === value}
            onChange={() => setSelected(value)}
            disabled={disabled}
            className="sr-only"
            required
          />
          <svg
            className={`h-8 w-8 ${
              value <= displayValue
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-gray-300'
            } transition-colors`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        </label>
      ))}
      <span className="ml-2 text-sm text-gray-500">
        {selected > 0 ? `${selected} star${selected !== 1 ? 's' : ''}` : 'Select rating'}
      </span>
    </div>
  )
}
```

### Pattern 4: User-Override Time Estimate Calculation
**What:** Calculate FTE Days Saved preferring user estimates over creator estimates
**When to use:** Skill stats display when ratings with hoursSavedEstimate exist
**Example:**
```typescript
// Source: Requirement RATE-02 - user estimates override creator estimates
// lib/skill-stats.ts (modified getSkillStats)

// Add to getSkillStats function:
// Query average hoursSavedEstimate from ratings (when available)
const timeEstimateResult = await db
  .select({
    avgHoursSaved: sql<number>`avg(${ratings.hoursSavedEstimate})`,
    countWithEstimate: sql<number>`cast(count(${ratings.hoursSavedEstimate}) as integer)`,
  })
  .from(ratings)
  .where(eq(ratings.skillId, skillId));

// Use user estimates if at least one exists, otherwise creator estimate
const userAvgHours = timeEstimateResult?.[0]?.avgHoursSaved;
const countWithEstimate = timeEstimateResult?.[0]?.countWithEstimate ?? 0;
const effectiveHoursSaved = countWithEstimate > 0
  ? userAvgHours
  : (skill?.hoursSaved ?? 1);

const fteDaysSaved = Math.round(((totalUses * effectiveHoursSaved) / 8) * 10) / 10;

// Return additional info about estimate source
return {
  totalUses,
  uniqueUsers: usageResult?.[0]?.uniqueUsers ?? 0,
  averageRating: formatRating(skill?.averageRating ?? null),
  totalRatings: ratingResult?.[0]?.totalRatings ?? 0,
  fteDaysSaved,
  hoursSavedSource: countWithEstimate > 0 ? 'user' : 'creator',
  hoursSavedEstimate: effectiveHoursSaved,
};
```

### Pattern 5: Reviews List Component
**What:** Display existing reviews for a skill
**When to use:** Skill detail page
**Example:**
```typescript
// components/reviews-list.tsx
import Image from 'next/image'

interface Review {
  id: string
  rating: number
  comment: string | null
  hoursSavedEstimate: number | null
  createdAt: Date
  user: {
    name: string | null
    image: string | null
  }
}

interface ReviewsListProps {
  reviews: Review[]
}

export function ReviewsList({ reviews }: ReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <p className="text-gray-500">No reviews yet. Be the first to review!</p>
    )
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {review.user.image ? (
              <Image
                src={review.user.image}
                alt={review.user.name || 'Reviewer'}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
                {review.user.name?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="font-medium">{review.user.name || 'Anonymous'}</p>
              <div className="flex items-center gap-2">
                <span className="text-yellow-500">
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </span>
                <span className="text-sm text-gray-500">
                  {review.createdAt.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          {review.comment && (
            <p className="mt-2 text-gray-700">{review.comment}</p>
          )}
          {review.hoursSavedEstimate && (
            <p className="mt-1 text-sm text-gray-500">
              Estimated {review.hoursSavedEstimate} hours saved
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Multiple ratings per user per skill without update logic:** Always check for existing rating and update instead of insert
- **Throwing errors for validation failures:** Use `safeParse` and return error objects
- **Forgetting revalidatePath:** Must revalidate both skill detail and skill list pages after rating
- **Not awaiting updateSkillRating:** The denormalized average must be updated before returning

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rating average calculation | Manual SQL avg in action | `updateSkillRating` service | Already exists, handles integer*100 precision |
| Rating format display | Manual division | `formatRating` utility | Already exists, consistent formatting |
| Form state management | Custom useState | `useActionState` | React 19 standard, handles pending/errors |
| Duplicate rating prevention | Check + insert race condition | Upsert pattern with unique constraint | Database enforces uniqueness |
| Skill stats aggregation | Manual queries | `getSkillStats` in lib/skill-stats.ts | Already handles all queries |

**Key insight:** The infrastructure for ratings is already 80% complete. This phase is primarily UI work connecting existing database schema and services.

## Common Pitfalls

### Pitfall 1: Race Condition on Duplicate Rating Check
**What goes wrong:** Two concurrent submissions from same user create duplicate ratings
**Why it happens:** Check-then-insert is not atomic
**How to avoid:** Use unique constraint on (skillId, userId) and upsert pattern:
```typescript
// Add unique constraint via migration (if not exists)
CREATE UNIQUE INDEX ratings_skill_user_unique ON ratings(skill_id, user_id);

// Use onConflictDoUpdate
await db
  .insert(ratings)
  .values({ skillId, userId, rating, comment, hoursSavedEstimate })
  .onConflictDoUpdate({
    target: [ratings.skillId, ratings.userId],
    set: { rating, comment, hoursSavedEstimate },
  });
```
**Warning signs:** Users seeing "You already rated this skill" errors intermittently

### Pitfall 2: Not Handling Existing Rating in UI
**What goes wrong:** User rates skill, refreshes page, form shows empty instead of their rating
**Why it happens:** Form not pre-populated with existing rating
**How to avoid:** Query user's existing rating and pass to form as `existingRating` prop
**Warning signs:** Users confused about whether their rating was saved

### Pitfall 3: FTE Calculation Not Updating on New User Estimates
**What goes wrong:** FTE Days Saved shows stale values after ratings with time estimates
**Why it happens:** Only averageRating is denormalized, not hoursSavedEstimate average
**How to avoid:** Either:
1. Calculate on-demand in getSkillStats (recommended for now)
2. Add denormalized avgHoursSavedEstimate column updated on rating insert
**Warning signs:** FTE Days Saved shows creator estimate even when many user estimates exist

### Pitfall 4: Missing Skill Slug in revalidatePath
**What goes wrong:** Rating submitted but skill detail page still shows old data
**Why it happens:** revalidatePath called with skill ID instead of slug
**How to avoid:** Pass slug to action or query skill to get slug before revalidate
**Warning signs:** Ratings appear after manual page refresh but not immediately

### Pitfall 5: Star Rating Input Not Accessible
**What goes wrong:** Keyboard users can't select rating, screen readers can't announce selection
**Why it happens:** Using onClick on spans/divs without proper ARIA or form controls
**How to avoid:** Use hidden radio inputs with labels wrapping visual stars
**Warning signs:** Form fails accessibility audits, keyboard navigation doesn't work

## Code Examples

Verified patterns from official sources:

### Querying User's Existing Rating
```typescript
// Source: Drizzle ORM query pattern
// In skill detail page server component
const existingRating = session?.user?.id && db
  ? await db.query.ratings.findFirst({
      where: and(
        eq(ratings.skillId, skill.id),
        eq(ratings.userId, session.user.id)
      ),
      columns: {
        rating: true,
        comment: true,
        hoursSavedEstimate: true,
      },
    })
  : null;
```

### Querying Reviews with User Info
```typescript
// Source: Drizzle ORM relational queries
// In skill detail page or reviews component
const reviews = db
  ? await db.query.ratings.findMany({
      where: eq(ratings.skillId, skill.id),
      with: {
        user: {
          columns: { name: true, image: true },
        },
      },
      orderBy: desc(ratings.createdAt),
      limit: 10,
    })
  : [];
```

### Updated SkillStats Interface
```typescript
// lib/skill-stats.ts
export interface SkillStats {
  totalUses: number;
  uniqueUsers: number;
  averageRating: string | null;
  totalRatings: number;
  fteDaysSaved: number;
  hoursSavedSource: 'user' | 'creator'; // NEW: indicates estimate source
  hoursSavedEstimate: number; // NEW: the value used for calculation
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useFormState` (ReactDOM) | `useActionState` (React) | React 19 (Dec 2024) | Renamed, deprecated old name |
| Separate API route for ratings | Server Action | Next.js 13.4+ | Simpler, colocated with form |
| Click handlers on star SVGs | Hidden radio inputs with labels | Accessibility best practices | Keyboard and screen reader support |

**Deprecated/outdated:**
- `useFormState` from 'react-dom': Renamed to `useActionState` from 'react'

## Open Questions

Things that couldn't be fully resolved:

1. **Should ratings have unique constraint on (skillId, userId)?**
   - What we know: Current schema doesn't have this constraint
   - What's unclear: Whether to add via migration or handle in app layer
   - Recommendation: Add unique constraint via migration for data integrity. Use `onConflictDoUpdate` for upsert pattern.

2. **How to display FTE calculation source?**
   - What we know: Need to show whether FTE uses creator or community estimate
   - What's unclear: Best UX for communicating this
   - Recommendation: Add small indicator text under FTE stat: "Based on X community estimates" or "Creator estimate"

3. **Pagination for reviews list?**
   - What we know: Could have many reviews per skill
   - What's unclear: Whether to implement now or defer
   - Recommendation: Start with limit 10 most recent. Add "Show more" in future phase if needed.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/web/app/actions/skills.ts` - Established Server Action pattern
- Existing codebase: `apps/web/components/skill-upload-form.tsx` - Established useActionState pattern
- Existing codebase: `packages/db/src/schema/ratings.ts` - Rating table schema
- Existing codebase: `packages/db/src/services/skill-metrics.ts` - updateSkillRating service
- [React useActionState](https://react.dev/reference/react/useActionState) - Hook signature and usage
- [Next.js Forms Guide](https://nextjs.org/docs/app/guides/forms) - Server Actions pattern

### Secondary (MEDIUM confidence)
- [MDN Radio Input Accessibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio) - Accessible star rating pattern
- [Drizzle ORM Upsert](https://orm.drizzle.team/docs/insert#on-conflict-do-update) - onConflictDoUpdate pattern

### Tertiary (LOW confidence)
- WebSearch: Star rating component accessibility best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, existing patterns established
- Architecture: HIGH - Follows exact patterns from Phase 5 skill upload
- Pitfalls: HIGH - Based on existing codebase patterns and common React/Next.js issues
- User estimate override: MEDIUM - Calculation logic clear, UX presentation less defined

**Research date:** 2026-01-31
**Valid until:** 2026-02-28 (stable patterns, infrastructure already exists)
