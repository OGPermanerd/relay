import { searchSkillsByQuery } from "@everyskill/db/services/search-skills";
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
  const results = await searchSkillsByQuery({
    query,
    category,
    limit,
    tenantId: tenantId ?? undefined,
    userId,
  });

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
