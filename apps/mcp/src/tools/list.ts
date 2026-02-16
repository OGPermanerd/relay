import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema/skills";
import { eq, and, desc } from "drizzle-orm";
import { buildVisibilityFilter } from "@everyskill/db/lib/visibility";
import { getOrCreateUserPreferences } from "@everyskill/db/services/user-preferences";
import { trackUsage } from "../tracking/events.js";
import { getTenantId, shouldNudge, incrementAnonymousCount, getFirstAuthMessage } from "../auth.js";

export async function handleListSkills({
  category,
  limit,
  userId,
  skipNudge,
}: {
  category?: string;
  limit: number;
  userId?: string;
  skipNudge?: boolean;
}) {
  if (!db) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: "Database not configured" }),
        },
      ],
      isError: true,
    };
  }

  const tenantId = getTenantId();

  // Build DB-level conditions: published + visibility + optional tenant/category
  const conditions = [eq(skills.status, "published"), buildVisibilityFilter(userId)];

  if (tenantId) {
    conditions.push(eq(skills.tenantId, tenantId));
  }

  if (category) {
    conditions.push(eq(skills.category, category));
  }

  // Resolve sort preference for authenticated users
  let sortColumn = desc(skills.hoursSaved); // default: days_saved
  if (userId && tenantId) {
    try {
      const prefs = await getOrCreateUserPreferences(userId, tenantId);
      const defaultSort = prefs?.defaultSort ?? "days_saved";
      switch (defaultSort) {
        case "uses":
          sortColumn = desc(skills.totalUses);
          break;
        case "quality":
        case "rating":
          sortColumn = desc(skills.averageRating);
          break;
        case "days_saved":
        default:
          sortColumn = desc(skills.hoursSaved);
          break;
      }
    } catch {
      // Preference failure must not break list — keep default sort
    }
  }

  const results = await db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
      category: skills.category,
      hoursSaved: skills.hoursSaved,
    })
    .from(skills)
    .where(and(...conditions))
    .orderBy(sortColumn)
    .limit(limit);

  if (!userId && !skipNudge) {
    incrementAnonymousCount();
  }

  await trackUsage({
    toolName: "list_skills",
    userId,
    metadata: { category, limit, resultCount: results.length },
  });

  const content: Array<{ type: "text"; text: string }> = [
    {
      type: "text" as const,
      text: JSON.stringify(
        {
          count: results.length,
          skills: results,
        },
        null,
        2
      ),
    },
  ];

  if (!skipNudge) {
    const firstAuthMsg = getFirstAuthMessage();
    if (firstAuthMsg) {
      content.push({ type: "text" as const, text: firstAuthMsg });
    }

    if (shouldNudge()) {
      content.push({
        type: "text" as const,
        text: "Tip: Set EVERYSKILL_API_KEY to track your usage and unlock analytics.",
      });
    }
  }

  return { content };
}
