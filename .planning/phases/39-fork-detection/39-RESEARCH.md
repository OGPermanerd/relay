# Phase 39: Fork Detection - Research

**Researched:** 2026-02-08
**Domain:** MCP tool development, content hashing, fork drift detection, diff UI
**Confidence:** HIGH

## Summary

Phase 39 adds fork detection capabilities: two new MCP tools (`check_skill_status`, `update_skill`), a schema addition (`forkedAtContentHash`), fork creation improvements (version records), and web UI drift indicators with a side-by-side comparison page.

The codebase already has all foundational infrastructure: `hashContent()` utility (SHA-256 via Web Crypto API), `forkedFromId` column on skills, `skill_versions` table, `stripFrontmatter()` helper in the MCP deploy tool, the `diff` npm package (v8.0.3) installed in web app, and an existing `ReviewDiffView` component using `diffLines`. The MCP tool registration pattern is well-established across 13 existing tools using `server.registerTool()` with Zod schemas. The web app has a skill detail page at `/skills/[slug]/page.tsx` that already shows fork attribution and a forks section.

**Primary recommendation:** Build incrementally -- schema migration first, then MCP tools, then web UI. Reuse existing patterns (MCP tool structure, `ReviewDiffView` component, `hashContent`/`stripFrontmatter` helpers) rather than creating new abstractions.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | ^1.25.3 | MCP tool registration | Already used for all 13 existing tools |
| `zod` | ^3.25.0 | Input schema validation | Required by MCP SDK registerTool |
| `drizzle-orm` | ^0.42.0 | Database queries and migrations | Project ORM, already configured |
| `diff` | ^8.0.3 | Line-level diff computation | Already used in `ReviewDiffView` component |
| `crypto` (Node built-in) | N/A | SHA-256 hashing in MCP context | Already used in `create.ts` for `hashContent` |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` | Built-in | Read local skill files in MCP tools | `check_skill_status` reads `~/.claude/skills/{slug}.md` |
| `node:path` / `node:os` | Built-in | Construct file paths | Already used in `deploy.ts` and `create.ts` |

### No New Dependencies Required
This phase requires zero new npm packages. Everything is already available in the workspace.

## Architecture Patterns

### MCP Tool File Pattern
Every MCP tool follows this exact structure. New tools MUST follow it:

```
apps/mcp/src/tools/{tool-name}.ts
```

Registration pattern:
```typescript
import { z } from "zod";
import { server } from "../server.js";
import { db } from "@everyskill/db";
import { getUserId, getTenantId } from "../auth.js";

// Exported handler (for testability)
export async function handleToolName({ param }: { param: string }) {
  // 1. DB null check
  // 2. Auth/tenant resolution
  // 3. Business logic
  // 4. Return { content: [{ type: "text", text: JSON.stringify(...) }] }
}

// Tool registration
server.registerTool(
  "tool_name",
  {
    description: "...",
    inputSchema: { param: z.string().describe("...") },
  },
  async ({ param }) => handleToolName({ param })
);
```

After creating the tool file, import it in `apps/mcp/src/tools/index.ts`:
```typescript
import "./tool-name.js";
```

### Content Hash Pattern
Two separate `hashContent` implementations exist:
1. **Web app:** `apps/web/lib/content-hash.ts` -- uses Web Crypto API (works in Edge runtime)
2. **MCP app:** inline in `apps/mcp/src/tools/create.ts` -- uses `crypto.subtle` from Node.js

Both produce identical SHA-256 hex strings. The MCP tool MUST use the same algorithm (SHA-256 via `crypto.subtle.digest`) to ensure hash comparison works cross-context.

### Frontmatter Stripping Pattern
The `stripFrontmatter()` function already exists in two MCP tool files (`deploy.ts` line 68, `create.ts` line 86):
```typescript
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return match ? content.slice(match[0].length) : content;
}
```

For FORK-02, hash comparison MUST strip frontmatter before hashing to avoid false drift from tracking hook changes. The flow is:
1. Read local file content
2. `stripFrontmatter(localContent)`
3. `hashContent(strippedContent)`
4. Compare against DB stored hash (which should also be computed from stripped content)

**CRITICAL:** The current `create.ts` hashes `contentWithFrontmatter` (line 175), NOT stripped content. The DB `contentHash` on `skill_versions` is computed from content WITH frontmatter. This means `check_skill_status` must either:
- (a) Strip frontmatter from BOTH local file AND DB content before hashing, or
- (b) Compare local file hash (with frontmatter) against DB version hash (with frontmatter)

Option (a) is required by FORK-02 -- "tracking hooks should not trigger false drift." This means the `check_skill_status` tool should strip frontmatter from the local file, hash the body, AND also strip frontmatter from the DB `skills.content` field, hash it, then compare.

### Fork Creation Pattern
Current fork creation in `apps/web/app/actions/fork-skill.ts`:
```typescript
const [inserted] = await db.insert(skills).values({
  tenantId: DEFAULT_TENANT_ID,
  name: forkName,
  slug,
  description: parent.description,
  category: parent.category,
  content: parent.content,
  tags: parent.tags,
  hoursSaved: 0,
  forkedFromId: parent.id,
  authorId: session.user.id,
  status: "draft",
}).returning({ id: skills.id, slug: skills.slug });
```

Gaps to fill for FORK-04 and FORK-05:
- **FORK-04:** Does NOT store `forkedAtContentHash`. Needs to compute `hashContent(stripFrontmatter(parent.content))` and store it.
- **FORK-05:** Does NOT create a `skill_versions` record. Needs to insert one after fork creation.

### Web UI Diff Pattern
The existing `ReviewDiffView` component (`apps/web/components/review-diff-view.tsx`) provides a proven pattern for line-level diff rendering:
```typescript
import { diffLines, type Change } from "diff";

// Short-circuit if identical
if (oldContent === newContent) { return <no-diff message>; }

const changes: Change[] = diffLines(oldContent, newContent);
// Render with green (+added), red (-removed), neutral (unchanged)
```

For FORK-07, the comparison page can reuse this component directly by passing fork content and parent content.

### Recommended Project Structure for New Files

```
apps/mcp/src/tools/
  check-skill-status.ts  # FORK-01, FORK-02: check_skill_status MCP tool
  update-skill.ts        # FORK-03: update_skill MCP tool

packages/db/src/
  migrations/
    0017_add_forked_at_content_hash.sql  # FORK-04: new column
  schema/
    skills.ts            # Add forkedAtContentHash column

apps/web/
  app/actions/
    fork-skill.ts        # Update for FORK-04, FORK-05
  app/(protected)/skills/[slug]/
    compare/page.tsx     # FORK-07: comparison page
  components/
    drift-indicator.tsx  # FORK-06: drift badge for fork detail pages
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Line-level diff | Custom diff algorithm | `diffLines` from `diff` v8.0.3 | Already installed, already used in `ReviewDiffView` |
| Content hashing | Custom hash function | Existing `hashContent` pattern (SHA-256 via Web Crypto) | Two implementations already exist and produce identical output |
| Frontmatter stripping | New parser | Existing `stripFrontmatter()` regex | Proven regex used in deploy.ts and create.ts |
| Diff rendering UI | New diff component | Extend/reuse `ReviewDiffView` component | Already styled, tested, handles edge cases |
| Slug generation | Manual slug creation | Existing `generateUniqueSlug()` | Already handles collisions |
| MCP auth/tenant | Custom auth logic | Existing `getUserId()`, `getTenantId()` from `auth.ts` | Proven pattern across 13 tools |

**Key insight:** Every piece of infrastructure needed for this phase already exists. The work is wiring existing pieces together, adding a new column, and creating two new tool files.

## Common Pitfalls

### Pitfall 1: Frontmatter Hash Mismatch
**What goes wrong:** The DB stores `contentHash` computed FROM content WITH frontmatter (see `create.ts` line 175). If `check_skill_status` strips frontmatter from the local file but compares against the DB's frontmatter-inclusive hash, they will ALWAYS mismatch.
**Why it happens:** Two different hashing conventions: DB includes frontmatter, local comparison needs to exclude it.
**How to avoid:** Both sides must strip frontmatter before hashing. Hash `stripFrontmatter(localContent)` and compare against `hashContent(stripFrontmatter(dbSkill.content))`. Do NOT rely on the `skill_versions.contentHash` column for this comparison.
**Warning signs:** Every installed skill shows as "diverged" even without modifications.

### Pitfall 2: Fork Drift Detection Against Wrong Baseline
**What goes wrong:** Comparing a fork's current content against the parent's CURRENT content detects drift when the PARENT has been updated, creating false positives.
**Why it happens:** Without storing the parent's hash at fork time, you can only compare against the parent's current state.
**How to avoid:** FORK-04 adds `forkedAtContentHash`. Compute it from `stripFrontmatter(parent.content)` at fork time. Drift = `hashContent(stripFrontmatter(fork.content)) !== fork.forkedAtContentHash`. This correctly detects fork modifications regardless of parent updates.
**Warning signs:** Unmodified forks show as "diverged" after the parent skill is updated.

### Pitfall 3: MCP Tool Reads Local File That Doesn't Exist
**What goes wrong:** `check_skill_status` needs to read `~/.claude/skills/{slug}.md`, but the file may not exist if the user hasn't deployed the skill or deleted it.
**Why it happens:** Not all skills are deployed locally; users may provide a custom file path.
**How to avoid:** Accept an explicit `filePath` parameter OR `skillId` (derive path from slug). Use `fs.existsSync()` before reading. Return a clear error message if file not found, suggesting `deploy_skill` first.
**Warning signs:** Cryptic "ENOENT" errors instead of actionable messages.

### Pitfall 4: Author vs Non-Author Fork Logic in update_skill
**What goes wrong:** `update_skill` must branch: if the user is the author, push a new version; if not, create a fork. Getting this wrong either overwrites someone else's skill or creates unnecessary forks for authors.
**Why it happens:** The `authorId` check must happen against the resolved `userId` from `auth.ts`.
**How to avoid:** Fetch the skill, compare `skill.authorId === userId`. If author: create new `skill_versions` record, update `skills.content`, update `publishedVersionId`. If not author: create a new skill row with `forkedFromId`, following the pattern in `fork-skill.ts`.
**Warning signs:** Authors get forked copies of their own skills, or non-authors overwrite the original.

### Pitfall 5: Missing skill_version Record on Fork (Orphaned Forks)
**What goes wrong:** The current `forkSkill()` action does NOT create a `skill_versions` record. This means forked skills have no version history, and version-dependent features (like `publishedVersionId` queries) break.
**Why it happens:** Phase 18 implemented basic fork CRUD without version record creation.
**How to avoid:** FORK-05 requires creating a `skill_versions` record when forking. Follow the pattern in `create.ts` lines 177-188: insert version with `version: 1`, set `contentHash`, set `publishedVersionId` on the skill.
**Warning signs:** Forked skills missing from version-aware queries; `publishedVersionId` is null on forks.

### Pitfall 6: Side-by-Side Comparison Page Needs Parent Content
**What goes wrong:** The comparison page at `/skills/[slug]/compare` needs both the fork's content AND the parent's content. The parent may have been deleted (via `deleteSkill` which sets `forkedFromId = null` on children).
**Why it happens:** Parent deletion detaches forks. Comparison page must handle orphaned forks gracefully.
**How to avoid:** Check if `forkedFromId` is null. If so, show "Parent skill no longer available" instead of crashing. If parent exists, fetch both and pass to diff component.
**Warning signs:** 500 error on compare page for forks whose parent has been deleted.

### Pitfall 7: Status Filter on Skill Queries
**What goes wrong:** New MCP tools querying skills must filter by `status = 'published'` (as established across all 18 public query paths). Forgetting this filter exposes draft/pending skills.
**Why it happens:** Easy to forget the status filter when writing new queries.
**How to avoid:** Always include `eq(skills.status, "published")` or check status after fetching. Exception: `check_skill_status` should work for any skill the user owns (author check replaces status filter for own skills).
**Warning signs:** Draft skills visible through new MCP tools.

## Code Examples

### check_skill_status MCP Tool (FORK-01, FORK-02)
```typescript
// Source: Derived from existing patterns in deploy.ts, create.ts
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { server } from "../server.js";
import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema/skills";
import { eq, and } from "drizzle-orm";
import { getUserId, getTenantId } from "../auth.js";

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return match ? content.slice(match[0].length) : content;
}

async function hashContent(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

server.registerTool(
  "check_skill_status",
  {
    description: "Check if a locally installed skill has diverged from the published version.",
    inputSchema: {
      skillId: z.string().describe("Skill ID to check"),
      filePath: z.string().optional().describe("Custom file path (defaults to ~/.claude/skills/{slug}.md)"),
    },
  },
  async ({ skillId, filePath }) => {
    // 1. Fetch skill from DB
    // 2. Determine local file path (custom or default)
    // 3. Read local file, strip frontmatter, hash
    // 4. Strip frontmatter from DB content, hash
    // 5. Compare hashes
    // 6. Return status: "current" | "diverged" | "not_installed"
  }
);
```

### update_skill MCP Tool (FORK-03)
```typescript
// Source: Derived from create.ts and fork-skill.ts patterns
server.registerTool(
  "update_skill",
  {
    description: "Push local skill modifications back to EverySkill. Creates a new version if you're the author, or creates a fork if you're not.",
    inputSchema: {
      skillId: z.string().describe("Skill ID to update"),
      content: z.string().describe("Updated skill content"),
      description: z.string().optional().describe("Updated description"),
    },
  },
  async ({ skillId, content, description }) => {
    // 1. Auth check (required)
    // 2. Fetch skill from DB
    // 3. If userId === skill.authorId: create new version
    //    - Increment version number
    //    - Insert skill_versions record
    //    - Update skills.content and skills.publishedVersionId
    // 4. If userId !== skill.authorId: create fork
    //    - Generate unique slug
    //    - Insert new skill with forkedFromId
    //    - Store forkedAtContentHash
    //    - Create skill_versions record
    //    - Set status to 'draft'
    // 5. Return result with new skill/version info
  }
);
```

### Migration for forkedAtContentHash (FORK-04)
```sql
-- 0017_add_forked_at_content_hash.sql
ALTER TABLE skills ADD COLUMN forked_at_content_hash text;

-- Backfill for existing forks (optional -- compute from current parent content)
-- This is best-effort since parent may have changed since fork
```

### Schema Update (FORK-04)
```typescript
// In packages/db/src/schema/skills.ts, add to column definitions:
forkedAtContentHash: text("forked_at_content_hash"),
```

### Drift Indicator Component (FORK-06)
```typescript
// Source: Derived from ForkAttribution component pattern
interface DriftIndicatorProps {
  hasDrifted: boolean;
  parentSlug: string;
}

export function DriftIndicator({ hasDrifted, parentSlug }: DriftIndicatorProps) {
  if (!hasDrifted) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
      Diverged from parent
      <Link href={`/skills/${parentSlug}/compare`}>Compare</Link>
    </span>
  );
}
```

### Comparison Page (FORK-07)
```typescript
// apps/web/app/(protected)/skills/[slug]/compare/page.tsx
// Reuse ReviewDiffView component:
import { ReviewDiffView } from "@/components/review-diff-view";

// Fetch fork content and parent content
// Pass to ReviewDiffView with appropriate labels
<ReviewDiffView
  oldContent={stripFrontmatter(parentSkill.content)}
  newContent={stripFrontmatter(forkSkill.content)}
  oldLabel={`Parent: ${parentSkill.name}`}
  newLabel={`Fork: ${forkSkill.name}`}
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fork copies content only | Fork needs version record + content hash anchor | Phase 39 | Enables drift detection |
| Compare against parent's current content | Compare against snapshot at fork time (`forkedAtContentHash`) | Phase 39 | Eliminates false positives |
| Hash content with frontmatter | Strip frontmatter before hashing for comparison | Phase 39 | Prevents tracking hook changes from triggering false drift |

**Current state:**
- `forkedFromId` column: EXISTS (Phase 18)
- `contentHash` on `skill_versions`: EXISTS (Phase 18)
- `forkedAtContentHash` on `skills`: DOES NOT EXIST (Phase 39 adds it)
- `skill_versions` record on fork creation: DOES NOT EXIST (Phase 39 adds it)
- MCP `check_skill_status` tool: DOES NOT EXIST (Phase 39 creates it)
- MCP `update_skill` tool: DOES NOT EXIST (Phase 39 creates it)
- Drift indicator UI: DOES NOT EXIST (Phase 39 creates it)
- Compare page: DOES NOT EXIST (Phase 39 creates it)

## Implementation Ordering

Based on dependency analysis:

1. **Schema migration** (FORK-04): Add `forkedAtContentHash` column. Must be first because other code depends on it.
2. **Fork creation update** (FORK-04, FORK-05): Update `fork-skill.ts` action to store `forkedAtContentHash` and create `skill_versions` record. Also update MCP fork creation path if `update_skill` creates forks.
3. **check_skill_status MCP tool** (FORK-01, FORK-02): New tool file, register in index.
4. **update_skill MCP tool** (FORK-03): New tool file, register in index. Depends on fork creation logic from step 2.
5. **Drift indicator UI** (FORK-06): Add to skill detail page. Depends on `forkedAtContentHash` being populated (step 2).
6. **Compare page** (FORK-07): New page at `/skills/[slug]/compare`. Independent of MCP tools.

## Open Questions

1. **Backfill existing forks with `forkedAtContentHash`?**
   - What we know: Existing forks do not have a content hash anchor. Computing one now would use the parent's CURRENT content, not the content at fork time.
   - What's unclear: Whether existing forks should be backfilled (best-effort) or left null (and treated as "unknown drift status").
   - Recommendation: Leave null for existing forks. The UI should show "Drift status unknown" for forks without `forkedAtContentHash`. Only newly created forks will have accurate drift detection.

2. **Should `check_skill_status` accept a file path or skill ID?**
   - What we know: Skills are deployed to `~/.claude/skills/{slug}.md`. The MCP tool knows the skill ID but the user might have the file elsewhere.
   - Recommendation: Accept `skillId` as required, `filePath` as optional. Default to `~/.claude/skills/{slug}.md` derived from the skill's slug. This covers 95% of cases while supporting custom paths.

3. **Should `update_skill` read the file or accept content as parameter?**
   - What we know: MCP tools receive structured input. The tool cannot read an arbitrary file without knowing the path.
   - Recommendation: Accept `content` as a required string parameter. The LLM can read the file and pass the content to the tool. Also accept optional `filePath` to read from (like `check_skill_status`).

## Sources

### Primary (HIGH confidence)
- `apps/mcp/src/tools/deploy.ts` -- MCP tool pattern, `stripFrontmatter()`, `buildHookFrontmatter()`
- `apps/mcp/src/tools/create.ts` -- MCP tool pattern, `hashContent()`, version creation
- `apps/mcp/src/tools/index.ts` -- Tool registration index
- `apps/mcp/src/server.ts` -- McpServer singleton
- `apps/mcp/src/auth.ts` -- `getUserId()`, `getTenantId()` auth resolution
- `packages/db/src/schema/skills.ts` -- Skills table schema (forkedFromId exists, forkedAtContentHash does not)
- `packages/db/src/schema/skill-versions.ts` -- Skill versions table schema
- `packages/db/src/services/skill-forks.ts` -- Fork query services
- `packages/db/src/relations/index.ts` -- Drizzle relations (fork self-reference)
- `apps/web/app/actions/fork-skill.ts` -- Web fork creation action
- `apps/web/app/(protected)/skills/[slug]/page.tsx` -- Skill detail page
- `apps/web/components/review-diff-view.tsx` -- Existing diff UI component
- `apps/web/components/fork-attribution.tsx` -- Fork attribution component
- `apps/web/components/forks-section.tsx` -- Forks listing component
- `apps/web/lib/content-hash.ts` -- Web app hashContent utility
- `.planning/research/PITFALLS.md` (lines 190-208) -- Pitfall 7: parent hash at fork time
- `.planning/research/SUMMARY.md` (lines 114-118) -- Phase 6 fork detection summary

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- FORK-01 through FORK-07 requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and used in the project
- Architecture: HIGH -- Follows 13 existing MCP tool implementations and established web app patterns
- Pitfalls: HIGH -- Pitfall 7 (parent hash at fork time) was documented in original research; others derived from codebase analysis
- Schema: HIGH -- Migration pattern established across 17 existing migrations

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable -- all patterns are internal to this codebase, not external dependencies)
