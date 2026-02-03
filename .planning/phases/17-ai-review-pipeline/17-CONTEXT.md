# Phase 17: AI Review Pipeline - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can trigger on-demand AI-powered quality reviews for skills. Reviews display structured feedback with category scores and improvement suggestions. Results are persisted and visible on subsequent visits. Reviews are advisory only — they do not block publishing or affect quality tiers.

</domain>

<decisions>
## Implementation Decisions

### Review feedback display
- Multiple category scores, not a single overall score
- Six categories: Functionality, Quality, Security, Clarity, Completeness, Reusability
- Each category scored on a 1-10 numeric scale
- Each category includes 1-2 bullet suggestions alongside the score

### Review trigger & flow
- Button lives in a dedicated "AI Review" tab on the skill detail page
- Inline loading spinner while review processes (button changes to spinner, user stays on page)
- Only skill author and admins can trigger a review
- Re-review available only after skill content has been edited (not anytime)

### Persistence & visibility
- Only the latest review is stored (new review replaces previous)
- Review is public by default, author can hide it
- AI review scores are completely separate from quality tier (Gold/Silver/Bronze) — no cross-influence
- Tab label is just "AI Review" with no score indicator or badge

### Review tone & framing
- Peer review style — direct but respectful, like a colleague code review
- Labeled with "AI Review" badge to clearly distinguish from human reviews
- No disclaimer text — the badge is sufficient context
- Softened color palette for scores — blue/green spectrum only, no red

### Claude's Discretion
- Exact tab layout and switching mechanism
- AI prompt engineering for review generation
- How "author can hide" toggle is implemented (UI placement)
- How to detect "content changed" for re-review eligibility

</decisions>

<specifics>
## Specific Ideas

- Reviews should feel like getting feedback from a knowledgeable colleague, not a grade from a teacher
- The six-category breakdown gives authors actionable areas to improve rather than a vague overall score

</specifics>

<deferred>
## Deferred Ideas

- **AI as a first-class user** — AI identity that can publish, review, and use skills just like another person on the platform. Would require schema work for AI user identity, participation model, and UX for AI-generated content. Compelling direction for a future phase.

</deferred>

---

*Phase: 17-ai-review-pipeline*
*Context gathered: 2026-02-03*
