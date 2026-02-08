import Link from "next/link";
import Image from "next/image";
import { formatRating } from "@everyskill/db";
import { Sparkline } from "./sparkline";
import { QualityBadge } from "./quality-badge";
import { calculateQualityScore } from "../lib/quality-score";
import { FTE_HOURS_PER_YEAR } from "../lib/constants";

export interface SkillCardData {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  totalUses: number;
  averageRating: number | null;
  totalRatings: number;
  hoursSaved: number | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface SkillCardProps {
  skill: SkillCardData;
  usageTrend: number[];
}

/**
 * Skill preview card for browse/search results
 *
 * Displays:
 * - Category badge
 * - Name and truncated description
 * - Total uses, rating, FTE Days Saved with sparkline
 * - Author avatar and name
 */
export function SkillCard({ skill, usageTrend }: SkillCardProps) {
  // Calculate FTE Years Saved: (totalUses * hoursSaved) / FTE_HOURS_PER_YEAR
  const fteYearsSaved = ((skill.totalUses * (skill.hoursSaved ?? 1)) / FTE_HOURS_PER_YEAR).toFixed(
    2
  );

  // Calculate quality tier for badge
  const { tier } = calculateQualityScore({
    totalUses: skill.totalUses,
    averageRating: skill.averageRating,
    totalRatings: skill.totalRatings,
    hasDescription: Boolean(skill.description),
    hasCategory: Boolean(skill.category),
  });

  return (
    <Link
      href={`/skills/${skill.slug}`}
      className="group block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      {/* Header */}
      <div className="relative mb-3">
        <span className="text-xs font-medium uppercase text-blue-600">{skill.category}</span>
        <div className="absolute right-0 top-0">
          <QualityBadge tier={tier} size="sm" />
        </div>
        <h3 className="mt-1 font-semibold text-gray-900 group-hover:text-blue-600">{skill.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{skill.description}</p>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 border-t border-gray-100 pt-3 text-sm text-gray-500">
        <span>{skill.totalUses} uses</span>
        <span>
          {skill.averageRating !== null
            ? `${formatRating(skill.averageRating)} stars`
            : "No ratings"}
        </span>
        <div className="flex items-center gap-1">
          <span>{fteYearsSaved} yrs</span>
          <Sparkline data={usageTrend} />
        </div>
      </div>

      {/* Author */}
      {skill.author && (
        <div className="mt-3 flex items-center gap-2">
          {skill.author.image ? (
            <Image
              src={skill.author.image}
              alt={skill.author.name || "Author"}
              width={24}
              height={24}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
              {skill.author.name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <span className="text-xs text-gray-500">by {skill.author.name || "Anonymous"}</span>
        </div>
      )}
    </Link>
  );
}
