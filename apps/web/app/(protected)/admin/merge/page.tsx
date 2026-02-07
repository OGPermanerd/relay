import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { AdminMergeForm } from "@/components/admin-merge-form";

export default async function AdminMergePage() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.email)) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Merge Duplicate Skills</h1>
      <p className="mt-1 text-sm text-gray-600">
        Merge a duplicate skill into another. All usage events, ratings, and forks will be
        transferred to the target skill. The source skill will be deleted.
      </p>

      <div className="mt-8 rounded-lg bg-white p-6 shadow-sm">
        <AdminMergeForm />
      </div>
    </div>
  );
}
