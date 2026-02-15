import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db, skills } from "@everyskill/db";
import { eq } from "drizzle-orm";
import type { WorkContext } from "./email-work-context";

/**
 * AI-powered skill recommendation engine
 *
 * Directly matches a user's work activities (from sent emails, attachments,
 * active threads, and tool usage) to the full skill catalog via a single
 * Claude Haiku call.
 *
 * No intermediary search step — the AI sees the full catalog (~51 skills)
 * and the user's work profile, and returns the best matches with reasons.
 *
 * Fallback: keyword matching when Anthropic is unavailable.
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
  matchedCategories: string[];
  projectedWeeklySavings: number;
  personalizedReason: string;
}

interface SkillCatalogEntry {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[] | null;
  totalUses: number;
  averageRating: number | null;
  hoursSaved: number | null;
}

interface AIMatchResult {
  skillId: string;
  matchReason: string;
  relevanceScore: number;
  estimatedWeeklySavings: number;
}

// ---------------------------------------------------------------------------
// Zod schema for AI output validation
// ---------------------------------------------------------------------------

const MatchingResultSchema = z.object({
  matches: z.array(
    z.object({
      skillId: z.string(),
      matchReason: z.string(),
      relevanceScore: z.number(),
      estimatedWeeklySavings: z.number(),
    })
  ),
});

// ---------------------------------------------------------------------------
// JSON schema for Anthropic structured output
// ---------------------------------------------------------------------------

const MATCHING_SCHEMA = {
  type: "object" as const,
  properties: {
    matches: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          skillId: { type: "string" as const },
          matchReason: { type: "string" as const },
          relevanceScore: { type: "number" as const },
          estimatedWeeklySavings: { type: "number" as const },
        },
        required: ["skillId", "matchReason", "relevanceScore", "estimatedWeeklySavings"],
        additionalProperties: false,
      },
    },
  },
  required: ["matches"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are matching a user's actual work activities to specific automation skills.

You will receive:
1. A catalog of available skills (id | name | description)
2. The user's work profile extracted from their sent emails and tool usage

RULES:
- Match based on what the user CREATES and DOES, not what they receive
- Sent emails and attachments reveal deliverables they produce
- Active discussion threads reveal decisions/collaboration they lead
- Tool usage reveals their workflow
- Be specific in matchReason — reference their actual subjects/activities
- estimatedWeeklySavings: realistic hours (0.5-4 typical, max 8 exceptional)
- Return 5-8 best matches, ranked by time-savings potential

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
// Prompt builders
// ---------------------------------------------------------------------------

function buildSkillCatalog(skills: SkillCatalogEntry[]): string {
  return skills.map((s) => `${s.id} | ${s.name} | ${s.description.slice(0, 150)}`).join("\n");
}

function buildWorkProfile(workContext: WorkContext): string {
  const sections: string[] = [];

  // Sent email activity
  const sentHeader = `Sent Email Activity (${workContext.sentPerWeek}/week, ${workContext.attachmentsPerWeek} with attachments):`;
  const sentSubjects = workContext.uniqueSentSubjects
    .slice(0, 40)
    .map((s) => `- "${s}"`)
    .join("\n");
  if (sentSubjects) {
    sections.push(`${sentHeader}\n${sentSubjects}`);
  }

  // Deliverables (attachment emails)
  if (workContext.uniqueAttachmentSubjects.length > 0) {
    const attachHeader = "Deliverables Created (emails with attachments):";
    const attachSubjects = workContext.uniqueAttachmentSubjects
      .slice(0, 15)
      .map((s) => `- "${s}"`)
      .join("\n");
    sections.push(`${attachHeader}\n${attachSubjects}`);
  }

  // Active discussion threads
  if (workContext.activeThreads.length > 0) {
    const threadHeader = "Active Discussion Threads:";
    const threads = workContext.activeThreads
      .map((t) => `- "${t.subject}" (${t.userReplies} replies from user)`)
      .join("\n");
    sections.push(`${threadHeader}\n${threads}`);
  }

  // Tools & services
  const knownTools = workContext.toolDomains.filter((t) => t.tool !== t.domain);
  if (knownTools.length > 0) {
    const toolHeader = "Tools & Services Used:";
    const tools = knownTools.map((t) => `- ${t.tool} (${t.count} emails)`).join("\n");
    sections.push(`${toolHeader}\n${tools}`);
  }

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// AI matching
// ---------------------------------------------------------------------------

async function matchSkillsWithAI(
  skillCatalog: SkillCatalogEntry[],
  workContext: WorkContext
): Promise<AIMatchResult[]> {
  const client = getClient();
  const userPrompt = `Skill Catalog:\n${buildSkillCatalog(skillCatalog)}\n\n${buildWorkProfile(workContext)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3072,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        output_config: {
          format: { type: "json_schema", schema: MATCHING_SCHEMA },
        },
      });

      if (response.stop_reason !== "end_turn") {
        throw new Error(`Matching incomplete: stop_reason was "${response.stop_reason}"`);
      }

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in matching response");
      }

      const parsed = MatchingResultSchema.parse(JSON.parse(textBlock.text));
      return parsed.matches;
    } catch (error) {
      const isRateLimit =
        error instanceof Anthropic.RateLimitError ||
        (error instanceof Error && error.message.includes("429"));
      if (isRateLimit && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Skill matching exhausted retries");
}

// ---------------------------------------------------------------------------
// Keyword fallback (no AI)
// ---------------------------------------------------------------------------

function fallbackKeywordMatch(
  skillCatalog: SkillCatalogEntry[],
  workContext: WorkContext
): SkillRecommendation[] {
  // Collect keywords from work signals
  const keywords = new Set<string>();

  for (const subject of workContext.uniqueSentSubjects.slice(0, 20)) {
    for (const word of subject.toLowerCase().split(/[\s/\-_,;:!?()[\]{}"']+/)) {
      if (word.length >= 4) keywords.add(word);
    }
  }
  for (const thread of workContext.activeThreads) {
    for (const word of thread.subject.toLowerCase().split(/[\s/\-_,;:!?()[\]{}"']+/)) {
      if (word.length >= 4) keywords.add(word);
    }
  }
  for (const tool of workContext.toolDomains) {
    keywords.add(tool.tool.toLowerCase());
  }

  // Score each skill by keyword overlap
  const scored = skillCatalog.map((skill) => {
    const searchText =
      `${skill.name} ${skill.description} ${(skill.tags || []).join(" ")}`.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) score++;
    }
    return { skill, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ skill, score }) => ({
      skillId: skill.id,
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      category: skill.category,
      hoursSaved: skill.hoursSaved,
      totalUses: skill.totalUses,
      averageRating: skill.averageRating,
      matchedCategories: [],
      projectedWeeklySavings: Math.min(score * 0.5, 4),
      personalizedReason: "Keyword match based on your work topics",
    }));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate personalized skill recommendations based on work activity.
 *
 * @param userId - Current user ID
 * @param tenantId - Current tenant ID
 * @param workContext - Work context extracted from email metadata
 * @returns Top 5-8 skill recommendations ranked by projected time savings
 */
export async function generateSkillRecommendations(
  userId: string,
  _tenantId: string,
  workContext: WorkContext
): Promise<SkillRecommendation[]> {
  // 1. Fetch all published skills from DB
  const publishedSkills = await db!
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      description: skills.description,
      category: skills.category,
      tags: skills.tags,
      totalUses: skills.totalUses,
      averageRating: skills.averageRating,
      hoursSaved: skills.hoursSaved,
    })
    .from(skills)
    .where(eq(skills.status, "published"));

  if (publishedSkills.length === 0) {
    return [];
  }

  // 2. Check if we have meaningful work signals
  const hasWorkSignals =
    workContext.uniqueSentSubjects.length > 0 ||
    workContext.activeThreads.length > 0 ||
    workContext.toolDomains.length > 0;

  if (!hasWorkSignals) {
    return [];
  }

  // 3. Try AI matching, fall back to keyword matching
  let aiMatches: AIMatchResult[] | null = null;
  try {
    aiMatches = await matchSkillsWithAI(publishedSkills, workContext);
  } catch (error) {
    console.warn("AI skill matching failed, using keyword fallback:", error);
    return fallbackKeywordMatch(publishedSkills, workContext);
  }

  // 4. Hydrate AI matches with full skill data
  const skillMap = new Map(publishedSkills.map((s) => [s.id, s]));
  const recommendations: SkillRecommendation[] = [];

  for (const match of aiMatches) {
    const skill = skillMap.get(match.skillId);
    if (!skill) continue;

    recommendations.push({
      skillId: skill.id,
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      category: skill.category,
      hoursSaved: skill.hoursSaved,
      totalUses: skill.totalUses,
      averageRating: skill.averageRating,
      matchedCategories: [],
      projectedWeeklySavings: match.estimatedWeeklySavings,
      personalizedReason: match.matchReason,
    });
  }

  return recommendations
    .sort((a, b) => b.projectedWeeklySavings - a.projectedWeeklySavings)
    .slice(0, 8);
}
