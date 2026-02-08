import { getUserStats } from "@/lib/user-stats";
import { getContributorTier, TIER_COLORS } from "@/lib/contributor-tier";

interface GreetingAreaProps {
  userId: string;
  userName: string;
}

export async function GreetingArea({ userId, userName }: GreetingAreaProps) {
  const stats = await getUserStats(userId);
  const tier = getContributorTier({
    skillsShared: stats.skillsShared,
    daysSaved: stats.fteDaysSaved,
    avgRating: stats.avgRating !== null ? parseFloat(stats.avgRating) : null,
    totalUses: stats.totalUses,
  });

  const displayDays = Math.round(stats.fteDaysSaved);

  return (
    <div className="hidden items-center gap-1.5 text-sm sm:flex">
      <span className="font-medium text-gray-700">{userName}</span>
      <span className="text-gray-400">&mdash;</span>
      <span className="font-semibold text-gray-900">
        {displayDays} {displayDays === 1 ? "Day" : "Days"} Saved
      </span>
      {tier && (
        <>
          <span className="text-gray-300">|</span>
          <span className={`font-semibold ${TIER_COLORS[tier]}`}>{tier} Contributor</span>
        </>
      )}
    </div>
  );
}
