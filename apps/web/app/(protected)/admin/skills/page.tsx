import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getAdminSkills } from "@/app/actions/admin-skills";
import { AdminSkillsTable } from "@/components/admin-skills-table";

export default async function AdminSkillsPage() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    redirect("/");
  }

  const skills = await getAdminSkills();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Skills Management</h1>
      <p className="mt-1 text-sm text-gray-600">
        View, delete, and bulk-merge skills across your organization.
      </p>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Skills</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{skills.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Uses</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">
            {skills.reduce((sum, s) => sum + s.totalUses, 0)}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <AdminSkillsTable skills={skills} />
      </div>
    </div>
  );
}
