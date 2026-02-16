import { searchSkillsByQuery } from "@everyskill/db/services/search-skills";
import { getOrCreateUserPreferences } from "@everyskill/db/services/user-preferences";
import { trackUsage } from "../tracking/events.js";
import { getTenantId, shouldNudge, incrementAnonymousCount, getFirstAuthMessage } from "../auth.js";

export async function handleSearchSkills({
  query,
  category,
  limit,
  userId,
  skipNudge,
}: {
  query: string;
  category?: string;
  limit: number;
  userId?: string;
  skipNudge?: boolean;
}) {
  const tenantId = getTenantId();
  let results = await searchSkillsByQuery({
    query,
    category,
    limit,
    tenantId: tenantId ?? undefined,
    userId,
  });

  // Apply preference-based reranking for authenticated users
  if (userId && tenantId) {
    try {
      const prefs = await getOrCreateUserPreferences(userId, tenantId);
      const preferred: string[] = prefs?.preferredCategories ?? [];
      if (preferred.length > 0) {
        const tagged = results.map((r) => ({
          ...r,
          isBoosted: preferred.includes(r.category),
        }));
        tagged.sort((a, b) => {
          if (a.isBoosted && !b.isBoosted) return -1;
          if (!a.isBoosted && b.isBoosted) return 1;
          return 0;
        });
        results = tagged;
      }
    } catch {
      // Preference failure must not break search
    }
  }

  if (!userId && !skipNudge) {
    incrementAnonymousCount();
  }

  await trackUsage({
    toolName: "search_skills",
    userId,
    metadata: { query, category, resultCount: results.length },
  });

  const enriched = results.map((r) => ({
    ...r,
    displayRating: r.averageRating !== null ? (r.averageRating / 100).toFixed(1) : null,
  }));

  const content: Array<{ type: "text"; text: string }> = [
    {
      type: "text" as const,
      text: JSON.stringify(
        {
          query,
          count: results.length,
          skills: enriched,
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
