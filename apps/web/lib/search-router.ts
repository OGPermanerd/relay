/**
 * Search router — dispatches queries to the optimal retrieval strategy.
 *
 * Uses classifyQuery() to determine the route, then delegates to the
 * appropriate search backend (keyword, semantic, or hybrid). Handles
 * fallback logic: keyword queries that return zero results automatically
 * fall back to hybrid search (ROUTE-04).
 *
 * Embedding generation is centralized here to avoid double-generation
 * when falling back between routes (Pitfall 2).
 */

import { classifyQuery, type RouteType } from "./query-classifier";
import { generateEmbedding, type OllamaEmbedConfig } from "./ollama";
import {
  hybridSearchSkills,
  keywordSearchSkills,
  semanticSearchSkills,
  getSiteSettings,
  type HybridSearchResult,
  type SemanticSearchResult,
} from "@everyskill/db";

export interface RouteResult<T> {
  results: T[];
  routeType: RouteType;
  fellBack: boolean;
  classificationReason: string;
}

export interface RouteSearchParams {
  userId?: string;
  limit?: number;
}

/**
 * Route a search query to the optimal backend and return results.
 *
 * Handles:
 * - Route classification via pure-function heuristics
 * - Semantic/hybrid downgrade when embeddings are disabled
 * - Keyword-to-hybrid fallback on zero results (ROUTE-04)
 * - Semantic-to-hybrid fallback on zero results
 * - Centralized embedding generation (avoids double-generation)
 */
export async function routeSearch(
  query: string,
  params: RouteSearchParams
): Promise<RouteResult<HybridSearchResult | SemanticSearchResult>> {
  const classification = classifyQuery(query);
  let routeType = classification.routeType;

  const { userId, limit = 10 } = params;

  // Check if semantic search is available
  const settings = await getSiteSettings();
  const semanticEnabled = settings?.semanticSimilarityEnabled ?? false;

  // Downgrade semantic/hybrid to keyword when embeddings are unavailable (Pitfall 4)
  if (!semanticEnabled && (routeType === "semantic" || routeType === "hybrid")) {
    routeType = "keyword";
  }

  // Browse route: return empty results — caller handles browse UI
  if (routeType === "browse") {
    return {
      results: [],
      routeType: "browse",
      fellBack: false,
      classificationReason: classification.reason,
    };
  }

  // Keyword route
  if (routeType === "keyword") {
    const results = await keywordSearchSkills({ query, userId, limit });

    // ROUTE-04: Fall back to hybrid on zero results
    if (results.length === 0 && semanticEnabled && settings) {
      const embedding = await generateEmbedding(query, {
        url: settings.ollamaUrl,
        model: settings.ollamaModel,
      } as OllamaEmbedConfig);

      if (embedding) {
        const hybridResults = await hybridSearchSkills({
          query,
          queryEmbedding: embedding,
          userId,
          limit,
        });
        return {
          results: hybridResults,
          routeType: "hybrid",
          fellBack: true,
          classificationReason: classification.reason,
        };
      }
    }

    return {
      results,
      routeType: "keyword",
      fellBack: false,
      classificationReason: classification.reason,
    };
  }

  // Generate embedding once for semantic and hybrid routes
  let embedding: number[] | null = null;
  if (settings) {
    embedding = await generateEmbedding(query, {
      url: settings.ollamaUrl,
      model: settings.ollamaModel,
    } as OllamaEmbedConfig);
  }

  // Semantic route
  if (routeType === "semantic") {
    if (embedding) {
      const results = await semanticSearchSkills({
        queryEmbedding: embedding,
        userId,
        limit,
      });

      // Fall back to hybrid on zero results (embedding already computed)
      if (results.length === 0) {
        const hybridResults = await hybridSearchSkills({
          query,
          queryEmbedding: embedding,
          userId,
          limit,
        });
        return {
          results: hybridResults,
          routeType: "hybrid",
          fellBack: true,
          classificationReason: classification.reason,
        };
      }

      return {
        results,
        routeType: "semantic",
        fellBack: false,
        classificationReason: classification.reason,
      };
    }

    // Embedding generation failed — fall back to keyword
    const keywordResults = await keywordSearchSkills({ query, userId, limit });
    return {
      results: keywordResults,
      routeType: "keyword",
      fellBack: true,
      classificationReason: classification.reason,
    };
  }

  // Hybrid route
  if (embedding) {
    const results = await hybridSearchSkills({
      query,
      queryEmbedding: embedding,
      userId,
      limit,
    });
    return {
      results,
      routeType: "hybrid",
      fellBack: false,
      classificationReason: classification.reason,
    };
  }

  // Embedding generation failed — fall back to keyword
  const keywordResults = await keywordSearchSkills({ query, userId, limit });
  return {
    results: keywordResults,
    routeType: "keyword",
    fellBack: true,
    classificationReason: classification.reason,
  };
}
