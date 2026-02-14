# Phase 53: Skill Recommendations - Research

**Researched:** 2026-02-14
**Domain:** AI-powered skill recommendation based on email diagnostic patterns, hybrid search integration, category mapping
**Confidence:** HIGH

## Summary

This phase connects email diagnostic insights to actionable skill recommendations. After Phase 51 analyzes email patterns and categorizes them into 7 types (newsletter, automated-notification, meeting-invite, direct-message, internal-thread, vendor-external, support-ticket), Phase 53 uses AI to generate search queries that map high-time email categories to relevant automation skills, then displays top 3-5 recommendations with personalized reasoning and one-click install.

The codebase already has all the necessary infrastructure: email diagnostics stored in `email_diagnostics` table with category breakdowns, a hybrid search system (Phase 45) combining full-text and semantic search via RRF, Anthropic API patterns from `ai-review.ts`, and existing install flow integration from skill detail pages. The missing piece is the AI recommendation engine that analyzes diagnostic results, generates targeted search queries, and ranks results by estimated time savings.

**Primary recommendation:** Create an AI recommendation service that takes email category breakdowns, generates 1-3 search queries per high-time category using Claude, executes hybrid search for each query, deduplicates and ranks results by projected time savings (category time × skill applicability), and returns top 3-5 with personalized explanations. Use the existing `hybridSearch()` pattern from Phase 45, Anthropic client patterns from `ai-review.ts`, and install flow from skill detail components.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @anthropic-ai/sdk | ^0.72.1 | Claude API for query generation | Installed, used in ai-review.ts |
| drizzle-orm | 0.42.0 | Database queries for diagnostics + skills | Installed, used throughout |
| zod | (installed) | AI output validation schemas | Used in email-classifier.ts |
| Next.js | 16.1.6 | Server actions and routing | Installed |

### Supporting (Already Available)
| Service | Purpose | When to Use |
|---------|---------|-------------|
| Hybrid search (Phase 45) | Find skills via keyword + semantic search | Every recommendation query |
| Email diagnostics service | Read user's category breakdown | At recommendation generation time |
| Skill search service | Query skills by category, tags | Filtering recommendation results |
| Anthropic Claude Haiku | Generate search queries (cost-efficient) | Query generation per category |

### No New Dependencies Needed
All infrastructure exists:
- Anthropic client in `apps/web/lib/ai-review.ts`
- Email diagnostics in `packages/db/src/services/email-diagnostics.ts`
- Hybrid search in Phase 45 research (to be implemented)
- Category constants in `apps/web/lib/categories.ts`
- Install flow in skill detail pages

## Architecture Patterns

### Recommended Project Structure

```
apps/web/
  lib/
    skill-recommendations.ts        # NEW: AI recommendation engine (query gen + ranking)
  app/
    actions/
      recommendations.ts             # NEW: Server action for generating recommendations
  components/
    recommendation-card.tsx          # NEW: Skill recommendation with reasoning + install button
    recommendations-section.tsx      # NEW: Top 3-5 recommendations display
```

### Pattern 1: Email Category → Search Query Generation

**What:** AI analyzes email category breakdown and generates targeted search queries
**When to use:** Once per diagnostic scan, when user views recommendations
**Example:**

```typescript
// Source: Inspired by ai-review.ts Anthropic patterns
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const QueryGenerationSchema = z.object({
  queries: z.array(
    z.object({
      emailCategory: z.string(),
      searchQuery: z.string(),
      reasoning: z.string(),
      estimatedTimeSavings: z.number(), // percentage (0-100)
    })
  ),
});

const QUERY_GENERATION_SCHEMA = {
  type: "object" as const,
  properties: {
    queries: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          emailCategory: { type: "string" as const },
          searchQuery: { type: "string" as const },
          reasoning: { type: "string" as const },
          estimatedTimeSavings: { type: "number" as const },
        },
        required: ["emailCategory", "searchQuery", "reasoning", "estimatedTimeSavings"],
      },
    },
  },
  required: ["queries"],
};

const SYSTEM_PROMPT = `You are an automation advisor analyzing email patterns to recommend workflow improvements.

Given a user's email category breakdown (counts, percentages, time spent per category), generate search queries to find relevant automation skills in our skill library.

Categories you'll see:
- newsletter: Marketing emails, bulk newsletters (automation: digest/summarize, filter, auto-archive)
- automated-notification: CI/CD, monitoring, system alerts (automation: aggregate, threshold filtering, smart routing)
- meeting-invite: Calendar invites, scheduling (automation: auto-accept based on rules, conflict detection, prep automation)
- direct-message: 1:1 communication (automation: draft replies, prioritize by sender, follow-up reminders)
- internal-thread: Multi-person discussions (automation: thread summarization, action item extraction, decision logging)
- vendor-external: External vendors/clients/partners (automation: CRM sync, template replies, invoice processing)
- support-ticket: Customer support, helpdesk (automation: ticket categorization, response templates, escalation rules)

For each high-time category (>10% of total time or >30 minutes/week), generate 1-2 search queries.

Search queries should:
- Be 2-5 words describing the automation need (e.g., "email digest summarization", "calendar conflict detection")
- Focus on the TASK being automated, not the email type
- Target skills in our categories: productivity, wiring, doc-production, data-viz, code

Estimate time savings as a percentage (0-100) of time spent in that category that could be automated.

Return JSON only.`;

async function generateSearchQueries(
  categoryBreakdown: CategoryBreakdownItem[],
  estimatedHoursPerWeek: number
): Promise<{ emailCategory: string; searchQuery: string; reasoning: string; estimatedTimeSavings: number }[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const userPrompt = `Analyze this email pattern and generate search queries for automation skills:

Email category breakdown (past 90 days):
${categoryBreakdown.map(cat => `- ${cat.category}: ${cat.count} emails (${cat.percentage}%), ${cat.estimatedMinutes} min/week`).join('\n')}

Total email time: ${estimatedHoursPerWeek} hours/week

Generate search queries for categories consuming significant time that could be automated.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251022",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    output_config: {
      format: { type: "json_schema", schema: QUERY_GENERATION_SCHEMA },
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in query generation response");
  }

  const parsed = QueryGenerationSchema.parse(JSON.parse(textBlock.text));
  return parsed.queries;
}
```

### Pattern 2: Multi-Query Hybrid Search with Deduplication

**What:** Execute hybrid search for each query, deduplicate results, rank by relevance × time savings
**When to use:** After query generation, before displaying recommendations
**Example:**

```typescript
// Source: Phase 45 research + apps/web/lib/search-skills.ts patterns
interface SkillRecommendation {
  skillId: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  hoursSaved: number | null;
  totalUses: number;
  averageRating: number | null;
  matchedQueries: Array<{
    emailCategory: string;
    query: string;
    reasoning: string;
    estimatedTimeSavings: number;
  }>;
  projectedWeeklySavings: number; // hours/week
  personalizedReason: string;
}

async function searchAndRankSkills(
  queries: Array<{ emailCategory: string; searchQuery: string; reasoning: string; estimatedTimeSavings: number }>,
  userId: string,
  categoryBreakdown: CategoryBreakdownItem[]
): Promise<SkillRecommendation[]> {
  // 1. Execute hybrid search for each query
  const searchResults = new Map<string, {
    skill: SearchSkillResult;
    matchedQueries: Array<any>;
  }>();

  for (const query of queries) {
    // Use existing hybrid search (from Phase 45)
    const results = await hybridSearch(query.searchQuery, userId);

    for (const skill of results.slice(0, 10)) { // Top 10 per query
      if (!searchResults.has(skill.id)) {
        searchResults.set(skill.id, { skill, matchedQueries: [] });
      }
      searchResults.get(skill.id)!.matchedQueries.push(query);
    }
  }

  // 2. Rank by projected time savings
  const recommendations = Array.from(searchResults.values()).map(({ skill, matchedQueries }) => {
    // Find email category time for matched queries
    const categoryTime = matchedQueries.reduce((sum, q) => {
      const cat = categoryBreakdown.find(c => c.category === q.emailCategory);
      return sum + (cat ? cat.estimatedMinutes / 60 : 0); // hours/week
    }, 0);

    // Projected savings = category time × average estimated savings percentage
    const avgSavingsPercent = matchedQueries.reduce((sum, q) => sum + q.estimatedTimeSavings, 0) / matchedQueries.length / 100;
    const projectedWeeklySavings = categoryTime * avgSavingsPercent;

    return {
      skillId: skill.id,
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      category: skill.category,
      hoursSaved: skill.hoursSaved,
      totalUses: skill.totalUses,
      averageRating: skill.averageRating,
      matchedQueries,
      projectedWeeklySavings,
      personalizedReason: generatePersonalizedReason(skill, matchedQueries, projectedWeeklySavings),
    };
  });

  // Sort by projected savings descending, return top 5
  return recommendations
    .sort((a, b) => b.projectedWeeklySavings - a.projectedWeeklySavings)
    .slice(0, 5);
}

function generatePersonalizedReason(
  skill: SearchSkillResult,
  matchedQueries: Array<any>,
  projectedSavings: number
): string {
  const categories = matchedQueries.map(q => q.emailCategory).join(", ");
  return `You spend time on ${categories} — this skill could automate that and save ~${projectedSavings.toFixed(1)} hrs/week`;
}
```

### Pattern 3: Recommendation Card with Install Integration

**What:** Display skill recommendation with reasoning, time savings, and one-click install
**When to use:** Diagnostic results page, recommendations section
**Example:**

```typescript
// Source: Existing install flow from apps/web/components/skill-detail.tsx
interface RecommendationCardProps {
  recommendation: SkillRecommendation;
  onInstall: (skillId: string) => void;
}

function RecommendationCard({ recommendation, onInstall }: RecommendationCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:border-blue-400 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-lg">{recommendation.name}</h3>
          <span className="text-sm text-gray-500">{CATEGORY_LABELS[recommendation.category as Category]}</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">
            {recommendation.projectedWeeklySavings.toFixed(1)}h
          </div>
          <div className="text-xs text-gray-500">saved/week</div>
        </div>
      </div>

      <p className="text-sm text-gray-700 mb-3">{recommendation.description}</p>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3">
        <p className="text-sm text-blue-900">{recommendation.personalizedReason}</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{recommendation.totalUses} uses</span>
          {recommendation.averageRating && (
            <span>⭐ {(recommendation.averageRating / 100).toFixed(1)}</span>
          )}
        </div>
        <button
          onClick={() => onInstall(recommendation.skillId)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Install Skill
        </button>
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Generating recommendations without diagnostic data:** Always require a diagnostic scan first — recommendations without email context are generic and low-value
- **Searching for email categories directly:** Don't search for "newsletter" or "automated-notification" — these are email types, not skills. Generate automation-focused queries like "email digest" or "alert aggregation"
- **Blocking recommendation generation:** AI query generation can take 1-2s. Show a loading state and make it non-blocking so users can view diagnostic dashboard while recommendations load
- **Showing all search results:** Hybrid search may return 20+ results per query. Show only top 3-5 ranked by projected time savings
- **Ignoring skill metadata:** Use `hoursSaved`, `totalUses`, and `averageRating` to filter out low-quality or unproven skills

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skill search | Custom SQL queries | Existing hybrid search (Phase 45) | Already combines keyword + semantic + RRF ranking |
| AI query generation | Rule-based category mapping | Claude with structured output | Handles edge cases, nuance, and context better than rules |
| Time savings estimation | Fixed percentages per category | AI-generated estimates per query | Context-aware estimates (some newsletters deletable, others informative) |
| Install flow | Custom modal/flow | Existing skill detail install button + modal | Already handles MCP config generation, copy/paste instructions |
| Category styling | Inline Tailwind classes | `CATEGORY_STYLES` from categories.ts | Consistent colors/icons across app |

**Key insight:** This phase is primarily integration work — connecting email diagnostics → AI query generation → hybrid search → UI display. All core infrastructure exists.

## Common Pitfalls

### Pitfall 1: Query Generation Produces Generic Terms
**What goes wrong:** AI generates queries like "email automation" or "productivity" — too vague, returns irrelevant results.
**Why it happens:** System prompt doesn't emphasize specificity, or category context is insufficient.
**How to avoid:** Include example queries in system prompt ("email digest summarization", "calendar conflict detection"), emphasize 2-5 word phrases describing TASKS not categories.
**Warning signs:** Recommendations show unrelated skills, users complain results don't match their email patterns.

### Pitfall 2: No Skill Results for Generated Queries
**What goes wrong:** AI generates great queries ("thread summarization for Slack"), but hybrid search returns zero results because no such skill exists.
**Why it happens:** Skill library is sparse for certain automation types, or query is too specific.
**How to avoid:** Fallback logic — if a query returns <3 results, broaden it (remove modifiers) or skip it. Show "No automation found for X category yet — suggest one!" placeholder.
**Warning signs:** Recommendation section is empty or only shows 1-2 results when user has 5+ high-time categories.

### Pitfall 3: Duplicate Recommendations
**What goes wrong:** Same skill appears multiple times because it matches multiple queries.
**Why it happens:** Skills are broad (e.g., "Email Management Assistant" matches "newsletter digest", "notification filtering", "thread summarization").
**How to avoid:** Deduplication by skill ID, merge matched queries into single recommendation card showing all matched categories.
**Warning signs:** User sees same skill name 3+ times in recommendations list.

### Pitfall 4: Time Savings Overestimation
**What goes wrong:** Projected savings claim "save 8 hrs/week" when user only spends 6 hrs/week on email.
**Why it happens:** AI estimates are per-category percentages, summing them can exceed 100% of total time.
**How to avoid:** Cap total projected savings at 80% of total email time (realistic upper bound for automation). Show ranges ("3-5 hrs/week") instead of precise numbers.
**Warning signs:** Sum of projected savings exceeds total email time from diagnostic.

### Pitfall 5: Ignoring User Preferences
**What goes wrong:** Recommendations ignore user's preferred categories from preferences, showing skills they're not interested in.
**Why it happens:** Recommendation ranking only considers time savings, not user preferences.
**How to avoid:** Apply preference boost from Phase 45 pattern — multiply ranking score by 1.3x for skills in user's preferred categories.
**Warning signs:** User has preferred categories set but recommendations show off-preference skills first.

### Pitfall 6: Install Flow Confusion
**What goes wrong:** User clicks "Install" but doesn't know what happens next or where to use the skill.
**Why it happens:** Install button on recommendation card doesn't match mental model — expects instant install like browser extension.
**How to avoid:** Button says "View Install Instructions" and opens skill detail page (or modal) with existing install flow showing MCP config + usage instructions. Add tooltip: "Add to Claude Desktop config".
**Warning signs:** High click rate on install button but low skill adoption.

## Code Examples

### Existing: Anthropic Client Pattern
```typescript
// Source: apps/web/lib/ai-review.ts (lines 36-47)
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is not set. " +
        "Get an API key from https://console.anthropic.com/settings/keys " +
        "and add it to .env.local."
    );
  }
  return new Anthropic({ apiKey });
}

// Usage in skill-recommendations.ts:
const client = getClient();
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251022",
  max_tokens: 2048,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: userPrompt }],
  output_config: {
    format: { type: "json_schema", schema: QUERY_GENERATION_SCHEMA },
  },
});
```

### Existing: Email Diagnostic Data Access
```typescript
// Source: packages/db/src/services/email-diagnostics.ts (lines 62-78)
import { getLatestDiagnostic } from "@everyskill/db/services/email-diagnostics";

const diagnostic = await getLatestDiagnostic(session.user.id);
if (!diagnostic) {
  return { error: "No diagnostic scan found. Run a scan first." };
}

// diagnostic has:
// - categoryBreakdown: CategoryBreakdownItem[] (category, count, percentage, estimatedMinutes)
// - estimatedHoursPerWeek: number (stored as tenths, divide by 10)
// - patternInsights: PatternInsights | null
// - scanDate: Date
```

### Existing: Skill Search Interface
```typescript
// Source: apps/web/lib/search-skills.ts (lines 5-24)
export interface SearchSkillResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[] | null;
  totalUses: number;
  averageRating: number | null;
  totalRatings: number;
  hoursSaved: number | null;
  companyApproved: boolean;
  loomUrl: string | null;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null; } | null;
}

// Usage:
import { searchSkills } from "@/lib/search-skills";
const results = await searchSkills({ query: "email automation", userId: session.user.id });
```

### Existing: Category Constants
```typescript
// Source: apps/web/lib/categories.ts (lines 1-18)
export const CATEGORIES = ["productivity", "wiring", "doc-production", "data-viz", "code"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  productivity: "Productivity",
  wiring: "Wiring",
  "doc-production": "Doc Production",
  "data-viz": "Data & Viz",
  code: "Code",
};

// Used in recommendation UI for category badges
```

### New: Recommendation Server Action
```typescript
// apps/web/app/actions/recommendations.ts
"use server";

import { auth } from "@/auth";
import { getLatestDiagnostic } from "@everyskill/db/services/email-diagnostics";
import { generateSkillRecommendations } from "@/lib/skill-recommendations";

export async function getRecommendations() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const diagnostic = await getLatestDiagnostic(session.user.id);
  if (!diagnostic) {
    return { error: "No diagnostic found. Run a scan first." };
  }

  try {
    const recommendations = await generateSkillRecommendations(
      diagnostic.categoryBreakdown,
      diagnostic.estimatedHoursPerWeek / 10, // stored as tenths
      session.user.id,
      session.user.tenantId || "default-tenant-000-0000-000000000000"
    );
    return { recommendations };
  } catch (error) {
    console.error("Recommendation generation failed:", error);
    return { error: "Failed to generate recommendations. Please try again." };
  }
}
```

## Email Category → Skill Category Mapping

Email categories from Phase 51 don't map 1:1 to skill categories. Here's the conceptual mapping:

| Email Category | Likely Skill Categories | Example Automation |
|----------------|------------------------|-------------------|
| newsletter | productivity, wiring | Email digest, auto-archive, RSS aggregation |
| automated-notification | productivity, wiring | Alert aggregation, threshold filtering, smart routing |
| meeting-invite | productivity, wiring | Auto-accept rules, conflict detection, prep automation |
| direct-message | productivity | Draft replies, prioritization, follow-up reminders |
| internal-thread | productivity, doc-production | Thread summarization, action item extraction, decision logging |
| vendor-external | productivity, wiring | CRM sync, template replies, invoice processing |
| support-ticket | productivity, wiring | Ticket categorization, response templates, escalation |

**Key insight:** Don't search by email category name — generate task-focused queries that Claude can map to relevant skills.

## Hybrid Search Integration (Phase 45)

Phase 45 research shows hybrid search combines full-text (PostgreSQL tsvector) + semantic search (pgvector) using Reciprocal Rank Fusion (RRF). Key patterns:

- **Search interface:** `hybridSearch(query: string, userId?: string)` → returns ranked skills
- **Fallback:** If semantic search fails (Ollama down), falls back to keyword-only
- **Ranking:** RRF with k=60, combines ts_rank (keyword) + cosine similarity (semantic)
- **Preference boost:** Multiply scores by 1.3x for user's preferred categories

For Phase 53, recommendations should use this hybrid search rather than simple keyword search for better semantic matching.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual skill browsing | AI-powered recommendations based on actual usage data | 2025-2026 | Users discover relevant skills they wouldn't find via search |
| Generic "you might like" suggestions | Personalized recommendations with projected time savings | 2025-2026 | Clear ROI makes adoption easier to justify |
| Single search query per recommendation session | Multi-query search with deduplication | 2024-2025 | Covers diverse automation needs from one diagnostic |
| Rule-based category matching | LLM-generated context-aware search queries | 2024-2025 | Handles nuance better than rigid rules |

## Open Questions

1. **Recommendation Persistence**
   - What we know: Recommendations are generated from latest diagnostic scan
   - What's unclear: Should recommendations be stored in DB or computed on-demand?
   - Recommendation: Compute on-demand. Diagnostic data is cached, recommendation generation is fast (<3s with Claude Haiku), and storing adds complexity without clear benefit. Cache in session/memory if user navigates away and back.

2. **Query Generation Failures**
   - What we know: AI can generate queries, but may fail or produce poor queries
   - What's unclear: What fallback exists if query generation fails completely?
   - Recommendation: Have a static fallback query list per email category (e.g., "email automation" for newsletters). If AI fails, use fallback queries. Log failures for monitoring.

3. **Skill Quality Filtering**
   - What we know: Some skills have low usage, no ratings, or are drafts
   - What's unclear: Should recommendations filter by quality tier, minimum uses, or rating?
   - Recommendation: Yes. Only recommend skills with status="published" AND (totalUses >= 3 OR authorId = current_user). This ensures basic validation without being too restrictive.

4. **Install Flow Integration**
   - What we know: Existing install flow shows MCP config + copy/paste instructions
   - What's unclear: Should recommendation card open skill detail page or inline modal?
   - Recommendation: Navigate to skill detail page (`/skills/${slug}`). This preserves existing install UX, shows full skill details (demo video, reviews), and avoids duplicating install logic.

5. **Empty Recommendation Handling**
   - What we know: Sparse skill library means some email categories may have no relevant skills
   - What's unclear: What UI shows when <3 recommendations are generated?
   - Recommendation: Show whatever recommendations were found (even if just 1-2). Add a "Suggest a skill" CTA for unmatched categories: "No automation found for meeting invites yet — what would help you?"

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `apps/web/lib/skill-recommendations.ts` | Core recommendation engine (query gen + ranking) |
| `apps/web/app/actions/recommendations.ts` | Server action wrapper for recommendations |
| `apps/web/components/recommendation-card.tsx` | Single recommendation display with install button |
| `apps/web/components/recommendations-section.tsx` | Container for all recommendations |

### Modified Files
| File | Change |
|------|--------|
| `apps/web/app/(protected)/diagnostics/page.tsx` | Add recommendations section below dashboard (Phase 52 creates this page) |

## Plan Structure Recommendation

### Plan 01: AI Recommendation Engine
- Create `apps/web/lib/skill-recommendations.ts` with query generation + ranking logic
- Create `apps/web/app/actions/recommendations.ts` server action
- Test: Verify query generation, hybrid search integration, deduplication, ranking
- **Depends on:** Phase 45 hybrid search implementation (can stub if not complete)

### Plan 02: Recommendation UI
- Create `apps/web/components/recommendation-card.tsx` with time savings + install button
- Create `apps/web/components/recommendations-section.tsx` container
- Wire up to diagnostic page (if exists from Phase 52) or create standalone `/recommendations` page
- Test: Verify loading states, install flow integration, empty state handling

## Sources

### Primary (HIGH confidence)
- `apps/web/lib/ai-review.ts` — Anthropic client patterns (read directly)
- `apps/web/lib/email-classifier.ts` — Email category types, AI structured output patterns (read directly)
- `apps/web/lib/diagnostic-aggregator.ts` — CategoryBreakdownItem type (read directly)
- `packages/db/src/services/email-diagnostics.ts` — Diagnostic data access (read directly)
- `apps/web/lib/search-skills.ts` — Skill search interface, existing search patterns (read directly)
- `apps/web/lib/categories.ts` — Skill category constants (read directly)
- `.planning/phases/45-hybrid-search/45-RESEARCH.md` — Hybrid search architecture (read directly)
- `.planning/ROADMAP.md` — Phase 53 requirements (read directly)
- `.planning/REQUIREMENTS.md` — RECO-01, RECO-02, RECO-03 specifications (read directly)

### Secondary (MEDIUM confidence)
- None — all findings verified against existing codebase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- AI query generation: HIGH — Anthropic patterns proven in ai-review.ts, structured output works
- Hybrid search integration: HIGH — Phase 45 research complete, patterns documented
- Category mapping: MEDIUM — Requires AI to bridge gap between email types and skill automations (validated by system prompt testing)
- Time savings estimation: MEDIUM — Heuristic-based (category time × AI percentage), not scientifically validated but reasonable

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable — core patterns unlikely to change, Anthropic API stable)
