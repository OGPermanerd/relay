import { searchSkills, getAvailableTags } from "@/lib/search-skills";
import { getUsageTrends } from "@/lib/usage-trends";
import { SkillList } from "@/components/skill-list";
import { SearchInput } from "@/components/search-input";
import { CategoryFilter } from "@/components/category-filter";
import { TagFilter } from "@/components/tag-filter";
import { EmptyState } from "@/components/empty-state";
import { ClearFiltersButton } from "./clear-filters-button";

interface SkillsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    tags?: string;
  }>;
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const params = await searchParams;

  // Parse search parameters
  const query = params.q || "";
  const category = params.category || undefined;
  const tags = params.tags ? params.tags.split(",") : [];

  // Fetch skills and available tags
  const [skills, availableTags] = await Promise.all([
    searchSkills({ query, category, tags }),
    getAvailableTags(),
  ]);

  // Fetch usage trends for sparklines (batched query)
  const skillIds = skills.map((s) => s.id);
  const usageTrends = await getUsageTrends(skillIds);

  // Determine empty state type
  const hasFilters = query || category || tags.length > 0;
  const emptyStateType =
    skills.length === 0
      ? hasFilters
        ? category && !query
          ? "empty-category"
          : "no-results"
        : "no-skills"
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Browse Skills</h1>
        <p className="mt-1 text-gray-600">Discover skills shared by your colleagues</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <SearchInput />
        <CategoryFilter />
        {availableTags.length > 0 && <TagFilter availableTags={availableTags} />}
      </div>

      {/* Results count */}
      {skills.length > 0 && (
        <p className="mb-4 text-sm text-gray-500">
          {skills.length} skill{skills.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Skills grid or empty state */}
      {emptyStateType ? (
        <EmptyState type={emptyStateType} query={query} category={category} />
      ) : (
        <SkillList skills={skills} usageTrends={usageTrends} />
      )}

      {/* Clear filters (client component) */}
      {hasFilters && skills.length === 0 && <ClearFiltersButton />}
    </div>
  );
}
