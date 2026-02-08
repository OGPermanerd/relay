import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getHookComplianceStatus } from "@everyskill/db";
import { AdminComplianceTable } from "@/components/admin-compliance-table";

export default async function AdminCompliancePage() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    redirect("/");
  }

  const tenantId = session.user.tenantId || "default-tenant-000-0000-000000000000";
  const complianceData = await getHookComplianceStatus(tenantId);

  const compliantCount = complianceData.filter((u) => u.isCompliant).length;
  const totalCount = complianceData.length;
  const complianceRate = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Hook Compliance</h1>
      <p className="mt-1 text-sm text-gray-600">
        Track which users have PostToolUse hooks actively firing callbacks in the last 30 days.
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Users</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{totalCount}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-sm font-medium text-green-700">Compliant</p>
          <p className="mt-1 text-3xl font-semibold text-green-900">{compliantCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Compliance Rate</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{complianceRate}%</p>
        </div>
      </div>

      {/* Table */}
      <div className="mt-8">
        <AdminComplianceTable
          data={complianceData.map((u) => ({
            ...u,
            lastHookEvent: u.lastHookEvent ?? undefined,
          }))}
        />
      </div>
    </div>
  );
}
