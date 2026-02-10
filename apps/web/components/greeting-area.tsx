import { getUserStats } from "@/lib/user-stats";
import { getContributorTier, TIER_COLORS, TIER_COLORS_DARK } from "@/lib/contributor-tier";

interface GreetingAreaProps {
  userId: string;
  userName: string;
  theme?: "light" | "dark";
}

export async function GreetingArea({ userId, userName, theme = "light" }: GreetingAreaProps) {
  const stats = await getUserStats(userId);
  const tier = getContributorTier({
    skillsShared: stats.skillsShared,
    daysSaved: stats.fteDaysSaved,
    avgRating: stats.avgRating !== null ? parseFloat(stats.avgRating) : null,
    totalUses: stats.totalUses,
  });

  const displayDays = Math.round(stats.fteDaysSaved);
  const dark = theme === "dark";
  const tierColors = dark ? TIER_COLORS_DARK : TIER_COLORS;

  return (
    <div className="hidden items-center gap-1.5 text-sm sm:flex">
      <span className={`font-medium ${dark ? "text-[#dbe9f6]" : "text-gray-700"}`}>{userName}</span>
      <span className={dark ? "text-[#7a9ab4]" : "text-gray-400"}>&mdash;</span>
      <span className={`font-semibold ${dark ? "text-[#dbe9f6]" : "text-gray-900"}`}>
        {displayDays} {displayDays === 1 ? "Day" : "Days"} Saved
      </span>
      {tier && (
        <>
          <span className={dark ? "text-[#7a9ab4]" : "text-gray-300"}>|</span>
          <span className={`font-semibold ${tierColors[tier]}`}>{tier} Contributor</span>
        </>
      )}
    </div>
  );
}
