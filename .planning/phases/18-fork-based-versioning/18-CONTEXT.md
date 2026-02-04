# Phase 18: Fork-Based Versioning - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create attributed variants (forks) of existing skills. A fork copies the parent's content into the publish form as a draft, tracks provenance ("Forked from X by Y"), and displays fork relationships on both parent and child skills. Fork comparison, upstream notifications, and "best fork" highlighting are out of scope (v1.4).

</domain>

<decisions>
## Implementation Decisions

### Fork trigger & flow
- Fork button placed alongside existing actions (copy/install area) on the skill detail page
- Clicking Fork shows a brief confirmation modal: "Fork [skill name]? You'll get a copy to customize." with Fork/Cancel buttons
- On confirm, opens the publish/new skill form pre-filled with the parent's content as a draft — user can edit content, describe enhancements, and publish when ready
- Users can fork any skill, including their own (useful for creating variants)
- Fork requires login (existing auth gate on protected routes handles this)

### Attribution display
- Forked skill shows subtitle under the title: "Forked from [Original Skill] by [Author]"
- Both the skill name and author name are separate clickable links (skill links to parent detail page, author links to user profile)
- If the parent skill is deleted, attribution text remains but links become inactive/removed
- Parent skill shows fork count in the stats row alongside existing stats (downloads, ratings, etc.)

### Fork list & navigation
- "Forks" section displayed on the parent skill's detail page (similar to the existing Similar Skills section)
- Forks sorted by highest rated first
- Each fork card shows: fork skill name, who forked it, and description snippet
- Show top 3-5 forks inline with "View all forks" link if more exist

### Inherited content behavior
- Fork name defaults to "[Parent Name] (Fork)" — user edits before publishing
- Parent's description pre-filled — user can edit
- Tags and category inherited automatically (per requirements FORK-04)
- Content (the actual skill prompt/code) copied in full — this is the core of what's being forked
- Hours saved starts at zero — user sets their own estimate
- AI review does NOT copy — fork starts clean, user can request new review after publishing
- Ratings start at zero (fork is a new skill)

### Claude's Discretion
- Database schema design for the parent-child fork relationship (foreign key, self-referential, or separate table)
- Exact confirmation modal styling
- How the "View all forks" overflow page works (if needed)
- Slug generation strategy for forked skills
- Whether the fork count stat uses an icon or text label

</decisions>

<specifics>
## Specific Ideas

- The fork flow should feel like a "save as draft to edit" pattern — user clicks Fork, lands in the publish form with everything pre-filled, makes their changes, publishes when satisfied
- The attribution should be a clear but non-intrusive subtitle, not a prominent badge — the fork is its own skill, the provenance is secondary info

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-fork-based-versioning*
*Context gathered: 2026-02-04*
