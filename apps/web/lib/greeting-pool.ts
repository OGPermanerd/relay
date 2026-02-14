import Anthropic from "@anthropic-ai/sdk";
import { db, userPreferences, DEFAULT_TENANT_ID } from "@everyskill/db";
import { eq } from "drizzle-orm";

const GREETING_MODEL = "claude-haiku-4-5-20251001";

const POOL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const FALLBACK_GREETINGS = [
  "Level up",
  "Tool up",
  "Get mad skills",
  "Power move time",
  "Skill check",
  "Unleash potential",
  "Boost your game",
  "Stack those skills",
  "Rise and grind",
  "Go time",
  "Sharpen up",
  "Elevate",
  "Gear up",
  "Own the day",
  "Flex time",
];

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickGreeting(pool: string[], userId: string, firstName: string): string {
  const dayIndex = Math.floor(Date.now() / 86400000);
  const index = (dayIndex + simpleHash(userId)) % pool.length;
  return `${pool[index]}, ${firstName}!`;
}

async function generateGreetingPool(context: {
  skillsCreated: number;
  totalUses: number;
  totalHoursSaved: number;
  categories: string[];
}): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const contextDescription = [
    `Skills created: ${context.skillsCreated}`,
    `Total uses across their skills: ${context.totalUses}`,
    `Total hours saved: ${context.totalHoursSaved}`,
    context.categories.length > 0 ? `Active categories: ${context.categories.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  const response = await client.messages.create({
    model: GREETING_MODEL,
    max_tokens: 512,
    system: `You generate short, fun greeting phrases for a skills platform called EverySkill. Each phrase precedes a user's first name, like "Level up, Trevor!" or "Go time, Sarah!". The phrases should be energetic, motivational, and skill/productivity themed. Output ONLY a JSON array of exactly 20 unique greeting strings. No other text.`,
    messages: [
      {
        role: "user",
        content: `Generate 20 fun, unique greeting phrases for an EverySkill user. Here is context about them for personalization: ${contextDescription}. Remember: output ONLY a JSON array of 20 short greeting strings (2-4 words each, no name appended). Example style: "Level up", "Tool up", "Get mad skills", "Power move time".`,
      },
    ],
  });

  // Extract text content from the response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  const text = textBlock.text.trim();

  // Try to parse JSON array from the response
  // The model might wrap it in markdown code fences, so strip those
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  // Ensure all items are strings
  const greetings = parsed.filter((item): item is string => typeof item === "string");
  if (greetings.length === 0) return null;

  return greetings;
}

async function loadOrRefreshPool(
  userId: string,
  context: {
    skillsCreated: number;
    totalUses: number;
    totalHoursSaved: number;
    categories: string[];
  }
): Promise<string[]> {
  if (!db) return FALLBACK_GREETINGS;

  // Check existing pool
  const [row] = await db
    .select({
      greetingPool: userPreferences.greetingPool,
      greetingPoolGeneratedAt: userPreferences.greetingPoolGeneratedAt,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));

  // If pool exists and is fresh (< 24 hours), use it
  if (row?.greetingPool && row.greetingPoolGeneratedAt) {
    const age = Date.now() - new Date(row.greetingPoolGeneratedAt).getTime();
    if (age < POOL_TTL_MS) {
      return row.greetingPool as string[];
    }
  }

  // Generate new pool via Anthropic
  try {
    const newPool = await generateGreetingPool(context);
    if (!newPool) return FALLBACK_GREETINGS;

    const now = new Date();

    // Upsert the pool into user_preferences
    await db
      .insert(userPreferences)
      .values({
        userId,
        tenantId: DEFAULT_TENANT_ID,
        preferences: {} as never,
        greetingPool: newPool,
        greetingPoolGeneratedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          greetingPool: newPool,
          greetingPoolGeneratedAt: now,
          updatedAt: now,
        },
      });

    return newPool;
  } catch (error) {
    console.error("[greeting-pool] Failed to generate greeting pool:", error);
    return FALLBACK_GREETINGS;
  }
}

/**
 * Get a personalized greeting for a user.
 *
 * Returns a string like "Level up, Trevor!" that is consistent for the same
 * user on the same day. Generates a pool of 20 greetings via AI, cached for
 * 24 hours in the user_preferences table. Falls back to a static pool on
 * API failure.
 */
export async function getGreeting(
  userId: string,
  firstName: string,
  context: {
    skillsCreated: number;
    totalUses: number;
    totalHoursSaved: number;
    categories: string[];
  }
): Promise<string> {
  try {
    const pool = await loadOrRefreshPool(userId, context);
    return pickGreeting(pool, userId, firstName);
  } catch (error) {
    console.error("[greeting-pool] Unexpected error:", error);
    return pickGreeting(FALLBACK_GREETINGS, userId, firstName);
  }
}
