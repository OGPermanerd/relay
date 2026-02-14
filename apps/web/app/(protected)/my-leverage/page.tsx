import Link from "next/link";
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
import { EmailDiagnosticCard } from "./email-diagnostic-card";

export const metadata = { title: "My Leverage | EverySkill" };

export default async function MyLeveragePage() {
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          &larr; Back to Home
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Leverage</h1>
        <p className="mt-2 text-gray-600">
          Track your impact &mdash; skills you use and skills you create
        </p>
      </div>

      {/* Email Diagnostic Card */}
      <div className="mb-8">
        <EmailDiagnosticCard />
      </div>

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
    </div>
  );
}
