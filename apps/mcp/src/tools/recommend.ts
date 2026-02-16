import { semanticSearchSkills } from "@everyskill/db/services/semantic-search";
import { searchSkillsByQuery } from "@everyskill/db/services/search-skills";
import { getOrCreateUserPreferences } from "@everyskill/db/services/user-preferences";
import { generateEmbedding, OLLAMA_DEFAULTS } from "../lib/ollama.js";
import { trackUsage } from "../tracking/events.js";
import { getTenantId, shouldNudge, incrementAnonymousCount, getFirstAuthMessage } from "../auth.js";

const PREFERENCE_BOOST = 1.3;

export async function handleRecommendSkills({
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

  let results: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    totalUses: number;
    averageRating: number | null;
    similarity?: number;
  }> = [];
  let searchMethod: "semantic" | "text" = "text";

  // Try semantic search first
  const embedding = await generateEmbedding(query, OLLAMA_DEFAULTS);
  if (embedding) {
    const semanticResults = await semanticSearchSkills({
      queryEmbedding: embedding,
      limit,
      category,
      tenantId: tenantId ?? undefined,
      userId,
    });

    if (semanticResults.length > 0) {
      results = semanticResults;
      searchMethod = "semantic";
    }
  }

  // Fallback to ILIKE text search if embedding failed or no semantic results
  if (results.length === 0) {
    results = await searchSkillsByQuery({
      query,
      category,
      limit,
      tenantId: tenantId ?? undefined,
      userId,
    });
    searchMethod = "text";
  }

  // Apply preference boost for authenticated users
  if (userId && tenantId) {
    try {
      const prefs = await getOrCreateUserPreferences(userId, tenantId);
      const preferred: string[] = prefs?.preferredCategories ?? [];
      if (preferred.length > 0) {
        if (searchMethod === "semantic") {
          // Multiply similarity score for preferred categories, then re-sort
          results = results.map((r) => ({
            ...r,
            similarity:
              preferred.includes(r.category) && r.similarity
                ? r.similarity * PREFERENCE_BOOST
                : r.similarity,
          }));
          results.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
        } else {
          // Text fallback: stable reranking (same as search.ts)
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
      }
    } catch {
      // Preference failure must not break recommend
    }
  }

  if (!userId && !skipNudge) {
    incrementAnonymousCount();
  }

  await trackUsage({
    toolName: "recommend_skills",
    userId,
    metadata: { query, category, searchMethod, resultCount: results.length },
  });

  const content: Array<{ type: "text"; text: string }> = [
    {
      type: "text" as const,
      text: JSON.stringify(
        {
          query,
          searchMethod,
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
