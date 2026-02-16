---
status: testing
phase: 69-extended-visibility
source: [69-01-SUMMARY.md, 69-02-SUMMARY.md, 69-03-SUMMARY.md]
started: 2026-02-16T20:30:00Z
updated: 2026-02-16T20:30:00Z
---

## Current Test

number: complete
name: All tests finished — gap fixed
awaiting: none

## Tests

### 1. Upload form shows 4 visibility options
expected: Navigate to /skills/new. The form shows visibility radio buttons: Company, Personal, Private. If admin, also Global. Default is Company.
result: pass

### 2. Skill creation persists visibility
expected: Create a skill with "Personal" visibility selected. After creation, navigate to the skill detail page. The skill should show a "Personal" or "Portable" visibility badge.
result: issue
reported: "Fail, I don't see that badge on the detail page"
severity: major

### 3. Visibility badge colors in portfolio
expected: Navigate to /portfolio. Skills should show visibility badges with distinct colors: Company skills = blue, Personal/Portable = green, Private = gray. If any global_approved skills exist, they show purple.
result: pass
note: User sees Company (blue) and Portable (green). Private/Global not tested due to no test data with those levels.

### 4. Admin gate on Global visibility
expected: As a non-admin user, the "Global" visibility option should not appear in the upload form. If somehow submitted with global_approved, the server action should reject it with an error message.
result: pass

### 5. Trending includes only org-visible skills
expected: Navigate to the homepage or discovery page with trending skills. Only Company and Global Approved skills should appear in trending. Personal and Private skills should not appear in any trending/leaderboard sections.
result: pass

### 6. Search results respect visibility
expected: Search for skills. Results should show Company skills and Global Approved skills. Your own Personal skills should appear. Other users' Personal or Private skills should NOT appear.
result: pass

### 7. Resume visibility badge
expected: Navigate to /portfolio/resume. Skills listed should show the same visibility badge styling (blue for Company, green for Portable, gray for Private, purple for Global).
result: pass
note: Corrected URL from /resume to /portfolio/resume.

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Skill detail page shows visibility badge for the skill's current visibility level"
  status: fixed
  reason: "User reported: Fail, I don't see that badge on the detail page"
  severity: major
  test: 2
  root_cause: "SkillDetail component had no VisibilityBadge — visibility field missing from interface and no badge rendered"
  fix: "Added VisibilityBadge to skill-detail.tsx with visibility field on SkillWithAuthor interface"
  artifacts: [apps/web/components/skill-detail.tsx]
