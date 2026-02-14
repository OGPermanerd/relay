import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { searchSkills, type SearchSkillResult } from "@/lib/search-skills";
import type { CategoryBreakdownItem } from "@everyskill/db/services/email-diagnostics";

/**
 * AI-powered skill recommendation engine
 *
 * Analyzes email diagnostic category breakdowns, generates targeted search queries
 * using Claude Haiku, executes hybrid search for each query, and ranks results
 * by projected weekly time savings.
 *
 * Two-phase approach:
 * 1. AI generates search queries mapping email categories to automation tasks
 * 2. Hybrid search + deduplication + ranking by projected time savings
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillRecommendation {
  skillId: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  hoursSaved: number | null;
  totalUses: number;
  averageRating: number | null;
  matchedCategories: string[]; // email categories matched
  projectedWeeklySavings: number; // hours/week
  personalizedReason: string;
}

interface GeneratedQuery {
  emailCategory: string;
  searchQuery: string;
  reasoning: string;
  estimatedTimeSavings: number; // percentage (0-100)
}

// ---------------------------------------------------------------------------
// Zod schemas for AI output validation
// ---------------------------------------------------------------------------

const QueryGenerationSchema = z.object({
  queries: z.array(
    z.object({
      emailCategory: z.string(),
      searchQuery: z.string(),
      reasoning: z.string(),
      estimatedTimeSavings: z.number(),
    })
  ),
});

// ---------------------------------------------------------------------------
// JSON schema for Anthropic output_config
// ---------------------------------------------------------------------------

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
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// System prompt for query generation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Query generation (Phase 1)
// ---------------------------------------------------------------------------

/**
 * Generate targeted search queries from email category breakdown.
 * Uses Claude Haiku to map email categories to automation tasks.
 *
 * @param categoryBreakdown - Email category statistics from diagnostic
 * @param estimatedHoursPerWeek - Total email time per week (in hours)
 * @returns Array of search queries with reasoning and time savings estimates
 */
async function generateSearchQueries(
  categoryBreakdown: CategoryBreakdownItem[],
  estimatedHoursPerWeek: number
): Promise<GeneratedQuery[]> {
  const client = getClient();

  // Filter to high-time categories: >10% of total OR >30 minutes/week
  const highTimeCategories = categoryBreakdown.filter(
    (cat) => cat.percentage > 10 || cat.estimatedMinutes > 30
  );

  // If no high-time categories, return empty (not worth generating recommendations)
  if (highTimeCategories.length === 0) {
    return [];
  }

  // Format category breakdown for AI
  const categoryList = highTimeCategories
    .map(
      (cat) =>
        `- ${cat.category}: ${cat.count} emails (${cat.percentage.toFixed(1)}%), ${cat.estimatedMinutes.toFixed(0)} min/week`
    )
    .join("\n");

  const userPrompt = `Analyze this email pattern and generate search queries for automation skills:

Email category breakdown (past 90 days):
${categoryList}

Total email time: ${estimatedHoursPerWeek.toFixed(1)} hours/week

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

  if (response.stop_reason !== "end_turn") {
    throw new Error(
      `Query generation incomplete: stop_reason was "${response.stop_reason}" (expected "end_turn"). ` +
        "The response may have been truncated."
    );
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in query generation response");
  }

  const parsed = QueryGenerationSchema.parse(JSON.parse(textBlock.text));
  return parsed.queries;
}

// ---------------------------------------------------------------------------
// Search and ranking (Phase 2)
// ---------------------------------------------------------------------------

/**
 * Execute hybrid search for each query, deduplicate results, and rank by
 * projected weekly time savings.
 *
 * @param queries - Generated search queries from AI
 * @param userId - Current user ID for visibility filtering
 * @param categoryBreakdown - Email category breakdown for time calculations
 * @returns Top 5 skill recommendations ranked by projected savings
 */
async function searchAndRankSkills(
  queries: GeneratedQuery[],
  userId: string,
  categoryBreakdown: CategoryBreakdownItem[]
): Promise<SkillRecommendation[]> {
  // Map to track deduplicated skills and which queries matched them
  const skillMap = new Map<
    string,
    {
      skill: SearchSkillResult;
      matchedQueries: GeneratedQuery[];
    }
  >();

  // Execute search for each query
  for (const query of queries) {
    const results = await searchSkills({
      query: query.searchQuery,
      userId,
    });

    // Take top 10 results per query
    for (const skill of results.slice(0, 10)) {
      if (!skillMap.has(skill.id)) {
        skillMap.set(skill.id, {
          skill,
          matchedQueries: [],
        });
      }
      skillMap.get(skill.id)!.matchedQueries.push(query);
    }
  }

  // Build recommendations with projected savings calculations
  const recommendations: SkillRecommendation[] = [];

  for (const [_skillId, { skill, matchedQueries }] of skillMap.entries()) {
    // Calculate total time spent on matched categories
    const matchedCategories = Array.from(new Set(matchedQueries.map((q) => q.emailCategory)));

    const categoryTimeHours = matchedCategories.reduce((sum, categoryName) => {
      const cat = categoryBreakdown.find((c) => c.category === categoryName);
      return sum + (cat ? cat.estimatedMinutes / 60 : 0);
    }, 0);

    // Calculate average estimated time savings percentage
    const avgSavingsPercent =
      matchedQueries.reduce((sum, q) => sum + q.estimatedTimeSavings, 0) /
      matchedQueries.length /
      100;

    // Projected weekly savings = category time × average savings percentage
    const projectedWeeklySavings = categoryTimeHours * avgSavingsPercent;

    // Generate personalized reason
    const categoriesText =
      matchedCategories.length === 1
        ? matchedCategories[0]
        : matchedCategories.length === 2
          ? `${matchedCategories[0]} and ${matchedCategories[1]}`
          : `${matchedCategories.slice(0, -1).join(", ")}, and ${matchedCategories[matchedCategories.length - 1]}`;

    const personalizedReason = `You spend time on ${categoriesText} — this skill could automate that and save ~${projectedWeeklySavings.toFixed(1)} hrs/week`;

    recommendations.push({
      skillId: skill.id,
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      category: skill.category,
      hoursSaved: skill.hoursSaved,
      totalUses: skill.totalUses,
      averageRating: skill.averageRating,
      matchedCategories,
      projectedWeeklySavings,
      personalizedReason,
    });
  }

  // Sort by projected savings descending, return top 5
  return recommendations
    .sort((a, b) => b.projectedWeeklySavings - a.projectedWeeklySavings)
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate personalized skill recommendations based on email diagnostic data.
 *
 * Process:
 * 1. AI analyzes email category breakdown to generate targeted search queries
 * 2. Execute hybrid search for each query
 * 3. Deduplicate results by skill ID
 * 4. Rank by projected weekly time savings
 * 5. Return top 5 recommendations with personalized reasoning
 *
 * @param categoryBreakdown - Email category statistics from diagnostic scan
 * @param estimatedHoursPerWeek - Total email time per week (in hours, not tenths)
 * @param userId - Current user ID for search visibility
 * @param tenantId - Current tenant ID (for future multi-tenant support)
 * @returns Top 5 skill recommendations ranked by projected time savings
 */
export async function generateSkillRecommendations(
  categoryBreakdown: CategoryBreakdownItem[],
  estimatedHoursPerWeek: number,
  userId: string,
  _tenantId: string
): Promise<SkillRecommendation[]> {
  // Phase 1: Generate search queries using AI
  const queries = await generateSearchQueries(categoryBreakdown, estimatedHoursPerWeek);

  // If no queries generated (all categories low-time), return empty
  if (queries.length === 0) {
    return [];
  }

  // Phase 2: Search and rank skills
  const recommendations = await searchAndRankSkills(queries, userId, categoryBreakdown);

  return recommendations;
}
