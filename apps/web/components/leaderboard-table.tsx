import Image from "next/image";
import { LeaderboardEntry } from "@/lib/leaderboard";

interface LeaderboardTableProps {
  contributors: LeaderboardEntry[];
}

export function LeaderboardTable({ contributors }: LeaderboardTableProps) {
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
              Rank
            </th>
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
              Skills
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Uses
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Rating
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              FTE Days
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {contributors.map((contributor, index) => (
            <tr
              key={contributor.userId}
              className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
            >
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                #{contributor.rank}
              </td>
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
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
                {contributor.skillsShared}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
                {contributor.totalUses.toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
                {contributor.avgRating ? (
                  <span className="flex items-center justify-end gap-1">
                    <svg
                      className="h-4 w-4 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {contributor.avgRating}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-blue-600">
                {contributor.fteDaysSaved.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
