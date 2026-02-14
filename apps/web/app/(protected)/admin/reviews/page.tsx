import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getReviewQueue } from "@/lib/review-queries";
import { AdminReviewQueue } from "@/components/admin-review-queue";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    redirect("/");
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    redirect("/");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 20;

  const { skills, total } = await getReviewQueue({
    tenantId,
    page,
    pageSize,
    status: params.status,
    category: params.category,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Review Queue</h2>
        <p className="mt-1 text-sm text-gray-600">Skills awaiting admin review</p>
      </div>

      {/* Summary stat */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-medium text-gray-500">Showing</p>
            <p className="mt-0.5 text-2xl font-semibold text-gray-900">{total}</p>
            <p className="text-xs text-gray-400">skill{total !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      <AdminReviewQueue
        skills={skills}
        total={total}
        page={page}
        pageSize={pageSize}
        currentFilters={{
          status: params.status,
          category: params.category,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        }}
      />
    </div>
  );
}
