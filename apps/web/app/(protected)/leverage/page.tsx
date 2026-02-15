import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getSkillsUsed,
  getSkillsUsedStats,
  getSkillsCreated,
  getSkillsCreatedStats,
} from "@/lib/my-leverage";
import { MyLeverageView } from "@/components/my-leverage-view";
import { RecommendationsSection } from "@/components/recommendations-section";

export const metadata = { title: "Leverage | EverySkill" };

export default async function LeverageMePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;

  const [skillsUsedResult, skillsUsedStats, skillsCreatedResult, skillsCreatedStats] =
    await Promise.all([
      getSkillsUsed(user.id!),
      getSkillsUsedStats(user.id!),
      getSkillsCreated(user.id!),
      getSkillsCreatedStats(user.id!),
    ]);

  // Serialize timestamps for client component
  const serializedSkillsUsed = skillsUsedResult.items.map((entry) => ({
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  }));

  return (
    <>
      {/* Skill Recommendations */}
      <div className="mb-8">
        <RecommendationsSection />
      </div>

      {/* Full leverage dashboard */}
      <MyLeverageView
        skillsUsed={serializedSkillsUsed}
        skillsUsedStats={skillsUsedStats}
        skillsCreated={skillsCreatedResult.items}
        skillsCreatedStats={skillsCreatedStats}
        skillsUsedTotal={skillsUsedResult.total}
      />
    </>
  );
}
