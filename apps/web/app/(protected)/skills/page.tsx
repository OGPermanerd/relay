import { searchSkills, getAvailableTags } from "@/lib/search-skills";
import { getUsageTrends } from "@/lib/usage-trends";
import { getLeaderboard } from "@/lib/leaderboard";
import { TwoPanelLayout } from "@/components/two-panel-layout";
import { SkillsTable } from "@/components/skills-table";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { SearchInput } from "@/components/search-input";
import { CategoryFilter } from "@/components/category-filter";
import { TagFilter } from "@/components/tag-filter";
import { QualityFilter } from "@/components/quality-filter";
import { SortDropdown } from "@/components/sort-dropdown";
import { EmptyState } from "@/components/empty-state";
import { ClearFiltersButton } from "./clear-filters-button";
import { AuthorFilterChip } from "@/components/author-filter-chip";

interface SkillsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    tags?: string;
    qualityTier?: string;
    sortBy?: string;
    author?: string;
  }>;
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const params = await searchParams;

  // Parse search parameters
  const query = params.q || "";
  const category = params.category || undefined;
  const tags = params.tags ? params.tags.split(",") : [];
  const qualityTier = params.qualityTier as "gold" | "silver" | "bronze" | undefined;
  const sortBy = params.sortBy as "uses" | "quality" | "rating" | "days_saved" | undefined;
  const authorId = params.author || undefined;

  // Fetch skills, available tags, and leaderboard
  const [skills, availableTags, contributors] = await Promise.all([
    searchSkills({ query, category, tags, qualityTier, sortBy, authorId }),
    getAvailableTags(),
    getLeaderboard(10),
  ]);

  // Find author name for chip display
  const activeAuthorName = authorId
    ? contributors.find((c) => c.userId === authorId)?.name || "Unknown"
    : null;

  // Fetch usage trends for sparklines (batched query)
  const skillIds = skills.map((s) => s.id);
  const usageTrends = await getUsageTrends(skillIds);

  // Determine empty state type
  const hasFilters = query || category || tags.length > 0 || qualityTier || authorId;
  const emptyStateType =
    skills.length === 0
      ? hasFilters
        ? category && !query
          ? "empty-category"
          : "no-results"
        : "no-skills"
      : null;

  return (
    <>
      {/* Header and Filters - outside TwoPanelLayout for full-width appearance */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Browse Skills</h1>
          <p className="mt-1 text-gray-600">Discover skills shared by your colleagues</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <SearchInput />
          <div className="flex flex-wrap items-center gap-4">
            <CategoryFilter />
            <QualityFilter />
            <SortDropdown />
          </div>
          {availableTags.length > 0 && <TagFilter availableTags={availableTags} />}
          {authorId && activeAuthorName && <AuthorFilterChip authorName={activeAuthorName} />}
        </div>
      </div>

      {/* Two-panel layout with skills table and leaderboard */}
      <TwoPanelLayout
        left={
          <>
            {/* Results count */}
            {skills.length > 0 && (
              <p className="mb-4 text-sm text-gray-500">
                {skills.length} skill{skills.length !== 1 ? "s" : ""} found
              </p>
            )}

            {emptyStateType ? (
              <EmptyState type={emptyStateType} query={query} category={category} />
            ) : (
              <SkillsTable skills={skills} usageTrends={usageTrends} />
            )}

            {/* Clear filters (client component) */}
            {hasFilters && skills.length === 0 && <ClearFiltersButton />}
          </>
        }
        right={
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Contributors</h2>
            <LeaderboardTable contributors={contributors} />
          </div>
        }
      />
    </>
  );
}
