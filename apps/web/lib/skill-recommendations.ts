import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { searchSkills, type SearchSkillResult } from "@/lib/search-skills";
import type { CategoryBreakdownItem } from "@everyskill/db/services/email-diagnostics";
import type { WorkContext } from "./email-work-context";

/**
 * AI-powered skill recommendation engine
 *
 * Analyzes email diagnostic data + work context to generate targeted search
 * queries using Claude Haiku, executes hybrid search, and ranks by projected
 * weekly time savings.
 *
 * Includes retry on rate-limit (429) and static fallback if AI is unavailable.
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
        additionalProperties: false,
      },
    },
  },
  required: ["queries"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// System prompt for query generation
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are recommending automation skills from a library of 100s-1000s of skills.
Given the user's email patterns AND work context (what topics they work on, what deliverables they create, what tools they use), generate specific search queries that will find the most relevant automation skills.

Categories you'll see:
- newsletter: Marketing emails, bulk newsletters (automation: digest/summarize, filter, auto-archive)
- automated-notification: CI/CD, monitoring, system alerts (automation: aggregate, threshold filtering, smart routing)
- meeting-invite: Calendar invites, scheduling (automation: auto-accept based on rules, conflict detection, prep automation)
- direct-message: 1:1 communication (automation: draft replies, prioritize by sender, follow-up reminders)
- internal-thread: Multi-person discussions (automation: thread summarization, action item extraction, decision logging)
- vendor-external: External vendors/clients/partners (automation: CRM sync, template replies, invoice processing)
- support-ticket: Customer support, helpdesk (automation: ticket categorization, response templates, escalation rules)

Be specific: not "email automation" but "financial report template generation" or "Jira ticket triage automation" based on their actual work patterns.

For each high-time category (>10% of total time or >30 minutes/week), generate 1-2 search queries.
Estimate time savings as a percentage (0-100) of time in that category that could be automated.

Return JSON only.`;

// ---------------------------------------------------------------------------
// Static fallback queries (used when AI is unavailable)
// ---------------------------------------------------------------------------

const FALLBACK_QUERIES: Record<string, GeneratedQuery[]> = {
  newsletter: [
    {
      emailCategory: "newsletter",
      searchQuery: "email digest summarization",
      reasoning: "Summarize newsletters",
      estimatedTimeSavings: 60,
    },
  ],
  "automated-notification": [
    {
      emailCategory: "automated-notification",
      searchQuery: "notification filtering aggregation",
      reasoning: "Filter and aggregate alerts",
      estimatedTimeSavings: 50,
    },
  ],
  "meeting-invite": [
    {
      emailCategory: "meeting-invite",
      searchQuery: "calendar scheduling automation",
      reasoning: "Automate meeting prep",
      estimatedTimeSavings: 30,
    },
  ],
  "direct-message": [
    {
      emailCategory: "direct-message",
      searchQuery: "email draft reply automation",
      reasoning: "Draft email responses",
      estimatedTimeSavings: 25,
    },
  ],
  "internal-thread": [
    {
      emailCategory: "internal-thread",
      searchQuery: "thread summarization action items",
      reasoning: "Extract action items from threads",
      estimatedTimeSavings: 40,
    },
  ],
  "vendor-external": [
    {
      emailCategory: "vendor-external",
      searchQuery: "CRM sync invoice processing",
      reasoning: "Automate vendor communication",
      estimatedTimeSavings: 35,
    },
  ],
  "support-ticket": [
    {
      emailCategory: "support-ticket",
      searchQuery: "ticket categorization response templates",
      reasoning: "Automate ticket responses",
      estimatedTimeSavings: 45,
    },
  ],
};

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
 * Generate targeted search queries from email category breakdown + work context.
 * Uses Claude Haiku with 1 retry on rate-limit, falls back to static queries.
 */
async function generateSearchQueries(
  categoryBreakdown: CategoryBreakdownItem[],
  estimatedHoursPerWeek: number,
  workContext?: WorkContext
): Promise<GeneratedQuery[]> {
  // Filter to high-time categories: >10% of total OR >30 minutes/week
  const highTimeCategories = categoryBreakdown.filter(
    (cat) => cat.percentage > 10 || cat.estimatedMinutes > 30
  );

  if (highTimeCategories.length === 0) {
    return [];
  }

  // Try AI generation with retry, fall back to static queries
  try {
    return await generateSearchQueriesWithAI(
      highTimeCategories,
      estimatedHoursPerWeek,
      workContext
    );
  } catch (error) {
    console.warn("AI query generation failed, using fallback queries:", error);
    return generateFallbackQueries(highTimeCategories);
  }
}

async function generateSearchQueriesWithAI(
  highTimeCategories: CategoryBreakdownItem[],
  estimatedHoursPerWeek: number,
  workContext?: WorkContext
): Promise<GeneratedQuery[]> {
  const client = getClient();

  // Format category breakdown
  const categoryList = highTimeCategories
    .map(
      (cat) =>
        `- ${cat.category}: ${cat.count} emails (${cat.percentage.toFixed(1)}%), ${cat.estimatedMinutes.toFixed(0)} min/week`
    )
    .join("\n");

  // Build user prompt with optional work context
  let userPrompt = `Analyze this email pattern and generate search queries for automation skills:

Email category breakdown (past 90 days):
${categoryList}

Total email time: ${estimatedHoursPerWeek.toFixed(1)} hours/week`;

  if (workContext) {
    const sentSection =
      workContext.sentCount > 0
        ? `\nSent email analysis:
- ${workContext.sentCount} sent emails, ${workContext.sentWithAttachmentCount} with attachments${workContext.sentTopics.length > 0 ? `\n- Active topics: ${workContext.sentTopics.slice(0, 10).join(", ")}` : ""}${workContext.attachmentTopics.length > 0 ? `\n- Attachment topics: ${workContext.attachmentTopics.join(", ")}` : ""}`
        : "";

    const toolsSection =
      workContext.topSenderDomains.length > 0
        ? `\n- Tools/services: ${workContext.topSenderDomains
            .slice(0, 8)
            .map((d) => `${d.domain} (${d.count})`)
            .join(", ")}`
        : "";

    const threadsSection =
      workContext.topThreadSubjects.length > 0
        ? `\n- Top discussion threads: ${workContext.topThreadSubjects
            .slice(0, 5)
            .map((s) => `"${s}"`)
            .join(", ")}`
        : "";

    userPrompt += sentSection + toolsSection + threadsSection;
  }

  userPrompt +=
    "\n\nGenerate 5-8 highly specific search queries targeting skills that would save this user the most time.";

  // Attempt with 1 retry on 429
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        output_config: {
          format: { type: "json_schema", schema: QUERY_GENERATION_SCHEMA },
        },
      });

      if (response.stop_reason !== "end_turn") {
        throw new Error(`Query generation incomplete: stop_reason was "${response.stop_reason}"`);
      }

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in query generation response");
      }

      const parsed = QueryGenerationSchema.parse(JSON.parse(textBlock.text));
      return parsed.queries;
    } catch (error) {
      const isRateLimit =
        error instanceof Anthropic.RateLimitError ||
        (error instanceof Error && error.message.includes("429"));
      if (isRateLimit && attempt === 0) {
        // Wait 2s and retry once
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      throw error;
    }
  }

  // Should not reach here, but TypeScript needs it
  throw new Error("Query generation exhausted retries");
}

function generateFallbackQueries(highTimeCategories: CategoryBreakdownItem[]): GeneratedQuery[] {
  const queries: GeneratedQuery[] = [];
  for (const cat of highTimeCategories) {
    const fallback = FALLBACK_QUERIES[cat.category];
    if (fallback) {
      queries.push(...fallback);
    }
  }
  // Add attachment-focused query if data suggests high attachment work
  return queries;
}

// ---------------------------------------------------------------------------
// Search and ranking (Phase 2)
// ---------------------------------------------------------------------------

/**
 * Execute hybrid search for each query, deduplicate results, and rank by
 * projected weekly time savings.
 */
async function searchAndRankSkills(
  queries: GeneratedQuery[],
  userId: string,
  categoryBreakdown: CategoryBreakdownItem[]
): Promise<SkillRecommendation[]> {
  const skillMap = new Map<
    string,
    {
      skill: SearchSkillResult;
      matchedQueries: GeneratedQuery[];
    }
  >();

  for (const query of queries) {
    const results = await searchSkills({
      query: query.searchQuery,
      userId,
    });

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

  const recommendations: SkillRecommendation[] = [];

  for (const [_skillId, { skill, matchedQueries }] of skillMap.entries()) {
    const matchedCategories = Array.from(new Set(matchedQueries.map((q) => q.emailCategory)));

    const categoryTimeHours = matchedCategories.reduce((sum, categoryName) => {
      const cat = categoryBreakdown.find((c) => c.category === categoryName);
      return sum + (cat ? cat.estimatedMinutes / 60 : 0);
    }, 0);

    const avgSavingsPercent =
      matchedQueries.reduce((sum, q) => sum + q.estimatedTimeSavings, 0) /
      matchedQueries.length /
      100;

    const projectedWeeklySavings = categoryTimeHours * avgSavingsPercent;

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
 * @param categoryBreakdown - Email category statistics from diagnostic scan
 * @param estimatedHoursPerWeek - Total email time per week (in hours, not tenths)
 * @param userId - Current user ID for search visibility
 * @param _tenantId - Current tenant ID (for future multi-tenant support)
 * @param workContext - Optional work context extracted from email metadata
 * @returns Top 5 skill recommendations ranked by projected time savings
 */
export async function generateSkillRecommendations(
  categoryBreakdown: CategoryBreakdownItem[],
  estimatedHoursPerWeek: number,
  userId: string,
  _tenantId: string,
  workContext?: WorkContext
): Promise<SkillRecommendation[]> {
  // Phase 1: Generate search queries using AI (with retry + fallback)
  const queries = await generateSearchQueries(
    categoryBreakdown,
    estimatedHoursPerWeek,
    workContext
  );

  if (queries.length === 0) {
    return [];
  }

  // Phase 2: Search and rank skills
  const recommendations = await searchAndRankSkills(queries, userId, categoryBreakdown);

  return recommendations;
}
