"use server";

import { auth } from "@/auth";
import { searchSkills } from "@/lib/search-skills";

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
  const results = await searchSkills({ query: query.trim(), userId: session?.user?.id });

  return results.slice(0, 10).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description.length > 100 ? s.description.slice(0, 100) + "..." : s.description,
    category: s.category,
  }));
}
