---
phase: 11-e2e-test-coverage
plan: 02
subsystem: e2e-testing
tags: [playwright, e2e, testing, skill-upload, skill-rating]

dependency-graph:
  requires: [11-01]
  provides: [skill-upload-e2e-test, skill-rating-e2e-test]
  affects: []

tech-stack:
  added: [dotenv]
  patterns: [e2e-form-testing, playwright-fixtures]

key-files:
  created:
    - apps/web/tests/e2e/skill-upload.spec.ts
    - apps/web/tests/e2e/skill-rating.spec.ts
  modified:
    - apps/web/app/actions/skills.ts
    - apps/web/playwright.config.ts
    - apps/web/package.json

decisions:
  - id: use-timestamp-for-unique-skills
    choice: Use Date.now() for unique skill names
    rationale: Avoids slug conflicts between test runs
  - id: different-author-for-rating
    choice: Create skills from different author for rating tests
    rationale: Users rating their own skills may have different UI behavior

metrics:
  duration: 9 min
  completed: 2026-01-31
---

# Phase 11 Plan 02: Skill Upload and Rating E2E Tests Summary

**One-liner:** E2E tests for authenticated skill upload (with validation) and rating flows using Playwright

## What Was Built

### Skill Upload E2E Test (apps/web/tests/e2e/skill-upload.spec.ts)
- Tests successful skill upload with all metadata fields (name, description, category, tags, usage instructions, hours saved, content)
- Tests form validation for required fields
- Uses unique skill names per test run to avoid slug conflicts
- Verifies redirect to skill detail page after successful creation

### Skill Rating E2E Test (apps/web/tests/e2e/skill-rating.spec.ts)
- Creates a test skill from a different author (to ensure rating form is shown)
- Tests rating form visibility with all fields (star rating, comment, hours saved)
- Tests successful rating submission with success message verification
- Handles both "Rate This Skill" (new) and "Update Your Rating" (existing) states

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed redirect() error in skills action**
- **Found during:** Task 1 verification
- **Issue:** The createSkill action wrapped redirect() in try/catch, causing Next.js redirect error to be caught and treated as failure
- **Fix:** Moved try/catch to only wrap database insert, allowing redirect() to throw normally
- **Files modified:** apps/web/app/actions/skills.ts
- **Commit:** 4656ff2

**2. [Rule 3 - Blocking] Added dotenv for Playwright env loading**
- **Found during:** Task 1 verification
- **Issue:** Playwright wasn't loading .env.local, causing AUTH_SECRET not found error
- **Fix:** Added dotenv package and configured playwright.config.ts to load .env.local
- **Files modified:** apps/web/playwright.config.ts, apps/web/package.json, pnpm-lock.yaml
- **Commit:** 4656ff2

**3. [Rule 1 - Bug] Fixed rating test to use different author**
- **Found during:** Task 2 verification (full test suite run)
- **Issue:** Rating tests used skills authored by test user, which may show different UI
- **Fix:** Create skills from a different author (OTHER_AUTHOR_ID) for rating tests
- **Files modified:** apps/web/tests/e2e/skill-rating.spec.ts
- **Commit:** 7920557

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 4656ff2 | feat | Add E2E test for skill upload flow |
| 30a4430 | feat | Add E2E test for skill rating flow |
| 7920557 | fix | Fix skill rating test to use different author |

## Verification Results

```
Running 5 tests using 2 workers
  5 passed (7.0s)
```

All skill-upload and skill-rating tests pass consistently.

## Test Coverage Added

| Test File | Test Cases | Lines |
|-----------|------------|-------|
| skill-upload.spec.ts | 2 | 53 |
| skill-rating.spec.ts | 2 | 105 |

## Known Issues

Pre-existing home.spec.ts tests fail because they test unauthenticated behavior but run with authenticated storage state. This is outside the scope of this plan.

## Next Phase Readiness

- Skill upload and rating E2E tests provide coverage for core contribution flows
- Tests use proper test isolation with unique skill names
- Ready for 11-04 to add remaining E2E tests
