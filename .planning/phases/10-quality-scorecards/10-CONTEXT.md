# Phase 10: Quality Scorecards - Context

**Created:** 2026-01-31
**Phase Goal:** Users can identify high-quality skills through visible quality badges

## Decisions

### Score Calculation

**Formula:** Usage-heavy weighting
- Usage count: 50%
- Average rating: 35%
- Documentation completeness: 15%

**Rationale:** Popularity signals real-world value. Skills that get used repeatedly have proven utility.

**Documentation completeness criteria:** Has description + category
- Binary check: does skill have non-empty description AND valid category?
- Simple to implement, meaningful minimum bar

### Badge Display

**On skill cards:** Small corner badge
- Subtle colored dot/icon in top-right corner
- Doesn't dominate the card layout
- Colors: Gold (#FFD700), Silver (#C0C0C0), Bronze (#CD7F32)

**On detail pages:** Collapsible "Why this badge?" section
- Badge displayed prominently near title
- Expandable section shows breakdown of factors
- Shows: usage score, rating score, doc score, and how they combine

### Unrated Behavior

**Threshold:** Less than 3 ratings triggers "Unrated" state
- Skills with 0-2 ratings show "Unrated" instead of a badge
- Prevents gaming and ensures statistical significance
- Once a skill hits 3 ratings, badge is calculated

**Display:** "Unrated" text/badge in neutral gray
- Not a failure state, just "not enough data yet"
- Could show "Be the first to rate!" prompt on detail page

### Badge Tier Thresholds

**Scoring scale:** 0-100 normalized score

| Tier | Score Range | Color |
|------|-------------|-------|
| Gold | 75-100 | #FFD700 |
| Silver | 50-74 | #C0C0C0 |
| Bronze | 25-49 | #CD7F32 |
| No badge | 0-24 | (none shown) |
| Unrated | < 3 ratings | Gray |

**Note:** More lenient thresholds to encourage early adoption. Most skills with decent ratings and some usage will earn at least Bronze.

## Scope Boundaries

**In scope:**
- Calculate quality score from existing metrics
- Display badges on cards and detail pages
- Filter by quality tier
- Sort by quality score
- Show breakdown on detail page

**Out of scope (deferred):**
- Trending/velocity metrics (would need time-series data)
- Comparative rankings ("top 10%")
- Badge decay over time
- Author reputation scores

## Implementation Notes

- Score calculation can be a computed field or stored (evaluate during planning)
- Consider caching scores if calculation is expensive
- Filters should use tier names (Gold/Silver/Bronze) not numeric thresholds
- Sorting by quality should be descending (best first)

---
*Context gathered: 2026-01-31*
