"use client";

import Link from "next/link";
import { TrendingSkill } from "@/lib/trending";
import { Sparkline } from "./sparkline";

interface TrendingSectionProps {
  skills: TrendingSkill[];
  trendData?: number[];
}

export function TrendingSection({ skills, trendData }: TrendingSectionProps) {
  const hasSparkline = trendData && trendData.length > 0 && trendData.some((v) => v > 0);

  if (skills.length === 0) {
    return (
      <p className="text-gray-500">
        No trending skills yet. Start using skills to see what&apos;s popular!
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Sparkline underlay */}
      {hasSparkline && (
        <div className="pointer-events-none absolute inset-0 flex items-end opacity-20">
          <Sparkline data={trendData} width={600} height={120} color="#3b82f6" />
        </div>
      )}

      <div className="relative grid gap-4 lg:grid-cols-2">
        {skills.map((skill) => (
          <Link
            key={skill.id}
            href={`/skills/${skill.slug}`}
            className="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
                  {skill.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{skill.description}</p>
              </div>
              <div className="ml-3 flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  {skill.category}
                </span>
                {skill.loomUrl && (
                  <span className="inline-flex items-center text-blue-500" title="Has demo video">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <svg
                  className="h-4 w-4 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                  />
                </svg>
                {skill.recentUses} recent uses
              </span>
              <span className="text-gray-400">|</span>
              <span>{skill.totalUses.toLocaleString()} total</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
