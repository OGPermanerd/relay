import { notFound } from "next/navigation";
import { db, skills } from "@relay/db";
import { eq } from "drizzle-orm";
import { SkillDetail } from "@/components/skill-detail";
import { getSkillStats } from "@/lib/skill-stats";

interface SkillPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SkillPage(props: SkillPageProps) {
  const params = await props.params;

  // Handle null db case
  if (!db) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-gray-600">Database not configured</p>
      </div>
    );
  }

  // Fetch skill from database with author relation
  const skill = await db.query.skills.findFirst({
    where: eq(skills.slug, params.slug),
    with: {
      author: {
        columns: { id: true, name: true, image: true },
      },
    },
  });

  if (!skill) {
    notFound();
  }

  // Get usage statistics
  const stats = await getSkillStats(skill.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SkillDetail skill={skill} stats={stats} />
    </div>
  );
}
