import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, users, skills } from "@everyskill/db";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { getUserStats } from "@/lib/user-stats";
import { auth } from "@/auth";
import { ThankYouButton } from "@/components/thank-you-button";
import { FTE_DAYS_PER_YEAR, FTE_HOURS_PER_YEAR } from "@/lib/constants";

interface UserPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage(props: UserPageProps) {
  const params = await props.params;

  if (!db) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-gray-600">Database not configured</p>
      </div>
    );
  }

  // Fetch user from database
  const user = await db.query.users.findFirst({
    where: eq(users.id, params.id),
  });

  if (!user) {
    notFound();
  }

  // Get user stats and their skills in parallel
  const [userStats, userSkills, session] = await Promise.all([
    getUserStats(user.id),
    db.query.skills.findMany({
      where: and(eq(skills.authorId, user.id), isNotNull(skills.publishedVersionId)),
      orderBy: desc(skills.totalUses),
      columns: {
        id: true,
        name: true,
        slug: true,
        description: true,
        category: true,
        totalUses: true,
        averageRating: true,
        hoursSaved: true,
        createdAt: true,
      },
      limit: 20,
    }),
    auth(),
  ]);

  const stats = [
    { label: "Skills Shared", value: userStats.skillsShared.toString() },
    { label: "Total Uses", value: userStats.totalUses.toString() },
    { label: "Avg Rating", value: userStats.avgRating ?? "-" },
    { label: "FTE Years Saved", value: (userStats.fteDaysSaved / FTE_DAYS_PER_YEAR).toFixed(1) },
  ];

  const isOwnProfile = session?.user?.id === user.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Profile Header */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
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
              <h1 className="text-2xl font-bold text-gray-900">{user.name || "Anonymous"}</h1>
              <p className="text-gray-600">
                Contributor since{" "}
                {user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Thank You button - only show if viewing someone else's profile */}
          {!isOwnProfile && session?.user && (
            <ThankYouButton userId={user.id} userName={user.name || "this contributor"} />
          )}
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
            </div>
          ))}
        </div>
      </div>

      {/* Skills by this user */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Skills by {user.name?.split(" ")[0] || "this contributor"} ({userSkills.length})
        </h2>
        {userSkills.length > 0 ? (
          <div className="space-y-3">
            {userSkills.map((skill) => {
              const yearsSaved = (
                (skill.totalUses * (skill.hoursSaved ?? 1)) /
                FTE_HOURS_PER_YEAR
              ).toFixed(2);
              const rating = skill.averageRating ? (skill.averageRating / 100).toFixed(1) : null;

              return (
                <Link
                  key={skill.id}
                  href={`/skills/${skill.slug}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{skill.name}</h3>
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                          {skill.category || "Other"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {skill.description || "No description"}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-4 text-sm text-gray-500">
                      <div className="text-right">
                        <p className="font-medium text-blue-600">{yearsSaved} yrs</p>
                        <p className="text-xs">saved</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{skill.totalUses}</p>
                        <p className="text-xs">uses</p>
                      </div>
                      {rating && (
                        <div className="text-right">
                          <p className="font-medium text-amber-600">{rating}</p>
                          <p className="text-xs">rating</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500">No skills published yet.</p>
        )}
      </div>
    </div>
  );
}
