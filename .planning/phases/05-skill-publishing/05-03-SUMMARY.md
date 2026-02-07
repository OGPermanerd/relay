---
phase: 05-skill-publishing
plan: 03
subsystem: storage
tags: [r2, s3, versioning, content-hash, web-crypto]

# Dependency graph
requires:
  - phase: 04-data-model-storage
    provides: skillVersions schema with R2 object storage integration
  - phase: 05-skill-publishing
    plan: 05-01
    provides: createSkill server action with skill insertion
provides:
  - R2 object storage integration for skill content
  - SHA-256 content hashing utility
  - Skill version creation with immutable content URLs
  - Graceful degradation when R2 not configured
affects: [05-04-skill-detail, 06-usage-tracking]

# Tech tracking
tech-stack:
  added: [Web Crypto API for SHA-256]
  patterns: [Presigned URLs for R2 upload, Version-first pattern for circular FK]

key-files:
  created:
    - apps/web/lib/content-hash.ts
  modified:
    - apps/web/app/actions/skills.ts
    - apps/web/package.json

key-decisions:
  - "Use Web Crypto API for SHA-256 hashing (Edge runtime compatible)"
  - "Store objectKey (not full URL) in contentUrl field"
  - "Insert skill → version → update skill pattern to avoid circular FK issues"
  - "Gracefully degrade when R2 not configured (skill still created)"
  - "Content stored in both skills.content (backward compat) and R2 (versioning)"

patterns-established:
  - "hashContent utility: SHA-256 via Web Crypto API for Node.js and Edge compatibility"
  - "R2 upload pattern: generateUploadUrl → fetch PUT → create version → update skill"
  - "Graceful degradation: Check uploadResult null, log warning, continue"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 05 Plan 03: R2 Storage Integration Summary

**Skill content uploaded to R2 with SHA-256 integrity hashing and immutable version records**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T18:27:36Z
- **Completed:** 2026-01-31T18:30:44Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- SHA-256 content hashing using Web Crypto API for Edge runtime compatibility
- R2 object storage upload via presigned URLs
- Skill version record creation with content URL and integrity hash
- Skill publishedVersionId updated to reference immutable version
- Graceful degradation when R2 not configured

## Task Commits

Each task was committed atomically:

1. **Task 1: Create content hash utility** - `abf0cb3` (feat)
2. **Task 2: Enhance createSkill with R2 upload and versioning** - `9a14dab` (feat)

## Files Created/Modified
- `apps/web/lib/content-hash.ts` - SHA-256 hash generation using Web Crypto API
- `apps/web/app/actions/skills.ts` - Enhanced with R2 upload, version creation, and skill update
- `apps/web/package.json` - Added @everyskill/storage dependency

## Decisions Made
- Use Web Crypto API for SHA-256 hashing instead of Node.js crypto module to ensure Edge runtime compatibility
- Store R2 object key (not full URL) in skillVersions.contentUrl to match existing storage package pattern
- Insert skill first, then version, then update skill.publishedVersionId to avoid circular foreign key constraint
- Keep content in both skills.content (for MCP backward compatibility) and R2 (for versioning)
- Return null from generateUploadUrl when R2 not configured, allowing graceful degradation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @everyskill/storage dependency to web package**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Import of @everyskill/storage failed - package not in dependencies
- **Fix:** Added "@everyskill/storage": "workspace:*" to apps/web/package.json dependencies
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compilation passes, Next.js build succeeds
- **Committed in:** 9a14dab (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential dependency addition to enable R2 integration. No scope creep.

## Issues Encountered
None - plan executed smoothly after adding missing dependency.

## User Setup Required

**R2 object storage requires manual configuration.** To enable storage features:

### Environment Variables
Add to `.env.local`:
```
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=everyskill-skills
```

### Cloudflare R2 Setup
1. Create R2 bucket in Cloudflare dashboard
2. Generate API token with R2 write permissions
3. Copy credentials to environment variables

### Verification
Without R2 configured: Skills are created successfully, version records skipped (graceful degradation).
With R2 configured: Skills uploaded to R2, version records created with content URLs.

## Next Phase Readiness
- Skill content persistence complete with versioning support
- Ready for skill detail page (05-04) to display published content
- Version records enable future wiki-style history browsing
- R2 content URLs ready for usage tracking and analytics

---
*Phase: 05-skill-publishing*
*Completed: 2026-01-31*
