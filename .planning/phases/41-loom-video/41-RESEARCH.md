# Phase 41: Loom Video Integration - Research

**Researched:** 2026-02-13
**Domain:** Loom oEmbed integration, schema migration, Next.js form/embed patterns
**Confidence:** HIGH

## Summary

The Loom Video Integration adds a `loom_url` column to the `skills` table, validates Loom URLs on input, fetches video metadata (title, thumbnail, duration) via Loom's oEmbed API at `https://www.loom.com/v1/oembed`, and renders embedded video players on the skill detail page. The codebase already has a well-established migration pattern (20 prior migrations), a Zod-validated server action for skill creation, and a clear component hierarchy (SkillDetail for detail page, SkillsTable/SkillsTableRow for browse, TrendingSection for homepage).

There is **no edit-skill page** currently. Skills are created via `SkillUploadForm` + `checkAndCreateSkill` server action. The Loom URL field should be added to the creation form only. If future editing is needed, that is out of scope for this phase.

**Primary recommendation:** Add a nullable `loom_url TEXT` column to `skills`, validate with a Loom-specific regex in the Zod schema, fetch oEmbed metadata server-side on the detail page, and render the Loom embed iframe directly (no JavaScript SDK needed).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | Schema + migrations | Already in use project-wide |
| zod | (current) | Form validation | Already used in skills action |
| Next.js | 16.1.6 | Server actions, server components | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | Loom embed | Plain iframe, no SDK required |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain iframe | @loomhq/loom-embed SDK | SDK adds 30KB+ bundle, only needed for advanced features (record button, SDK events). Plain iframe is sufficient for playback-only. |
| Server-side oEmbed fetch | Client-side oEmbed fetch | Server-side is better for SEO, faster paint, and caching. No CORS issues since oEmbed is public. |

## Architecture Patterns

### Files to Modify

```
packages/db/src/schema/skills.ts              # Add loom_url column
packages/db/src/migrations/0020_add_loom_url.sql  # Migration
apps/web/app/actions/skills.ts                # Zod schema + insert loom_url
apps/web/components/skill-upload-form.tsx      # Loom URL input field
apps/web/app/(protected)/skills/[slug]/page.tsx  # Fetch oEmbed, pass to component
apps/web/components/skill-detail.tsx           # Render embedded video
apps/web/components/skills-table-row.tsx       # Video thumbnail indicator (optional)
apps/web/components/trending-section.tsx       # Video thumbnail indicator (optional)
apps/web/lib/loom.ts                          # NEW: URL validation + oEmbed fetcher
```

### Pattern 1: Schema Column Addition
**What:** Add nullable text column with no default.
**When to use:** Optional metadata field.
**Example:**
```typescript
// In packages/db/src/schema/skills.ts
loomUrl: text("loom_url"), // Nullable - most skills won't have a video
```

### Pattern 2: Migration Pattern (from 0019_add_skill_visibility.sql)
**What:** Simple ALTER TABLE with optional index.
**Example:**
```sql
-- 0020_add_loom_url.sql
ALTER TABLE skills ADD COLUMN IF NOT EXISTS loom_url TEXT;
```
No index needed -- loom_url is not queried/filtered, only read on individual skill pages.

### Pattern 3: Loom oEmbed Server-Side Fetch
**What:** Fetch video metadata from Loom's public oEmbed endpoint on the skill detail page.
**When to use:** When rendering a skill that has a loom_url.
**Example:**
```typescript
// apps/web/lib/loom.ts

// Loom URL regex: matches share URLs and direct URLs
// Supported by oEmbed provider: https://loom.com/share/* and https://loom.com/i/*
const LOOM_URL_REGEX = /^https?:\/\/(www\.)?loom\.com\/(share|i)\/[a-f0-9]{32}(\?.*)?$/;

export function isValidLoomUrl(url: string): boolean {
  return LOOM_URL_REGEX.test(url);
}

export interface LoomOEmbedResponse {
  type: "video";
  html: string;           // iframe embed HTML
  title: string;
  height: number | null;
  width: number | null;
  provider_name: "Loom";
  provider_url: string;
  thumbnail_url: string;
  thumbnail_height: number;
  thumbnail_width: number;
  duration: number;        // seconds
}

export async function fetchLoomOEmbed(loomUrl: string): Promise<LoomOEmbedResponse | null> {
  try {
    const endpoint = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(loomUrl)}`;
    const res = await fetch(endpoint, { next: { revalidate: 3600 } }); // Cache 1 hour
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
```

### Pattern 4: Loom Embed Rendering (no SDK)
**What:** Render a responsive iframe using the oEmbed html or directly construct the embed URL.
**Example:**
```tsx
// Direct iframe approach (more control than dangerouslySetInnerHTML with oEmbed html)
function LoomEmbed({ videoId, title }: { videoId: string; title?: string }) {
  return (
    <div className="relative w-full" style={{ paddingBottom: "62.5%" }}>
      <iframe
        src={`https://www.loom.com/embed/${videoId}`}
        title={title || "Loom video"}
        className="absolute inset-0 h-full w-full rounded-lg"
        frameBorder="0"
        allowFullScreen
        allow="encrypted-media *;"
      />
    </div>
  );
}
```

### Pattern 5: Extracting Video ID from Loom URL
**What:** Parse the 32-char hex video ID from share/i URLs.
**Example:**
```typescript
export function extractLoomVideoId(url: string): string | null {
  const match = url.match(/loom\.com\/(share|i)\/([a-f0-9]{32})/);
  return match ? match[2] : null;
}
```

### Anti-Patterns to Avoid
- **Using dangerouslySetInnerHTML with oEmbed html:** The oEmbed response contains raw HTML. While it works, constructing the iframe ourselves is safer and gives us styling control.
- **Client-side oEmbed fetch:** Adds unnecessary latency and a loading spinner. Server component can fetch and cache it.
- **Installing @loomhq/loom-embed SDK:** Overkill for playback-only. The SDK is for recording features and advanced embed controls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL validation | Custom URL parser | Regex + Zod refinement | Loom URLs have a fixed, simple pattern |
| Video metadata | Manual scraping | Loom oEmbed API | Standard protocol, returns title/thumbnail/duration |
| Responsive embed | Custom aspect ratio JS | CSS padding-bottom trick | 62.5% padding-bottom = 16:10 aspect ratio, standard pattern |

## Common Pitfalls

### Pitfall 1: Private/Deleted Loom Videos
**What goes wrong:** oEmbed returns 400/404 for private or deleted videos.
**Why it happens:** Author shares URL but later deletes/restricts the video.
**How to avoid:** Always handle null from `fetchLoomOEmbed()` gracefully. Show a placeholder instead of breaking the page.
**Warning signs:** Empty embed area, console errors on skill detail page.

### Pitfall 2: Loom URL Variants
**What goes wrong:** Users paste embed URLs (`/embed/...`) instead of share URLs (`/share/...`).
**Why it happens:** Loom has multiple URL formats.
**How to avoid:** Accept both `/share/` and `/embed/` URLs in the regex. Normalize to share URL for oEmbed, extract video ID for direct embed rendering.
**Updated regex:** `/^https?:\/\/(www\.)?loom\.com\/(share|embed|i)\/[a-f0-9]{32}(\?.*)?$/`

### Pitfall 3: oEmbed Endpoint Latency on Detail Page
**What goes wrong:** Skill detail page becomes slow due to oEmbed fetch.
**Why it happens:** External API call on every page load.
**How to avoid:** Use Next.js `fetch` with `{ next: { revalidate: 3600 } }` to cache for 1 hour. oEmbed data rarely changes.

### Pitfall 4: Loom Videos with Session ID Parameters
**What goes wrong:** URLs contain `?sid=...` query params that make validation fail.
**Why it happens:** Loom appends session IDs to shared URLs.
**How to avoid:** Allow optional query string parameters in the regex (`(\?.*)?$`).

### Pitfall 5: Thumbnail on Browse Cards Adding N+1 Queries
**What goes wrong:** Fetching oEmbed for every skill card on the browse page.
**Why it happens:** Trying to show thumbnails requires per-skill API calls.
**How to avoid:** Do NOT fetch oEmbed on browse pages. Instead, show a simple video icon indicator (a play button badge) on cards that have a `loom_url`. The actual thumbnail/embed is only fetched on the detail page. Alternatively, store `loom_thumbnail_url` in the DB during creation (see below).

## Code Examples

### Zod Schema Extension
```typescript
// In createSkillSchema (apps/web/app/actions/skills.ts)
loomUrl: z
  .string()
  .url("Must be a valid URL")
  .regex(
    /^https?:\/\/(www\.)?loom\.com\/(share|embed|i)\/[a-f0-9]{32}(\?.*)?$/,
    "Must be a Loom video URL (e.g. https://www.loom.com/share/...)"
  )
  .optional()
  .or(z.literal("")),
```

### Form Field
```tsx
{/* Loom Video URL (optional) */}
<div>
  <label htmlFor="loomUrl" className="block text-sm font-medium text-gray-700">
    Demo Video (Loom)
  </label>
  <input
    type="url"
    id="loomUrl"
    name="loomUrl"
    disabled={isPending}
    value={fields.loomUrl}
    onChange={(e) => setField("loomUrl", e.target.value)}
    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
    placeholder="https://www.loom.com/share/..."
  />
  <p className="mt-1 text-sm text-gray-500">
    Optional: Add a Loom video demo of this skill
  </p>
</div>
```

### Skill Detail Page oEmbed Integration
```typescript
// In apps/web/app/(protected)/skills/[slug]/page.tsx
// Add to the parallel Promise.all block:
const loomData = skill.loomUrl
  ? fetchLoomOEmbed(skill.loomUrl)
  : Promise.resolve(null);

// Then pass to SkillDetail:
<SkillDetail
  skill={skill}
  loomEmbed={await loomData}
  // ... other props
/>
```

### Thumbnail Indicator on Browse Table
```tsx
{/* In skills-table-row.tsx, next to skill name */}
{skill.loomUrl && (
  <span className="ml-2 inline-flex items-center text-blue-500" title="Has demo video">
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>
  </span>
)}
```

## Loom oEmbed API Reference

**Endpoint:** `https://www.loom.com/v1/oembed?url={loom_url}`
**Method:** GET
**Auth:** None required (public endpoint)
**Rate Limits:** Not officially documented; appears generous for server-side use

**Supported URL schemes** (from oembed.com providers registry):
- `https://loom.com/share/*`
- `https://loom.com/i/*`

**Response fields (OEmbedInterface):**
| Field | Type | Description |
|-------|------|-------------|
| type | `"video"` | Always "video" |
| html | string | Full iframe embed HTML |
| title | string | Video title |
| height | number/null | Video height in pixels |
| width | number/null | Video width in pixels |
| provider_name | `"Loom"` | Always "Loom" |
| provider_url | string | Loom website URL |
| thumbnail_url | string | Video thumbnail image URL |
| thumbnail_height | number | Thumbnail height |
| thumbnail_width | number | Thumbnail width |
| duration | number | Video duration in seconds |

**Embed iframe format:**
```html
<iframe
  src="https://www.loom.com/embed/{video_id}"
  allowfullscreen
  allow="encrypted-media *;"
/>
```

**Aspect ratio:** 16:10 (padding-bottom: 62.5%)

## Schema Change

**Column:** `loom_url TEXT` (nullable, no default)
**Table:** `skills`
**Migration:** `0020_add_loom_url.sql`

```sql
ALTER TABLE skills ADD COLUMN IF NOT EXISTS loom_url TEXT;
```

No index needed. This column is only read when displaying a single skill, never queried or filtered.

**Drizzle schema addition:**
```typescript
loomUrl: text("loom_url"), // Optional Loom video demo URL
```

Place after the `visibility` field, before `publishedVersionId`.

## Data Flow

```
1. Author creates skill
   - Enters Loom share URL in form field (optional)
   - Zod validates URL format matches Loom pattern
   - loom_url saved to skills table

2. Viewer opens skill detail page
   - Server component reads skill.loomUrl
   - If present: fetches oEmbed metadata (cached 1hr via Next.js fetch)
   - Extracts video ID, renders iframe embed
   - oEmbed title/duration shown as metadata

3. Browse page (skills table)
   - loom_url included in query results (already part of skills.*)
   - Shows play icon indicator on rows with loom_url
   - Does NOT fetch oEmbed on browse page (no N+1)

4. Trending section / homepage
   - Same as browse: indicator only, no oEmbed fetch
```

## Plan Structure Recommendation

**Two plans recommended:**

### Plan 1: Schema + Backend (LOOM-01, LOOM-03)
- Add `loom_url` column to schema
- Create migration `0020_add_loom_url.sql`
- Run migration
- Create `apps/web/lib/loom.ts` (validation, oEmbed fetcher, video ID extractor)
- Update Zod schema in `apps/web/app/actions/skills.ts`
- Add `loomUrl` to insert values in `checkAndCreateSkill`
- Add `loomUrl` field to `skill-upload-form.tsx`
- **Files:** `packages/db/src/schema/skills.ts`, `packages/db/src/migrations/0020_add_loom_url.sql`, `apps/web/lib/loom.ts`, `apps/web/app/actions/skills.ts`, `apps/web/components/skill-upload-form.tsx`

### Plan 2: Frontend Display (LOOM-02, LOOM-04)
- Create `LoomEmbed` component
- Integrate oEmbed fetch into skill detail page
- Render video embed in `SkillDetail` component (above "Skill Content" section)
- Add play icon indicator to `SkillsTableRow` and `TrendingSection`
- Update `SearchSkillResult` and `SkillTableRow` interfaces to include `loomUrl`
- **Files:** `apps/web/components/loom-embed.tsx` (NEW), `apps/web/app/(protected)/skills/[slug]/page.tsx`, `apps/web/components/skill-detail.tsx`, `apps/web/components/skills-table-row.tsx`, `apps/web/components/trending-section.tsx`, `apps/web/lib/search-skills.ts`

Plans can run sequentially (Plan 2 depends on Plan 1 for schema).

## Open Questions

1. **Should we store oEmbed metadata (thumbnail, title, duration) in the DB?**
   - What we know: Fetching oEmbed per-request works fine for detail pages with caching.
   - What's unclear: If we want thumbnails on browse cards, we'd need stored metadata or N+1 API calls.
   - Recommendation: For now, just store `loom_url`. Use play icon indicator on browse. If thumbnails on cards become a requirement, add `loom_thumbnail_url` column later.

2. **Should embed URLs be accepted?**
   - What we know: Users might copy `/embed/` URLs from existing embeds.
   - Recommendation: Accept `/share/`, `/embed/`, and `/i/` URL patterns. Extract video ID from any of them.

## Sources

### Primary (HIGH confidence)
- oembed.com providers.json - Loom entry with endpoint URL and URL schemes
- Loom Developer Docs (dev.loom.com/docs/embed-sdk/api) - OEmbedInterface fields
- Codebase: `packages/db/src/schema/skills.ts` - current schema
- Codebase: `packages/db/src/migrations/0019_add_skill_visibility.sql` - migration pattern
- Codebase: `apps/web/app/actions/skills.ts` - Zod schema and creation flow

### Secondary (MEDIUM confidence)
- Atlassian/Loom support docs - embed URL format, query parameters
- iframely.com/domains/loom - iframe embed code structure, 62.5% aspect ratio

### Tertiary (LOW confidence)
- Loom oEmbed response field types for `duration` (documented in SDK docs as `number`, not independently verified with a real API call since test with fake video ID returned 400)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed, using existing Drizzle/Zod/Next.js patterns
- Architecture: HIGH - Clear codebase patterns for schema changes, form fields, detail page additions
- Pitfalls: HIGH - Well-understood oEmbed protocol, common iframe embedding patterns
- oEmbed response format: MEDIUM - Documented in Loom SDK docs, not independently verified with real API call

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable - oEmbed is a mature standard, Loom API unlikely to change)
