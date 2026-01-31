import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPlatformStats } from "@/lib/platform-stats";
import { getTrendingSkills } from "@/lib/trending";
import { getLeaderboard } from "@/lib/leaderboard";
import { StatCard } from "@/components/stat-card";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { TrendingSection } from "@/components/trending-section";

// Icons for stat cards (Heroicons)
function UsersIcon() {
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
        d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
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

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;
  const firstName = user.name?.split(" ")[0] || "there";

  // Fetch all data in parallel
  const [stats, trending, leaderboard] = await Promise.all([
    getPlatformStats(),
    getTrendingSkills(6),
    getLeaderboard(5),
  ]);

  const navigationCards = [
    {
      title: "Your Profile",
      description: "View your profile and contribution stats",
      href: "/profile",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      ),
    },
    {
      title: "Share a Skill",
      description: "Upload prompts and workflows",
      href: "/skills/new",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
    },
    {
      title: "Browse Skills",
      description: "Discover skills from colleagues",
      href: "/skills",
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {firstName}!</h1>
        <p className="mt-2 text-gray-600">
          Connect with colleagues who have the skills you need, and share your own expertise.
        </p>
      </div>

      {/* Platform Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Contributors"
          value={stats.totalContributors.toLocaleString()}
          icon={<UsersIcon />}
        />
        <StatCard
          label="Total Downloads"
          value={stats.totalDownloads.toLocaleString()}
          icon={<ArrowDownTrayIcon />}
        />
        <StatCard
          label="Total Uses"
          value={stats.totalUses.toLocaleString()}
          icon={<PlayCircleIcon />}
        />
        <StatCard
          label="FTE Days Saved"
          value={stats.totalFteDaysSaved.toLocaleString()}
          icon={<ClockIcon />}
        />
      </div>

      {/* Trending and Leaderboard */}
      <div className="mb-8 grid gap-8 lg:grid-cols-3">
        {/* Trending Skills - takes 2/3 width on large screens */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Trending Skills</h2>
          <TrendingSection skills={trending} />
        </div>

        {/* Leaderboard - takes 1/3 width on large screens */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Contributors</h2>
          <LeaderboardTable contributors={leaderboard} />
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {navigationCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-50 p-3 text-blue-600 group-hover:bg-blue-100">
                {card.icon}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
                <p className="text-sm text-gray-600">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
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
    </div>
  );
}
