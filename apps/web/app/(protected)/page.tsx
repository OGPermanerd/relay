import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DEFAULT_TENANT_ID } from "@everyskill/db";
import { getPlatformStats } from "@/lib/platform-stats";
import { getTrendingSkills } from "@/lib/trending";
import { getCompanyApprovedSkills } from "@/lib/company-approved";
import { getLeaderboard } from "@/lib/leaderboard";
import { getSkillsUsedStats, getSkillsCreatedStats } from "@/lib/my-leverage";
import { getCategoryCounts } from "@/lib/category-counts";
import { getGreeting } from "@/lib/greeting-pool";
import { FTE_HOURS_PER_YEAR } from "@/lib/constants";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { TrendingSection } from "@/components/trending-section";
import { CompanyApprovedSection } from "@/components/company-approved-section";
import { DiscoverySearch } from "@/components/discovery-results";
import { CategoryTiles } from "@/components/category-tiles";
import { CompactStatsBar } from "@/components/compact-stats-bar";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;
  const tenantId = user.tenantId ?? DEFAULT_TENANT_ID;
  const firstName = user.name?.split(" ")[0] || "there";

  // Fetch all data in parallel
  const [
    stats,
    trending,
    leaderboard,
    skillsUsedStats,
    skillsCreatedStats,
    companyApproved,
    categoryCounts,
  ] = await Promise.all([
    getPlatformStats(),
    getTrendingSkills(6),
    getLeaderboard(5),
    getSkillsUsedStats(user.id!),
    getSkillsCreatedStats(user.id!),
    getCompanyApprovedSkills(6),
    getCategoryCounts(),
  ]);

  // Generate personalized greeting (uses cached pool, regenerates daily)
  const greeting = await getGreeting(
    user.id!,
    firstName,
    {
      skillsCreated: skillsCreatedStats.skillsPublished,
      totalUses: skillsUsedStats.totalActions,
      totalHoursSaved: skillsUsedStats.totalHoursSaved + skillsCreatedStats.hoursSavedByOthers,
      categories: [],
    },
    tenantId
  );

  // Calculate combined FTE years for the "Your Impact" row in leaderboard
  const totalHoursSaved = skillsUsedStats.totalHoursSaved + skillsCreatedStats.hoursSavedByOthers;
  const fteYearsSaved = totalHoursSaved / FTE_HOURS_PER_YEAR;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{greeting}</h1>
      </div>

      {/* CTAs — compact inline row */}
      <div className="mb-6 flex gap-3">
        <Link
          href="/skills/new"
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-100"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Share a Skill
        </Link>
        <Link
          href="/skills"
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          Find a Skill
        </Link>
      </div>

      {/* Compact Stats Bar — moved above search */}
      <div className="mb-6">
        <CompactStatsBar stats={stats} />
      </div>

      {/* Discovery Search */}
      <div className="mb-8">
        <DiscoverySearch />
      </div>

      {/* Category Tiles */}
      <div className="mb-8">
        <CategoryTiles counts={categoryCounts} />
      </div>

      {/* Company Recommended */}
      {companyApproved.length > 0 && (
        <div className="mb-8">
          <CompanyApprovedSection skills={companyApproved} />
        </div>
      )}

      {/* Trending Skills */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Trending Skills</h2>
        <TrendingSection skills={trending} />
      </div>

      {/* Top Contributors + Your Impact */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Contributors</h2>
        <LeaderboardTable
          contributors={leaderboard}
          currentUserImpact={{
            name: firstName,
            fteYearsSaved,
          }}
        />
      </div>
    </div>
  );
}
