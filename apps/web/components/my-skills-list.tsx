"use client";

import { useState } from "react";
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
  statusMessage: string | null;
  totalUses: number;
  averageRating: number | null;
  createdAt: string;
  forkCount: number;
}

interface MySkillsListProps {
  skills: MySkillItem[];
}

/** Statuses that allow submitting (or retrying) for review */
const SUBMITTABLE_STATUSES = new Set(["draft", "changes_requested"]);

function canSubmitForReview(skill: MySkillItem): boolean {
  // Draft and changes_requested can always submit
  if (SUBMITTABLE_STATUSES.has(skill.status)) return true;
  // pending_review with a statusMessage means a failed review that can be retried
  if (skill.status === "pending_review" && skill.statusMessage) return true;
  return false;
}

function getSubmitLabel(skill: MySkillItem): string {
  if (skill.status === "pending_review" && skill.statusMessage) return "Retry Review";
  if (skill.status === "changes_requested") return "Resubmit for Review";
  return "Submit for Review";
}

export function MySkillsList({ skills }: MySkillsListProps) {
  const router = useRouter();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function handleSubmit(skillId: string) {
    if (submittingId) return; // Prevent double-clicks
    setSubmittingId(skillId);
    try {
      const result = await submitForReview(skillId);
      if ("error" in result) {
        // Error is now shown via statusMessage in UI after refresh
        router.refresh();
      } else {
        router.refresh();
      }
    } finally {
      setSubmittingId(null);
    }
  }

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
            {skill.statusMessage && (
              <p className="mt-1 text-sm text-red-600">{skill.statusMessage}</p>
            )}
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
            {canSubmitForReview(skill) && (
              <button
                onClick={() => handleSubmit(skill.id)}
                disabled={submittingId === skill.id}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingId === skill.id ? "Reviewing..." : getSubmitLabel(skill)}
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
