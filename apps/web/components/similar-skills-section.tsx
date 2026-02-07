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
          <Link
            key={skill.skillId}
            href={`/skills/${skill.skillSlug}`}
            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
          >
            <span className="font-medium text-gray-900">{skill.skillName}</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm text-gray-600">
              Match
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
