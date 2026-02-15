import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRecommendations } from "@/app/actions/recommendations";
import { DeploymentPlanDashboard } from "./deployment-plan-dashboard";

export const metadata = { title: "Deployment Plan | EverySkill" };

export default async function DeploymentPlanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const result = await getRecommendations();

  return (
    <div>
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/leverage"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          &larr; Back to Leverage
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Skill Deployment Plan</h1>
        <p className="mt-2 text-gray-600">
          Your prioritized adoption roadmap with projected time savings
        </p>
      </div>

      {/* Dashboard or empty state */}
      {result.recommendations && result.recommendations.length > 0 ? (
        <DeploymentPlanDashboard recommendations={result.recommendations} />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="text-sm text-gray-600">
            No skill recommendations yet. Run an email diagnostic scan to get personalized
            suggestions.
          </p>
          <Link
            href="/leverage"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Go to Leverage
          </Link>
        </div>
      )}
    </div>
  );
}
