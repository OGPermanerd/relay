"use server";

import { auth } from "@/auth";
import { searchSkills } from "@/lib/search-skills";
import { classifyQuery } from "@/lib/query-classifier";
import { logSearchQuery } from "@everyskill/db";

export interface QuickSearchResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
}

/**
 * Quick search action for the live search dropdown.
 * Returns up to 10 minimal results for fast rendering.
 */
export async function quickSearch(query: string): Promise<QuickSearchResult[]> {
  if (!query || !query.trim()) {
    return [];
  }

  const session = await auth();
  const tenantId = session?.user?.tenantId ?? "default-tenant-000-0000-000000000000";
  const results = await searchSkills({ query: query.trim(), userId: session?.user?.id });

  const mapped = results.slice(0, 10).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description.length > 100 ? s.description.slice(0, 100) + "..." : s.description,
    category: s.category,
  }));

  // Classify query for route logging
  const trimmed = query.trim();
  const classification = classifyQuery(trimmed);

  // Log search query (fire-and-forget)
  logSearchQuery({
    tenantId,
    userId: session?.user?.id ?? null,
    query: trimmed,
    normalizedQuery: trimmed.toLowerCase(),
    resultCount: mapped.length,
    searchType: "quick",
    routeType: classification.routeType,
  }).catch(() => {});

  return mapped;
}
