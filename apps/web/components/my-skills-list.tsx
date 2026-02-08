"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeleteSkillButton } from "./delete-skill-button";
import { RelativeTime } from "@/components/relative-time";
import { submitForReview } from "@/app/actions/submit-for-review";

const CATEGORY_COLORS: Record<string, string> = {
  prompt: "bg-blue-100 text-blue-700",
  workflow: "bg-purple-100 text-purple-700",
  agent: "bg-green-100 text-green-700",
  mcp: "bg-orange-100 text-orange-700",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  ai_reviewed: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  changes_requested: "bg-orange-100 text-orange-700",
  published: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  ai_reviewed: "AI Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes Requested",
  published: "Published",
};

export interface MySkillItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  totalUses: number;
  averageRating: number | null;
  createdAt: string;
  forkCount: number;
}

interface MySkillsListProps {
  skills: MySkillItem[];
}

export function MySkillsList({ skills }: MySkillsListProps) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <div
          key={skill.id}
          className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Link
                href={`/skills/${skill.slug}`}
                className="text-base font-medium text-gray-900 hover:text-blue-600 truncate"
              >
                {skill.name}
              </Link>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[skill.category] || "bg-gray-100 text-gray-700"}`}
              >
                {skill.category}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[skill.status] || "bg-gray-100 text-gray-700"}`}
              >
                {STATUS_LABELS[skill.status] || skill.status}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
              <span>
                {skill.totalUses} use{skill.totalUses !== 1 ? "s" : ""}
              </span>
              <span>
                {skill.averageRating !== null
                  ? `${(skill.averageRating / 100).toFixed(1)} stars`
                  : "No ratings"}
              </span>
              <RelativeTime date={skill.createdAt} />
            </div>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-2">
            {skill.status === "draft" && (
              <button
                onClick={async () => {
                  const result = await submitForReview(skill.id);
                  if (result.error) {
                    alert(result.error);
                  } else {
                    router.refresh();
                  }
                }}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Submit for Review
              </button>
            )}
            <DeleteSkillButton
              skillId={skill.id}
              skillName={skill.name}
              totalUses={skill.totalUses}
              forkCount={skill.forkCount}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
