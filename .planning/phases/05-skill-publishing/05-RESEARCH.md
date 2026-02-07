# Phase 5: Skill Publishing - Research

**Researched:** 2026-01-31
**Domain:** Next.js 15 forms, Server Actions, file uploads, dynamic routes
**Confidence:** HIGH

## Summary

This phase implements skill uploading and viewing functionality using Next.js 15 Server Actions with React 19's `useActionState` hook. The existing infrastructure provides a solid foundation: `@everyskill/db` has complete schemas for `skills`, `skillVersions`, `ratings`, and `usageEvents`; `@everyskill/storage` has R2 presigned URL helpers; and Zod validation schemas for all four skill formats are already implemented.

The main implementation work involves:
1. Creating a skill upload form with multi-field validation using existing Zod schemas
2. Implementing presigned URL upload flow to R2 for skill content
3. Creating dynamic skill detail pages at `/skills/[slug]` with usage statistics
4. Aggregating real usage data from the `usageEvents` table

**Primary recommendation:** Use Server Actions with `useActionState` for the upload form, generate content hashes with Web Crypto API, and leverage existing `@everyskill/storage` presigned URL helpers for R2 uploads.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^15.1.0 | App Router, Server Actions, dynamic routes | Already in project |
| React | ^19.0.0 | `useActionState` for form state | Already in project |
| Zod | ^3.25.0 | Server-side validation | Already in @everyskill/db |
| @everyskill/db | workspace | Database operations, skill schemas | Existing infrastructure |
| @everyskill/storage | workspace | R2 presigned URLs | Existing infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| slugify or custom | N/A | URL-safe slug generation | When creating new skills |
| Web Crypto API | built-in | SHA-256 content hashing | Content integrity verification |

### Already Available (No Installation Needed)
| Capability | Location | Notes |
|------------|----------|-------|
| Skill validation schemas | `@everyskill/db/src/validation/skill-formats.ts` | Discriminated union for all 4 formats |
| Presigned upload URLs | `@everyskill/storage/src/presigned-urls.ts` | `generateUploadUrl(skillId, version, contentType)` |
| Presigned download URLs | `@everyskill/storage/src/presigned-urls.ts` | `generateDownloadUrl(objectKey)` |
| Skill metrics | `@everyskill/db/src/services/skill-metrics.ts` | `incrementSkillUses`, `updateSkillRating`, `formatRating` |
| Usage tracking | `apps/mcp/src/tracking/events.ts` | `usageEvents` table with skillId |

**Installation:** No new packages required. All dependencies are already in place.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── app/
│   ├── (protected)/
│   │   ├── skills/
│   │   │   ├── new/
│   │   │   │   └── page.tsx           # Upload form page
│   │   │   └── [slug]/
│   │   │       └── page.tsx           # Skill detail page
│   │   └── page.tsx                   # Update home to link to /skills/new
│   └── actions/
│       └── skills.ts                  # Server Actions for skill CRUD
├── components/
│   ├── skill-upload-form.tsx          # Client component with useActionState
│   └── skill-detail.tsx               # Server component for skill display
└── lib/
    └── slug.ts                        # Slug generation utility
```

### Pattern 1: Server Action with useActionState
**What:** Form handling with server-side validation and client-side pending states
**When to use:** All forms in this phase
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/guides/forms
// app/actions/skills.ts
'use server'

import { z } from 'zod'
import { skillMetadataSchema } from '@everyskill/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const uploadSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  category: z.enum(['prompt', 'workflow', 'agent', 'mcp']),
  tags: z.string().optional(), // comma-separated, parsed later
  usageInstructions: z.string().max(5000).optional(),
  hoursSaved: z.coerce.number().min(0).max(1000).default(1),
  content: z.string().min(1),
})

export type UploadState = {
  success?: boolean
  errors?: Record<string, string[]>
  message?: string
}

export async function uploadSkill(
  prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const result = uploadSchema.safeParse(Object.fromEntries(formData))

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors }
  }

  // Create skill, version, upload to R2...
  revalidatePath('/skills')
  redirect(`/skills/${newSkill.slug}`)
}

// components/skill-upload-form.tsx
'use client'

import { useActionState } from 'react'
import { uploadSkill, UploadState } from '@/app/actions/skills'

const initialState: UploadState = {}

export function SkillUploadForm() {
  const [state, formAction, isPending] = useActionState(uploadSkill, initialState)

  return (
    <form action={formAction}>
      <input name="name" required disabled={isPending} />
      {state.errors?.name && <p className="text-red-500">{state.errors.name[0]}</p>}
      {/* ... more fields */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Uploading...' : 'Upload Skill'}
      </button>
    </form>
  )
}
```

### Pattern 2: Dynamic Route with Async Params (Next.js 15)
**What:** Server component page with async params handling
**When to use:** Skill detail page at `/skills/[slug]`
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes
// app/(protected)/skills/[slug]/page.tsx

import { notFound } from 'next/navigation'
import { db } from '@everyskill/db'
import { eq } from 'drizzle-orm'

interface SkillPageProps {
  params: Promise<{ slug: string }>
}

export default async function SkillPage({ params }: SkillPageProps) {
  const { slug } = await params  // Next.js 15: params is a Promise

  const skill = await db?.query.skills.findFirst({
    where: eq(skills.slug, slug),
    with: {
      author: true,
      publishedVersion: true,
    },
  })

  if (!skill) {
    notFound()
  }

  // Calculate usage stats from usageEvents
  const stats = await getSkillStats(skill.id)

  return <SkillDetail skill={skill} stats={stats} />
}
```

### Pattern 3: R2 Upload with Presigned URL
**What:** Client-side upload directly to R2 using presigned URL from server
**When to use:** Uploading skill content to object storage
**Example:**
```typescript
// Server Action to get upload URL
'use server'
import { generateUploadUrl } from '@everyskill/storage'

export async function getSkillUploadUrl(skillId: string, version: number) {
  const result = await generateUploadUrl(skillId, version, 'text/markdown')
  if (!result) {
    return { error: 'Storage not configured' }
  }
  return { uploadUrl: result.uploadUrl, objectKey: result.objectKey }
}

// Client-side upload
async function uploadToR2(content: string, uploadUrl: string) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/markdown' },
    body: content,
  })
  return response.ok
}
```

### Pattern 4: Content Hash Generation
**What:** SHA-256 hash of skill content for integrity verification
**When to use:** Before storing skill version
**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
// Works in both Node.js and browser (Edge runtime compatible)
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### Pattern 5: Slug Generation
**What:** URL-safe, unique slug from skill name
**When to use:** Creating new skills
**Example:**
```typescript
// lib/slug.ts
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, '')         // Trim leading/trailing hyphens
    .slice(0, 50)                    // Limit length
}

// For uniqueness, append short UUID suffix if slug exists
export function generateUniqueSlug(name: string, existingSlugs: string[]): string {
  let slug = generateSlug(name)
  if (existingSlugs.includes(slug)) {
    const suffix = crypto.randomUUID().slice(0, 8)
    slug = `${slug}-${suffix}`
  }
  return slug
}
```

### Pattern 6: Usage Statistics Aggregation
**What:** Aggregate real usage data from usageEvents table
**When to use:** Skill detail page statistics display
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/select
import { sql, eq, count } from 'drizzle-orm'
import { usageEvents, skills, ratings } from '@everyskill/db'

interface SkillStats {
  totalUses: number
  uniqueUsers: number
  averageRating: string | null
  totalRatings: number
  fteDaysSaved: number
}

async function getSkillStats(skillId: string): Promise<SkillStats> {
  // Get usage count (already denormalized in skills.totalUses, but verify)
  const usageResult = await db?.select({
    totalUses: sql<number>`cast(count(*) as integer)`,
    uniqueUsers: sql<number>`cast(count(distinct ${usageEvents.userId}) as integer)`,
  })
  .from(usageEvents)
  .where(eq(usageEvents.skillId, skillId))

  // Get rating stats
  const ratingResult = await db?.select({
    avgRating: sql<number>`round(avg(${ratings.rating})::numeric, 1)`,
    totalRatings: sql<number>`cast(count(*) as integer)`,
  })
  .from(ratings)
  .where(eq(ratings.skillId, skillId))

  // Get skill for hoursSaved
  const skill = await db?.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { hoursSaved: true, totalUses: true }
  })

  const totalUses = usageResult?.[0]?.totalUses ?? skill?.totalUses ?? 0
  const hoursSaved = skill?.hoursSaved ?? 1
  const fteDaysSaved = (totalUses * hoursSaved) / 8 // 8-hour workday

  return {
    totalUses,
    uniqueUsers: usageResult?.[0]?.uniqueUsers ?? 0,
    averageRating: ratingResult?.[0]?.avgRating?.toFixed(1) ?? null,
    totalRatings: ratingResult?.[0]?.totalRatings ?? 0,
    fteDaysSaved: Math.round(fteDaysSaved * 10) / 10,
  }
}
```

### Anti-Patterns to Avoid
- **Throwing errors for validation failures:** Use `safeParse` and return error objects instead. Throwing triggers Error Boundaries.
- **API routes for form handling:** Server Actions are the standard; API routes add unnecessary complexity.
- **Client-side file storage:** Always upload to R2 via presigned URLs, never store in database.
- **Synchronous params access:** In Next.js 15, params is a Promise. Always `await params`.
- **Building aggregations with relational queries:** Drizzle's `db.query.*` doesn't support aggregations. Use `db.select()` with SQL functions.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presigned URLs | Custom S3 signing | `@everyskill/storage` helpers | Already implemented, tested |
| Skill validation | Custom validators | `@everyskill/db` Zod schemas | Discriminated union handles all 4 formats |
| Rating calculations | Manual SQL | `skill-metrics.ts` service | `updateSkillRating` already exists |
| Usage tracking | Custom counters | `incrementSkillUses` | Atomic increment, race-condition safe |
| Form state | Custom state management | `useActionState` | React 19 standard, handles pending/errors |
| Slug uniqueness | Manual checking | Database unique constraint + retry | Let DB enforce, catch error and retry with suffix |

**Key insight:** The `@everyskill/db` and `@everyskill/storage` packages have most of the heavy lifting done. This phase is primarily UI work connecting existing infrastructure.

## Common Pitfalls

### Pitfall 1: Forgetting to Await Params in Next.js 15
**What goes wrong:** Runtime error or TypeScript error accessing params directly
**Why it happens:** Next.js 15 changed params to be a Promise for async data fetching
**How to avoid:** Always destructure with `const { slug } = await params`
**Warning signs:** TypeScript error about Promise<{ slug: string }> not having property 'slug'

### Pitfall 2: Using useActionState and useFormStatus in Same Component
**What goes wrong:** useFormStatus returns incorrect pending state
**Why it happens:** useFormStatus must be in a child component of the form
**How to avoid:** Extract submit button to a separate component that uses useFormStatus
**Warning signs:** Pending state not updating during form submission

### Pitfall 3: File Upload Without Progress Indication
**What goes wrong:** User thinks upload is broken during large file uploads
**Why it happens:** fetch() with PUT to presigned URL doesn't show progress
**How to avoid:** Show pending state from useActionState; for large files, use XMLHttpRequest with progress events
**Warning signs:** Users re-clicking submit button, duplicate uploads

### Pitfall 4: Not Revalidating After Mutation
**What goes wrong:** Stale data shown after skill creation
**Why it happens:** Missing `revalidatePath` or `revalidateTag` call
**How to avoid:** Call `revalidatePath('/skills')` before redirect
**Warning signs:** New skill not appearing in lists until page refresh

### Pitfall 5: Circular Reference with Version IDs
**What goes wrong:** Can't insert skill with publishedVersionId
**Why it happens:** skills and skillVersions have FK in both directions
**How to avoid:** Insert skill first (without version refs), then version, then update skill with version ID
**Warning signs:** FK constraint violation on insert

### Pitfall 6: Drizzle Count Returns String
**What goes wrong:** TypeScript types mismatch, NaN in calculations
**Why it happens:** PostgreSQL count() returns bigint, serialized as string
**How to avoid:** Cast in SQL: `sql<number>\`cast(count(*) as integer)\``
**Warning signs:** String "5" instead of number 5 in aggregation results

## Code Examples

Verified patterns from official sources:

### Complete Upload Server Action
```typescript
// Source: https://nextjs.org/docs/app/guides/forms + project patterns
// app/actions/skills.ts
'use server'

import { auth } from '@/auth'
import { db, skills, skillVersions } from '@everyskill/db'
import { generateUploadUrl } from '@everyskill/storage'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const createSkillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required').max(2000),
  category: z.enum(['prompt', 'workflow', 'agent', 'mcp']),
  tags: z.string().transform(s => s.split(',').map(t => t.trim()).filter(Boolean)),
  usageInstructions: z.string().max(5000).optional(),
  hoursSaved: z.coerce.number().min(0).max(1000).default(1),
  content: z.string().min(1, 'Content is required'),
})

export type CreateSkillState = {
  errors?: Record<string, string[]>
  message?: string
}

export async function createSkill(
  prevState: CreateSkillState,
  formData: FormData
): Promise<CreateSkillState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { message: 'You must be signed in to upload skills' }
  }

  const parsed = createSkillSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { name, description, category, tags, usageInstructions, hoursSaved, content } = parsed.data

  try {
    // Generate slug
    const slug = await generateUniqueSlug(name)

    // Generate content hash
    const contentHash = await hashContent(content)

    // Insert skill first (no version refs yet)
    const [newSkill] = await db!.insert(skills).values({
      name,
      slug,
      description,
      category,
      content, // Temporary: for backward compat with MCP
      hoursSaved,
      authorId: session.user.id,
    }).returning({ id: skills.id, slug: skills.slug })

    // Get presigned URL and upload content
    const uploadResult = await generateUploadUrl(newSkill.id, 1, 'text/markdown')
    if (uploadResult) {
      await uploadContent(content, uploadResult.uploadUrl)

      // Create version record
      const [version] = await db!.insert(skillVersions).values({
        skillId: newSkill.id,
        version: 1,
        contentUrl: uploadResult.objectKey,
        contentHash,
        contentType: 'text/markdown',
        name,
        description,
        metadata: { tags, usageInstructions },
        createdBy: session.user.id,
      }).returning({ id: skillVersions.id })

      // Update skill with published version
      await db!.update(skills)
        .set({ publishedVersionId: version.id })
        .where(eq(skills.id, newSkill.id))
    }

    revalidatePath('/skills')
    revalidatePath('/')
  } catch (error) {
    console.error('Failed to create skill:', error)
    return { message: 'Failed to create skill. Please try again.' }
  }

  redirect(`/skills/${newSkill.slug}`)
}
```

### Skill Detail Page with Stats
```typescript
// app/(protected)/skills/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { db, skills, usageEvents, ratings, formatRating } from '@everyskill/db'
import { eq, sql } from 'drizzle-orm'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function SkillDetailPage({ params }: PageProps) {
  const { slug } = await params

  if (!db) {
    return <div>Database not configured</div>
  }

  const skill = await db.query.skills.findFirst({
    where: eq(skills.slug, slug),
    with: {
      author: { columns: { id: true, name: true, image: true } },
    },
  })

  if (!skill) {
    notFound()
  }

  // Get usage statistics
  const [usageStats] = await db.select({
    totalUses: sql<number>`cast(count(*) as integer)`,
    uniqueUsers: sql<number>`cast(count(distinct ${usageEvents.userId}) as integer)`,
  })
  .from(usageEvents)
  .where(eq(usageEvents.skillId, skill.id))

  const [ratingStats] = await db.select({
    totalRatings: sql<number>`cast(count(*) as integer)`,
  })
  .from(ratings)
  .where(eq(ratings.skillId, skill.id))

  const fteDaysSaved = ((skill.totalUses || 0) * (skill.hoursSaved || 1)) / 8

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">{skill.name}</h1>
      <p className="mt-2 text-gray-600">{skill.description}</p>

      {/* Stats Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Uses" value={skill.totalUses || 0} />
        <StatCard label="Unique Users" value={usageStats?.uniqueUsers || 0} />
        <StatCard
          label="Avg Rating"
          value={formatRating(skill.averageRating) || 'N/A'}
          suffix={ratingStats?.totalRatings ? `(${ratingStats.totalRatings})` : ''}
        />
        <StatCard label="FTE Days Saved" value={fteDaysSaved.toFixed(1)} />
      </div>

      {/* Usage Instructions */}
      {/* ... */}

      {/* Skill Content */}
      {/* ... */}
    </div>
  )
}

function StatCard({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-blue-600">
        {value} {suffix && <span className="text-sm font-normal text-gray-400">{suffix}</span>}
      </p>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useFormState` (ReactDOM) | `useActionState` (React) | React 19 (Dec 2024) | Renamed, deprecated old name |
| Sync params | `await params` | Next.js 15 (Oct 2024) | Params is now Promise |
| API routes for forms | Server Actions | Next.js 13.4+ | Simpler, progressive enhancement |
| getServerSideProps | React Server Components | Next.js 13+ | Direct data fetching in components |

**Deprecated/outdated:**
- `useFormState` from 'react-dom': Renamed to `useActionState` from 'react'
- Synchronous params access: Still works but deprecated, will be removed

## Open Questions

Things that couldn't be fully resolved:

1. **Multi-step wizard vs single form?**
   - What we know: Both patterns are valid; multi-step better for complex forms
   - What's unclear: Is the upload form complex enough to warrant multi-step?
   - Recommendation: Start with single form; fields are straightforward. Can refactor if UX testing suggests otherwise.

2. **Optimistic updates for upload?**
   - What we know: `useOptimistic` can show immediate feedback
   - What's unclear: Whether upload latency justifies optimistic UI
   - Recommendation: Use `isPending` from `useActionState` initially; add optimistic updates if R2 uploads are slow.

3. **Content preview on detail page?**
   - What we know: Content stored in R2, need to fetch via presigned download URL
   - What's unclear: Should content be displayed inline or as downloadable file?
   - Recommendation: Display markdown content rendered inline for prompt/workflow types; show download link for agent/mcp types.

## Sources

### Primary (HIGH confidence)
- [Next.js Forms Guide](https://nextjs.org/docs/app/guides/forms) - Server Actions, useActionState, validation patterns
- [Next.js Dynamic Routes](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) - Async params in v15
- [React useActionState](https://react.dev/reference/react/useActionState) - Hook signature and usage
- [MDN SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) - SHA-256 in Web Crypto API

### Secondary (MEDIUM confidence)
- [Drizzle ORM Select](https://orm.drizzle.team/docs/select) - Aggregate functions, group by
- [Drizzle Count Rows Guide](https://orm.drizzle.team/docs/guides/count-rows) - Casting bigint to integer

### Tertiary (LOW confidence)
- WebSearch results for multi-step forms - Pattern suggestions only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, verified against official docs
- Architecture: HIGH - Follows established Next.js 15 patterns with async params
- Pitfalls: HIGH - Based on official documentation warnings and project prior decisions

**Research date:** 2026-01-31
**Valid until:** 2026-02-28 (stable patterns, Next.js 15 is mature)
