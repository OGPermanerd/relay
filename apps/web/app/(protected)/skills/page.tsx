import { auth } from "@/auth";
import { searchSkills } from "@/lib/search-skills";
import { getUsageTrends } from "@/lib/usage-trends";
import { getLeaderboard } from "@/lib/leaderboard";
import { logSearchQuery } from "@everyskill/db";
import { TwoPanelLayout } from "@/components/two-panel-layout";
import { SkillsTable } from "@/components/skills-table";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { SearchWithDropdown } from "@/components/search-with-dropdown";
import { SkillTypeFilter } from "@/components/skill-type-filter";
import { getCategoriesToFilter } from "@/lib/skill-type-utils";
import { EmptyState } from "@/components/empty-state";
import { ClearFiltersButton } from "./clear-filters-button";

interface SkillsPageProps {
  searchParams: Promise<{
    q?: string;
    sortBy?: string;
    author?: string;
    type?: string;
  }>;
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const params = await searchParams;

  // Parse search parameters
  const query = params.q || "";
  const sortBy = params.sortBy as "uses" | "quality" | "rating" | "days_saved" | undefined;
  const authorId = params.author || undefined;
  const categories = getCategoriesToFilter(params.type);

  // Get session for visibility filtering
  const session = await auth();

  // Fetch skills and leaderboard
  const [skills, contributors] = await Promise.all([
    searchSkills({ query, sortBy, authorId, categories, userId: session?.user?.id }),
    getLeaderboard(10),
  ]);

  // Log browse search query (fire-and-forget, only when user actually searched)
  if (query && session?.user?.id && session.user.tenantId) {
    logSearchQuery({
      tenantId: session.user.tenantId,
      userId: session.user.id,
      query,
      normalizedQuery: query.toLowerCase().trim(),
      resultCount: skills.length,
      searchType: "browse",
    }).catch(() => {});
  }

  // Fetch usage trends for sparklines (batched query)
  const skillIds = skills.map((s) => s.id);
  const usageTrends = await getUsageTrends(skillIds);

  // Determine empty state type
  const hasFilters = query || authorId || categories;
  const emptyStateType = skills.length === 0 ? (hasFilters ? "no-results" : "no-skills") : null;

  return (
    <>
      {/* Search bar and filters */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchWithDropdown mode="filter" initialQuery={query} />
          </div>
          <SkillTypeFilter />
        </div>
      </div>

      {/* Two-panel layout with skills table and leaderboard */}
      <TwoPanelLayout
        left={
          emptyStateType ? (
            <>
              <EmptyState type={emptyStateType} query={query} />
              {hasFilters && <ClearFiltersButton />}
            </>
          ) : (
            <SkillsTable
              skills={skills.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
              usageTrends={usageTrends}
            />
          )
        }
        right={<LeaderboardTable contributors={contributors} />}
      />
    </>
  );
}
