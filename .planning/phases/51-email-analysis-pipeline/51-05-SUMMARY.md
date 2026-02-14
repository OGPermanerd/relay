---
phase: 51-email-analysis-pipeline
plan: 05
status: complete
started: 2026-02-14
completed: 2026-02-14
commits:
  - 674944c feat(51-05): create EmailDiagnosticCard with loading state and results preview
  - 7fe9243 feat(51-05): add EmailDiagnosticCard to my-leverage page
---

## What was built

Email diagnostic card UI on /my-leverage page with "Run Diagnostic" button, loading state, and results preview.

### Files created
- `apps/web/app/(protected)/my-leverage/email-diagnostic-card.tsx` — EmailDiagnosticCard client component
- `apps/web/tests/e2e/my-leverage.spec.ts` — E2E tests for my-leverage page

### Files modified
- `apps/web/app/(protected)/my-leverage/page.tsx` — Added EmailDiagnosticCard import and render

## Key decisions
- Card uses plain div with Tailwind (not shadcn Card) to match existing page patterns
- Loading state shows animated spinner with "60-90 seconds" estimate
- Results show hero stat (hours per week), top 3 categories, and busiest time insight
- Error state includes "Try Again" button and link to connections settings for "not connected" errors
- Category names prettified inline: `cat.category.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())`

## Verification
- E2E tests pass: home (13 tests), my-leverage (2 tests)
- Page loads with EmailDiagnosticCard visible in initial state
- Run Diagnostic button is visible and enabled

## Checkpoint
Plan 05 includes human-verify checkpoint — diagnostic card is ready for visual review at http://localhost:2002/my-leverage
