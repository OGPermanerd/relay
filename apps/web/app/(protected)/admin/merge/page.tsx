import { AdminMergeForm } from "@/components/admin-merge-form";

export default async function AdminMergePage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Merge Duplicate Skills</h2>
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
