"use client";

import Image from "next/image";
import { LeaderboardEntry } from "@/lib/leaderboard";
import { useAuthorFilter } from "@/hooks/use-author-filter";

interface LeaderboardTableProps {
  contributors: LeaderboardEntry[];
}

/**
 * Format date as "MMM D" (e.g., "Jan 15")
 */
function formatLatestDate(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LeaderboardTable({ contributors }: LeaderboardTableProps) {
  const { author, filterByAuthor } = useAuthorFilter();

  if (contributors.length === 0) {
    return <p className="text-gray-500">No contributors yet. Be the first to share a skill!</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Contributor
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Days Saved
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Contributions
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Latest
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {contributors.map((contributor, index) => (
            <tr
              key={contributor.userId}
              onClick={() => filterByAuthor(contributor.userId)}
              className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${author === contributor.userId ? "ring-2 ring-blue-500 bg-blue-50" : ""} hover:bg-blue-50 transition-colors cursor-pointer`}
            >
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center gap-3">
                  {contributor.image ? (
                    <Image
                      src={contributor.image}
                      alt={contributor.name}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                      {contributor.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900">{contributor.name}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-blue-600">
                {contributor.fteDaysSaved.toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
                {contributor.skillsShared}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
                {formatLatestDate(contributor.latestContributionDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
