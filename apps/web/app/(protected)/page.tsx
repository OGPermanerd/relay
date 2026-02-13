import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPlatformStats } from "@/lib/platform-stats";
import { getTrendingSkills } from "@/lib/trending";
import { getCompanyApprovedSkills } from "@/lib/company-approved";
import { getLeaderboard } from "@/lib/leaderboard";
import { getSkillsUsedStats, getSkillsCreatedStats } from "@/lib/my-leverage";
import { getCategoryCounts } from "@/lib/category-counts";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { TrendingSection } from "@/components/trending-section";
import { CompanyApprovedSection } from "@/components/company-approved-section";
import { DiscoverySearch } from "@/components/discovery-results";
import { CategoryTiles } from "@/components/category-tiles";
import { CompactStatsBar } from "@/components/compact-stats-bar";
import { MiniLeverageWidget } from "@/components/mini-leverage-widget";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {firstName}!</h1>
        <p className="mt-2 text-gray-600">
          Connect with colleagues who have the skills you need, and share your own expertise.
        </p>
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

      {/* Compact Stats Bar */}
      <div className="mb-8">
        <CompactStatsBar stats={stats} />
      </div>

      {/* Top Contributors */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Contributors</h2>
        <LeaderboardTable contributors={leaderboard} />
      </div>

      {/* Mini Leverage Widget */}
      <div className="mb-8">
        <MiniLeverageWidget
          skillsUsedStats={skillsUsedStats}
          skillsCreatedStats={skillsCreatedStats}
        />
      </div>

      {/* CTAs */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          href="/skills/new"
          className="group relative overflow-hidden rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-100 p-8 text-center shadow-sm transition hover:border-blue-400 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
            Create Leverage
          </p>
          <p className="mt-2 text-xl font-semibold text-gray-900 group-hover:text-blue-700">
            Share a Skill
          </p>
          <p className="mt-1 text-sm text-gray-600">Upload prompts and workflows for your team</p>
        </Link>
        <Link
          href="/skills"
          className="group relative overflow-hidden rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-8 text-center shadow-sm transition hover:border-emerald-400 hover:shadow-md"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Get Leverage
          </p>
          <p className="mt-2 text-xl font-semibold text-gray-900 group-hover:text-emerald-700">
            Browse All Skills
          </p>
          <p className="mt-1 text-sm text-gray-600">Discover skills from colleagues</p>
        </Link>
      </div>
    </div>
  );
}
