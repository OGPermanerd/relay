"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AiReviewDisplay } from "@/components/ai-review-display";
import { ReviewDiffView } from "@/components/review-diff-view";
import {
  approveSkillAction,
  rejectSkillAction,
  requestChangesAction,
} from "@/app/actions/admin-reviews";

// =============================================================================
// Constants
// =============================================================================

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  ai_reviewed: "bg-amber-100 text-amber-700",
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

const CATEGORY_COLORS: Record<string, string> = {
  prompt: "bg-blue-100 text-blue-700",
  workflow: "bg-purple-100 text-purple-700",
  agent: "bg-green-100 text-green-700",
  mcp: "bg-orange-100 text-orange-700",
};

const ACTION_LABELS: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes Requested",
};

const ACTION_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  changes_requested: "bg-amber-100 text-amber-700",
};

// =============================================================================
// Types
// =============================================================================

interface SkillData {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[] | null;
  content: string;
  status: string;
  statusMessage: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface AiReviewData {
  categories: {
    quality: { score: number; suggestions: string[] };
    clarity: { score: number; suggestions: string[] };
    completeness: { score: number; suggestions: string[] };
  };
  summary: string;
  suggestedDescription: string | null;
  reviewedAt: string;
  modelName: string;
}

interface DecisionData {
  id: string;
  action: string;
  notes: string | null;
  reviewerName: string | null;
  createdAt: string;
}

interface AdminReviewDetailProps {
  skill: SkillData;
  aiReview: AiReviewData | null;
  decisions: DecisionData[];
  previousContent: string | null;
}

// =============================================================================
// Helpers
// =============================================================================

/** Format date as "MMM D, YYYY" using UTC to avoid hydration mismatches */
function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
}

/** Format date+time as "MMM D, YYYY at HH:MM UTC" */
function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return (
    MONTHS[d.getUTCMonth()] +
    " " +
    d.getUTCDate() +
    ", " +
    d.getUTCFullYear() +
    " at " +
    hours +
    ":" +
    minutes +
    " UTC"
  );
}

// =============================================================================
// Component
// =============================================================================

export function AdminReviewDetail({
  skill,
  aiReview,
  decisions,
  previousContent,
}: AdminReviewDetailProps) {
  const router = useRouter();

  // Action state
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Notes state for each action
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [changesNotes, setChangesNotes] = useState("");

  // Validation errors
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [changesError, setChangesError] = useState<string | null>(null);

  // Collapsible approve notes
  const [showApproveNotes, setShowApproveNotes] = useState(false);

  const isActionable = skill.status === "ai_reviewed";

  // ------------------------------------------
  // Action handlers
  // ------------------------------------------

  async function handleApprove() {
    setPending("approve");
    setError(null);
    try {
      const result = await approveSkillAction(skill.id, approveNotes.trim() || undefined);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setPending(null);
    }
  }

  async function handleReject() {
    if (!rejectNotes.trim()) {
      setRejectError("Notes are required");
      return;
    }
    setRejectError(null);
    setPending("reject");
    setError(null);
    try {
      const result = await rejectSkillAction(skill.id, rejectNotes.trim());
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setPending(null);
    }
  }

  async function handleRequestChanges() {
    if (!changesNotes.trim()) {
      setChangesError("Notes are required");
      return;
    }
    setChangesError(null);
    setPending("changes");
    setError(null);
    try {
      const result = await requestChangesAction(skill.id, changesNotes.trim());
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setPending(null);
    }
  }

  // ------------------------------------------
  // Determine if diff should be shown
  // ------------------------------------------

  const showDiff = previousContent !== null && previousContent !== skill.content;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <div>
        <Link href="/admin/reviews" className="text-sm text-blue-600 hover:text-blue-800">
          &larr; Back to Review Queue
        </Link>
      </div>

      {/* Skill header */}
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold text-gray-900">{skill.name}</h2>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[skill.category] || "bg-gray-100 text-gray-700"}`}
          >
            {skill.category}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[skill.status] || "bg-gray-100 text-gray-700"}`}
          >
            {STATUS_LABELS[skill.status] || skill.status}
          </span>
        </div>
        <p className="text-sm text-gray-600">{skill.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-400">
          {skill.author && <span>By {skill.author.name || "Unknown"}</span>}
          <span>Created {formatDate(skill.createdAt)}</span>
          <span>Updated {formatDate(skill.updatedAt)}</span>
        </div>
      </div>

      {/* Two-column layout: content + AI review */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Skill content (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Skill Content</h3>

            {showDiff ? (
              <ReviewDiffView
                oldContent={previousContent!}
                newContent={skill.content}
                oldLabel="Previous Version"
                newLabel="Submitted Version"
              />
            ) : (
              <div>
                {previousContent === null && (
                  <div className="mb-2 inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    New submission -- no previous version
                  </div>
                )}
                <pre className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                  {skill.content}
                </pre>
              </div>
            )}
          </div>

          {/* Tags */}
          {skill.tags && skill.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AI Review + Actions (1/3 width) */}
        <div className="space-y-6">
          {/* AI Review Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">AI Review</h3>
            {aiReview ? (
              <AiReviewDisplay
                categories={aiReview.categories}
                summary={aiReview.summary}
                suggestedDescription={aiReview.suggestedDescription ?? undefined}
                reviewedAt={aiReview.reviewedAt}
                modelName={aiReview.modelName}
              />
            ) : (
              <p className="text-sm text-gray-500">No AI review available</p>
            )}
          </div>

          {/* Action Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Review Actions</h3>

            {isActionable ? (
              <div className="space-y-4">
                {/* Error display */}
                {error && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Approve */}
                <div className="space-y-2">
                  <button
                    onClick={handleApprove}
                    disabled={pending !== null}
                    className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending === "approve" ? "Approving..." : "Approve & Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApproveNotes(!showApproveNotes)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showApproveNotes ? "Hide notes" : "Add notes (optional)"}
                  </button>
                  {showApproveNotes && (
                    <textarea
                      value={approveNotes}
                      onChange={(e) => setApproveNotes(e.target.value)}
                      placeholder="Optional approval notes..."
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    />
                  )}
                </div>

                <hr className="border-gray-200" />

                {/* Reject */}
                <div className="space-y-2">
                  <button
                    onClick={handleReject}
                    disabled={pending !== null}
                    className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending === "reject" ? "Rejecting..." : "Reject"}
                  </button>
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => {
                      setRejectNotes(e.target.value);
                      if (e.target.value.trim()) setRejectError(null);
                    }}
                    placeholder="Explain why this skill was rejected..."
                    rows={2}
                    className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-1 ${
                      rejectError
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:border-red-500 focus:ring-red-500"
                    }`}
                  />
                  {rejectError && <p className="text-xs text-red-600">{rejectError}</p>}
                </div>

                <hr className="border-gray-200" />

                {/* Request Changes */}
                <div className="space-y-2">
                  <button
                    onClick={handleRequestChanges}
                    disabled={pending !== null}
                    className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending === "changes" ? "Submitting..." : "Request Changes"}
                  </button>
                  <textarea
                    value={changesNotes}
                    onChange={(e) => {
                      setChangesNotes(e.target.value);
                      if (e.target.value.trim()) setChangesError(null);
                    }}
                    placeholder="Describe what changes are needed..."
                    rows={2}
                    className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-1 ${
                      changesError
                        ? "border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                        : "border-gray-300 focus:border-amber-500 focus:ring-amber-500"
                    }`}
                  />
                  {changesError && <p className="text-xs text-amber-600">{changesError}</p>}
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-3">
                <p className="text-sm text-gray-600">
                  This skill has been{" "}
                  <span className="font-medium">
                    {STATUS_LABELS[skill.status]?.toLowerCase() || skill.status}
                  </span>
                  .
                </p>
                {skill.statusMessage && (
                  <p className="mt-1 text-xs text-gray-500">{skill.statusMessage}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decision History (full width, below both columns) */}
      {decisions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Review History</h3>
          <div className="space-y-3">
            {decisions.map((decision) => (
              <div
                key={decision.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_COLORS[decision.action] || "bg-gray-100 text-gray-700"}`}
                  >
                    {ACTION_LABELS[decision.action] || decision.action}
                  </span>
                  <span className="text-sm text-gray-600">
                    by {decision.reviewerName || "Unknown"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDateTime(decision.createdAt)}
                  </span>
                </div>
                {decision.notes && <p className="text-sm text-gray-700 mt-1">{decision.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
