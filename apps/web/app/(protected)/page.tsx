import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPlatformStats } from "@/lib/platform-stats";
import { getPlatformStatTrends } from "@/lib/platform-stat-trends";
import { getTrendingSkills } from "@/lib/trending";
import { getLeaderboard } from "@/lib/leaderboard";
import {
  getSkillsUsed,
  getSkillsUsedStats,
  getSkillsCreated,
  getSkillsCreatedStats,
} from "@/lib/my-leverage";
import { StatCard } from "@/components/stat-card";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { TrendingSection } from "@/components/trending-section";
import { SearchWithDropdown } from "@/components/search-with-dropdown";
import { HomeTabs } from "@/components/home-tabs";
import { MyLeverageView } from "@/components/my-leverage-view";

// Icons for stat cards (Heroicons)
function ClockIcon() {
  return (
    <svg
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function PlayCircleIcon() {
  return (
    <svg
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
      />
    </svg>
  );
}

function ArrowDownTrayIcon() {
  return (
    <svg
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

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
    trends,
    trending,
    leaderboard,
    skillsUsedResult,
    skillsUsedStats,
    skillsCreatedResult,
    skillsCreatedStats,
  ] = await Promise.all([
    getPlatformStats(),
    getPlatformStatTrends(),
    getTrendingSkills(6),
    getLeaderboard(5),
    getSkillsUsed(user.id!),
    getSkillsUsedStats(user.id!),
    getSkillsCreated(user.id!),
    getSkillsCreatedStats(user.id!),
  ]);

  // Serialize timeline entry timestamps to ISO strings for client component
  const serializedSkillsUsed = skillsUsedResult.items.map((entry) => ({
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  }));

  const browseContent = (
    <>
      {/* CREATE / GET LEVERAGE CTAs */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2">
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
            Install a Skill
          </p>
          <p className="mt-1 text-sm text-gray-600">Discover skills from colleagues</p>
        </Link>
      </div>

      {/* Platform Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="FTE Years Saved"
          value={(stats.totalFteDaysSaved / 365).toFixed(1)}
          icon={<ClockIcon />}
          trendData={trends.fteDaysTrend}
          trendColor="#3b82f6"
        />
        <StatCard
          label="Total Uses"
          value={stats.totalUses.toLocaleString()}
          icon={<PlayCircleIcon />}
          trendData={trends.usesTrend}
          trendColor="#8b5cf6"
        />
        <StatCard
          label="Total Downloads"
          value={stats.totalDownloads.toLocaleString()}
          icon={<ArrowDownTrayIcon />}
          trendData={trends.downloadsTrend}
          trendColor="#10b981"
        />
        <StatCard
          label="Avg Rating"
          value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
          suffix={stats.averageRating > 0 ? "/ 5" : undefined}
          icon={<StarIcon />}
        />
      </div>

      {/* Trending and Leaderboard */}
      <div className="mb-8 grid gap-8 lg:grid-cols-3">
        {/* Trending Skills - takes 2/3 width on large screens */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Trending Skills</h2>
          <TrendingSection skills={trending} trendData={trends.fteDaysTrend} />
        </div>

        {/* Leaderboard - takes 1/3 width on large screens */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Contributors</h2>
          <LeaderboardTable contributors={leaderboard} />
        </div>
      </div>

      {/* Your Impact Section */}
      <div className="mt-8 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Your Impact</h2>
        <p className="mt-1 text-sm text-gray-600">
          Start sharing skills to see your contribution metrics here.
        </p>
        <div className="mt-4 flex gap-8">
          <Link href="/profile" className="group">
            <p className="text-2xl font-bold text-blue-600 group-hover:text-blue-700">View Stats</p>
            <p className="text-xs text-gray-500">See your profile</p>
          </Link>
        </div>
      </div>
    </>
  );

  const leverageContent = (
    <MyLeverageView
      skillsUsed={serializedSkillsUsed}
      skillsUsedStats={skillsUsedStats}
      skillsCreated={skillsCreatedResult.items}
      skillsCreatedStats={skillsCreatedStats}
      skillsUsedTotal={skillsUsedResult.total}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {firstName}!</h1>
        <p className="mt-2 text-gray-600">
          Connect with colleagues who have the skills you need, and share your own expertise.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8 flex items-center gap-4">
        <div className="max-w-xl flex-1">
          <SearchWithDropdown mode="navigate" />
        </div>
      </div>

      <HomeTabs browseContent={browseContent} leverageContent={leverageContent} />
    </div>
  );
}
