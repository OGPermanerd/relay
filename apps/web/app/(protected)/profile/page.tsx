import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserStats } from "@/lib/user-stats";
import { listApiKeysAction } from "@/app/actions/api-keys";
import { SetupWizard } from "@/components/setup-wizard";
import { FTE_DAYS_PER_YEAR } from "@/lib/constants";
import { getLatestDiagnostic } from "@everyskill/db/services/email-diagnostics";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { user } = session;

  // Fetch real user statistics and diagnostic data in parallel
  const [userStats, keysResult, diagnostic] = await Promise.all([
    getUserStats(session.user.id),
    listApiKeysAction(),
    getLatestDiagnostic(session.user.id),
  ]);
  const keys = keysResult.keys || [];

  const stats = [
    {
      label: "Skills Shared",
      value: userStats.skillsShared.toString(),
      description: "Skills you've contributed",
    },
    {
      label: "Total Uses",
      value: userStats.totalUses.toString(),
      description: "Times your skills were used",
    },
    {
      label: "Avg Rating",
      value: userStats.avgRating ?? "-",
      description: "Average rating received",
    },
    {
      label: "FTE Years Saved",
      value: (userStats.fteDaysSaved / FTE_DAYS_PER_YEAR).toFixed(1),
      description: "Years saved for the org",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Profile Header */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center gap-6">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || "Profile picture"}
              width={96}
              height={96}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200 text-3xl font-medium text-gray-600">
              {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Contribution Statistics */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Contribution Statistics</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm font-medium text-gray-700">{stat.label}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Email Insights — show if diagnostic exists */}
      {diagnostic && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Email Insights</h2>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {(diagnostic.estimatedHoursPerWeek / 10).toFixed(1)} hrs/week
                </p>
                <p className="text-sm text-gray-500">
                  on email ({diagnostic.totalMessages} messages analyzed)
                </p>
              </div>
              <Link
                href="/leverage/email-diagnostic"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                View details &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* My Skills */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">My Skills</h2>
        <p className="mb-4 text-sm text-gray-600">
          Manage skills you&apos;ve created and published
        </p>
        <a
          href="/my-skills"
          className="inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Go to My Skills &rarr;
        </a>
      </div>

      {/* Settings */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Settings</h2>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <Link
            href="/settings/preferences"
            className="flex items-center justify-between border-b border-gray-100 pb-4"
          >
            <div>
              <span className="text-sm font-medium text-blue-600">Preferences</span>
              <p className="mt-0.5 text-sm text-gray-500">
                Preferred categories, default sort, workflow notes
              </p>
            </div>
            <span className="text-gray-400">&rarr;</span>
          </Link>
          <Link
            href="/settings/notifications"
            className="flex items-center justify-between border-b border-gray-100 py-4"
          >
            <div>
              <span className="text-sm font-medium text-blue-600">Notifications</span>
              <p className="mt-0.5 text-sm text-gray-500">Email and in-app notification settings</p>
            </div>
            <span className="text-gray-400">&rarr;</span>
          </Link>
          <Link href="/settings/export" className="flex items-center justify-between pt-4">
            <div>
              <span className="text-sm font-medium text-blue-600">AI Export</span>
              <p className="mt-0.5 text-sm text-gray-500">
                Generate a CLAUDE.md file from your skills
              </p>
            </div>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </div>
      </div>

      {/* Account Info */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Account Information</h2>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-gray-900">{user.name || "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-gray-900">{user.email || "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Sign-in Provider</dt>
              <dd className="mt-1 text-gray-900">Google</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Integration Setup */}
      <SetupWizard initialKeys={keys} />
    </div>
  );
}
