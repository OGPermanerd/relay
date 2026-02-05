---
phase: 21
plan: 6
subsystem: testing
tags: [playwright, e2e, home-tabs, install-callback, testing]
dependency-graph:
  requires: [21-02, 21-05]
  provides: [e2e-coverage-home-tabs, e2e-coverage-install-callback]
  affects: []
tech-stack:
  added: []
  patterns: [page-evaluate-raw-fetch, heading-role-selectors, api-request-context]
key-files:
  created:
    - apps/web/tests/e2e/install-callback.spec.ts
  modified:
    - apps/web/tests/e2e/home.spec.ts
decisions:
  - Used getByRole('heading') to disambiguate heading text from StatCard labels
  - Used page.evaluate with raw fetch for invalid JSON body test (Playwright request API serializes data as JSON)
metrics:
  duration: ~5 min
  completed: 2026-02-05
---

# Phase 21 Plan 06: Playwright E2E Tests for Home Tabs and Install Callback Summary

E2E test coverage for tabbed home page (browse/leverage) and install-callback API endpoint using Playwright.

## What Was Done

### Task 1: Write and run Playwright E2E tests

**Home page tab tests (6 new tests in `home.spec.ts`):**
- Verify Browse Skills tab is active by default and shows Trending Skills
- Verify clicking My Leverage tab switches content and updates URL to `?view=leverage`
- Verify direct navigation to `/?view=leverage` loads leverage content
- Verify Skills Used and Skills Created headings visible on leverage tab
- Verify stat cards render on leverage tab (FTE Hours Saved, Total Actions, Most Used, Skills Published, etc.)
- Verify switching back to Browse Skills hides leverage content and shows browse content

**Install callback API tests (4 new tests in `install-callback.spec.ts`):**
- Valid POST with platform and os returns 200 with `{ ok: true }`
- Invalid JSON body returns 400 with `{ error: "Invalid JSON body" }`
- Anonymous POST (no API key) returns 200
- POST with all optional fields (including invalid key) returns 200

### Test Results

All 14 tests pass (3 existing auth flow + 6 home tabs + 4 install callback + 1 setup).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Strict mode violation with "Skills Used" text selector**
- **Found during:** Task 1 (first test run)
- **Issue:** `getByText("Skills Used")` resolved to 2 elements -- both the `<h2>` heading and a StatCard `<p>` label
- **Fix:** Changed to `getByRole("heading", { name: "Skills Used" })` for heading checks; used unique stat card labels (FTE Hours Saved, Most Used) instead
- **Files modified:** `apps/web/tests/e2e/home.spec.ts`

**2. [Rule 1 - Bug] Playwright request API serializes string data as JSON**
- **Found during:** Task 1 (first test run)
- **Issue:** `request.fetch` with `data: "not valid json"` was being serialized as a valid JSON string, so the server returned 200 instead of 400
- **Fix:** Used `page.evaluate` with native `fetch()` to send raw invalid JSON body directly
- **Files modified:** `apps/web/tests/e2e/install-callback.spec.ts`

## Commits

| Hash | Message |
|------|---------|
| bfedf67 | feat(21-06): add Playwright E2E tests for home tabs and install callback |

## Next Phase Readiness

Phase 21 (Employee Usage Tracking) is now complete with all 6 plans executed:
- 21-01: MCP auth + userId resolution
- 21-02: Install callback endpoint
- 21-03: Install script callbacks
- 21-04: Leverage aggregation queries
- 21-05: My Leverage tab UI
- 21-06: E2E test coverage

No blockers for subsequent phases.
