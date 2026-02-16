"use server";

import { auth } from "@/auth";
import { generateEmbedding } from "@/lib/ollama";
import { classifyQuery, type RouteType } from "@/lib/query-classifier";
import {
  getSiteSettings,
  hybridSearchSkills,
  keywordSearchSkills,
  getOrCreateUserPreferences,
  logSearchQuery,
  type HybridSearchResult,
} from "@everyskill/db";

const PREFERENCE_BOOST = 1.3;

export interface DiscoveryResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  totalUses: number;
  averageRating: number | null;
  matchRationale: string;
  matchType: "keyword" | "semantic" | "both";
  rrfScore: number;
  isBoosted: boolean;
}

function generateRationale(
  ftRank: number | null,
  smRank: number | null,
  query: string
): {
  rationale: string;
  matchType: "keyword" | "semantic" | "both";
} {
  if (ftRank != null && smRank != null) {
    return {
      rationale: `Matches your search terms and is semantically related to "${query}"`,
      matchType: "both",
    };
  }
  if (ftRank != null) {
    return {
      rationale: `Contains keywords matching "${query}"`,
      matchType: "keyword",
    };
  }
  return {
    rationale: `Semantically similar to what you're looking for`,
    matchType: "semantic",
  };
}

function applyPreferenceBoost(
  results: (HybridSearchResult & {
    matchRationale: string;
    matchType: "keyword" | "semantic" | "both";
  })[],
  preferredCategories: string[]
): DiscoveryResult[] {
  const boosted = results.map((r) => {
    const isBoosted = preferredCategories.includes(r.category);
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      category: r.category,
      totalUses: r.totalUses,
      averageRating: r.averageRating,
      matchRationale: r.matchRationale,
      matchType: r.matchType,
      rrfScore: isBoosted ? r.rrfScore * PREFERENCE_BOOST : r.rrfScore,
      isBoosted,
    };
  });
  boosted.sort((a, b) => b.rrfScore - a.rrfScore);
  return boosted;
}

/**
 * Discover skills using hybrid search (semantic + full-text + RRF).
 * Falls back to keyword-only if Ollama is unavailable.
 * Applies preference boost for user's preferred categories.
 *
 * Returns top results (default 3) with match rationale.
 */
export async function discoverSkills(query: string, limit = 3): Promise<DiscoveryResult[]> {
  if (!query || !query.trim()) return [];

  const trimmed = query.trim();
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;
  const tenantId = session.user.tenantId;
  if (!tenantId) return [];

  // 1. Classify query to determine optimal route
  const classification = classifyQuery(trimmed);
  let actualRouteType: RouteType = classification.routeType;

  // Check semantic search availability (Pitfall 4)
  const settings = await getSiteSettings();
  const semanticEnabled = settings?.semanticSimilarityEnabled ?? false;

  // Downgrade semantic/hybrid to keyword when embeddings unavailable
  if (!semanticEnabled && (actualRouteType === "semantic" || actualRouteType === "hybrid")) {
    actualRouteType = "keyword";
  }

  // 2. Route to optimal search backend
  const fetchLimit = limit + 5; // fetch extra for post-boost reranking
  let rawResults: HybridSearchResult[];

  if (actualRouteType === "keyword") {
    // ROUTE-02: Keyword queries skip embedding generation
    rawResults = await keywordSearchSkills({
      query: trimmed,
      userId,
      limit: fetchLimit,
    });

    // ROUTE-04: Zero-result keyword searches fall back to hybrid
    if (rawResults.length === 0 && semanticEnabled && settings) {
      try {
        const embedding = await generateEmbedding(trimmed, {
          url: settings.ollamaUrl,
          model: settings.ollamaModel,
        });
        if (embedding) {
          rawResults = await hybridSearchSkills({
            query: trimmed,
            queryEmbedding: embedding,
            userId,
            limit: fetchLimit,
          });
          actualRouteType = "hybrid"; // Track fallback
        }
      } catch {
        // Embedding failed during fallback -- stay with keyword zero results
      }
    }
  } else {
    // Semantic or hybrid route: generate embedding
    let queryEmbedding: number[] | null = null;
    if (settings) {
      try {
        queryEmbedding = await generateEmbedding(trimmed, {
          url: settings.ollamaUrl,
          model: settings.ollamaModel,
        });
      } catch {
        // Embedding failed -- fall back to keyword
      }
    }

    if (queryEmbedding) {
      // Use hybrid for both semantic and hybrid routes in discover
      // (hybrid includes keyword + semantic, better coverage for discovery)
      rawResults = await hybridSearchSkills({
        query: trimmed,
        queryEmbedding,
        userId,
        limit: fetchLimit,
      });

      // If hybrid returned nothing, fall back to keyword
      if (rawResults.length === 0) {
        rawResults = await keywordSearchSkills({
          query: trimmed,
          userId,
          limit: fetchLimit,
        });
        actualRouteType = "keyword"; // Track fallback
      }
    } else {
      // Embedding generation failed -- fall back to keyword
      rawResults = await keywordSearchSkills({
        query: trimmed,
        userId,
        limit: fetchLimit,
      });
      actualRouteType = "keyword"; // Track fallback
    }
  }

  if (rawResults.length === 0) return [];

  // 3. Generate rationale for each result
  const withRationale = rawResults.map((r) => {
    const { rationale, matchType } = generateRationale(r.ftRank, r.smRank, trimmed);
    return { ...r, matchRationale: rationale, matchType };
  });

  // 4. Apply preference boost
  let preferredCategories: string[] = [];
  if (userId) {
    try {
      const prefs = await getOrCreateUserPreferences(userId, tenantId);
      preferredCategories = prefs?.preferredCategories ?? [];
    } catch {
      // Preferences unavailable -- no boost
    }
  }

  const finalResults = applyPreferenceBoost(withRationale, preferredCategories);

  // 5. Log search query (fire-and-forget)
  logSearchQuery({
    tenantId,
    userId,
    query: trimmed,
    normalizedQuery: trimmed.toLowerCase(),
    resultCount: finalResults.length,
    searchType: "discover",
    routeType: actualRouteType,
  }).catch(() => {});

  // 6. Return top N
  return finalResults.slice(0, limit);
}
