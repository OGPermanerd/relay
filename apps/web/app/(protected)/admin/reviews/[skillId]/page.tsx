import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { DEFAULT_TENANT_ID } from "@everyskill/db";
import { getReviewDetail } from "@/lib/review-queries";
import { AdminReviewDetail } from "@/components/admin-review-detail";

export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ skillId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    redirect("/");
  }

  const { skillId } = await params;
  const tenantId = session.user.tenantId || DEFAULT_TENANT_ID;

  const detail = await getReviewDetail(skillId, tenantId);
  if (!detail) {
    notFound();
  }

  // Serialize AI review for client component (dates as ISO strings)
  const serializedAiReview = detail.aiReview
    ? {
        categories: detail.aiReview.categories,
        summary: detail.aiReview.summary,
        suggestedDescription: detail.aiReview.suggestedDescription,
        reviewedAt: detail.aiReview.createdAt.toISOString(),
        modelName: detail.aiReview.modelName,
      }
    : null;

  return (
    <AdminReviewDetail
      skill={detail.skill}
      aiReview={serializedAiReview}
      decisions={detail.decisions}
      previousContent={detail.previousContent}
    />
  );
}
