"use server";

import { auth } from "@/auth";
import { generateEmbedding } from "@/lib/ollama";
import {
  getSiteSettings,
  hybridSearchSkills,
  keywordSearchSkills,
  getOrCreateUserPreferences,
  type HybridSearchResult,
} from "@everyskill/db";

const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";
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
  const userId = session?.user?.id;
  const tenantId = session?.user?.tenantId ?? DEFAULT_TENANT_ID;

  // 1. Try to get query embedding for semantic search
  let queryEmbedding: number[] | null = null;
  try {
    const settings = await getSiteSettings();
    if (settings?.semanticSimilarityEnabled) {
      queryEmbedding = await generateEmbedding(trimmed, {
        url: settings.ollamaUrl,
        model: settings.ollamaModel,
      });
    }
  } catch {
    // Embedding failed -- will fall back to keyword-only
  }

  // 2. Run hybrid or keyword-only search
  let rawResults: HybridSearchResult[];
  if (queryEmbedding) {
    rawResults = await hybridSearchSkills({
      query: trimmed,
      queryEmbedding,
      userId,
      limit: limit + 5, // fetch extra for post-boost reranking
    });

    // If hybrid returned nothing, fall back to keyword
    if (rawResults.length === 0) {
      rawResults = await keywordSearchSkills({
        query: trimmed,
        userId,
        limit: limit + 5,
      });
    }
  } else {
    rawResults = await keywordSearchSkills({
      query: trimmed,
      userId,
      limit: limit + 5,
    });
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

  // 5. Return top N
  return finalResults.slice(0, limit);
}
