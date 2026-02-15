"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LeaderboardEntry } from "@/lib/leaderboard";
import { FTE_DAYS_PER_YEAR } from "@/lib/constants";

const RANK_COLORS: Record<number, string> = {
  1: "bg-yellow-400",
  2: "bg-gray-300",
  3: "bg-amber-600",
};

interface CurrentUserImpact {
  name: string;
  fteYearsSaved: number;
}

interface LeaderboardTableProps {
  contributors: LeaderboardEntry[];
  currentUserImpact?: CurrentUserImpact;
}

export function LeaderboardTable({ contributors, currentUserImpact }: LeaderboardTableProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (contributors.length === 0) {
    return <p className="text-gray-500">No contributors yet. Be the first to share a skill!</p>;
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="leaderboard-content"
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <span>Leaderboard</span>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div id="leaderboard-content">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Contributor
                </th>
                <th
                  scope="col"
                  className="min-w-[6rem] px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Years Saved
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {contributors.map((contributor, index) => (
                <tr
                  key={contributor.userId}
                  className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/users/${contributor.userId}`}
                      className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                    >
                      {/* Rank badge */}
                      {contributor.rank <= 3 ? (
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${RANK_COLORS[contributor.rank]}`}
                        >
                          {contributor.rank}
                        </span>
                      ) : (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs text-gray-400">
                          {contributor.rank}
                        </span>
                      )}
                      {contributor.image ? (
                        <Image
                          src={contributor.image}
                          alt={contributor.name}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                          {contributor.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate text-sm text-gray-900 hover:text-blue-600">
                        {contributor.name}
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-medium text-blue-600">
                    {(contributor.fteDaysSaved / FTE_DAYS_PER_YEAR).toFixed(1)}
                  </td>
                </tr>
              ))}

              {/* Your Impact row */}
              {currentUserImpact && (
                <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {currentUserImpact.name} — Your Impact
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-bold text-emerald-600">
                        {currentUserImpact.fteYearsSaved.toFixed(2)}
                      </span>
                      <Link
                        href="/leverage"
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Details
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
