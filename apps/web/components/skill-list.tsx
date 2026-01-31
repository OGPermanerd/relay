import { SkillCard, SkillCardData } from "./skill-card";

interface SkillListProps {
  skills: SkillCardData[];
  usageTrends: Map<string, number[]>;
}

/**
 * Responsive grid of skill cards
 *
 * Layout:
 * - 1 column on mobile
 * - 2 columns on tablet (sm)
 * - 3 columns on desktop (lg)
 */
export function SkillList({ skills, usageTrends }: SkillListProps) {
  if (skills.length === 0) {
    return null; // Parent handles empty state
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} usageTrend={usageTrends.get(skill.id) || []} />
      ))}
    </div>
  );
}
