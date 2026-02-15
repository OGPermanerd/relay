import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLatestDiagnostic } from "@everyskill/db/services/email-diagnostics";
import { DiagnosticDashboard } from "./diagnostic-dashboard";

export const metadata = { title: "Email Time Diagnostic | EverySkill" };

export default async function EmailDiagnosticPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const diagnostic = await getLatestDiagnostic(session.user.id);

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
        <h1 className="text-3xl font-bold text-gray-900">Email Time Diagnostic</h1>
        <p className="mt-2 text-gray-600">
          See where your email time goes with detailed category breakdowns and pattern insights.
        </p>
      </div>

      {/* Dashboard or empty state */}
      {diagnostic ? (
        <DiagnosticDashboard diagnostic={diagnostic} />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <p className="text-sm text-gray-600">
            No diagnostic data yet. Run your first email diagnostic to see insights.
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
