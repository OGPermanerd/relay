import Link from "next/link";
import type { SimilarSkillResult } from "@/lib/similar-skills";

interface SimilarSkillsSectionProps {
  similarSkills: SimilarSkillResult[];
}

export function SimilarSkillsSection({ similarSkills }: SimilarSkillsSectionProps) {
  if (similarSkills.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Similar Skills</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {similarSkills.map((skill) => (
          <div key={skill.skillId} className="group relative">
            <Link
              href={`/skills/${skill.skillSlug}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">{skill.skillName}</span>
              <div className="flex items-center gap-1.5">
                {skill.similarityPct != null && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                    {skill.similarityPct}%
                  </span>
                )}
              </div>
            </Link>

            {/* Hover popup with skill details */}
            {(skill.description || skill.category) && (
              <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg group-hover:block">
                <p className="font-semibold text-gray-900">{skill.skillName}</p>
                {skill.category && (
                  <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {skill.category}
                  </span>
                )}
                {skill.description && (
                  <p className="mt-2 text-sm text-gray-600">
                    {skill.description.length > 150
                      ? skill.description.slice(0, 150) + "..."
                      : skill.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  {skill.totalUses != null && (
                    <span>
                      {skill.totalUses} {skill.totalUses === 1 ? "use" : "uses"}
                    </span>
                  )}
                  {skill.averageRating != null && (
                    <span>{(skill.averageRating / 100).toFixed(1)} stars</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
