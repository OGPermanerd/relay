"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSuggestionStatus, replySuggestion } from "@/app/actions/skill-feedback";

// =============================================================================
// Constants
// =============================================================================

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  dismissed: "bg-gray-100 text-gray-600",
  implemented: "bg-blue-100 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Open",
  accepted: "Accepted",
  dismissed: "Dismissed",
  implemented: "Implemented",
};

const SEVERITY_COLORS: Record<string, string> = {
  nice_to_have: "bg-gray-100 text-gray-600",
  important: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const SEVERITY_LABELS: Record<string, string> = {
  nice_to_have: "Nice to Have",
  important: "Important",
  critical: "Critical",
};

const CATEGORY_LABELS: Record<string, string> = {
  output_quality: "Output Quality",
  missing_feature: "Missing Feature",
  error: "Error",
  performance: "Performance",
  other: "Other",
};

// =============================================================================
// Types
// =============================================================================

export interface SuggestionCardData {
  id: string;
  userId: string | null;
  comment: string | null;
  suggestedContent: string | null;
  category: string;
  severity: string;
  status: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { name: string | null; image: string | null } | null;
  reviewer: { name: string | null } | null;
}

interface SuggestionCardProps {
  suggestion: SuggestionCardData;
  isAuthor: boolean;
  currentUserId?: string;
  skillSlug: string;
}

// =============================================================================
// Helpers
// =============================================================================

/** Compute a relative time string from an ISO date (UTC-safe, no locale) */
function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 30) {
    const d = new Date(isoString);
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }
  if (diffDay > 0) return diffDay + (diffDay === 1 ? " day ago" : " days ago");
  if (diffHr > 0) return diffHr + (diffHr === 1 ? " hour ago" : " hours ago");
  if (diffMin > 0) return diffMin + (diffMin === 1 ? " minute ago" : " minutes ago");
  return "just now";
}

/** Format date as "MMM D, YYYY" using UTC to avoid hydration mismatches */
function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
}

// =============================================================================
// Component
// =============================================================================

export function SuggestionCard({ suggestion, isAuthor, skillSlug }: SuggestionCardProps) {
  const router = useRouter();

  // Action pending state
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reply textarea toggle and content
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  // ------------------------------------------
  // Action handlers (follow admin-review-detail pattern)
  // ------------------------------------------

  async function handleStatusUpdate(newStatus: string) {
    setPending(newStatus);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("feedbackId", suggestion.id);
      formData.set("skillSlug", skillSlug);
      formData.set("newStatus", newStatus);

      const result = await updateSuggestionStatus({}, formData);
      if (result.message && !result.success) {
        setError(result.message);
      } else {
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setPending(null);
    }
  }

  async function handleReply() {
    if (!replyText.trim()) return;
    setPending("reply");
    setError(null);
    try {
      const formData = new FormData();
      formData.set("feedbackId", suggestion.id);
      formData.set("skillSlug", skillSlug);
      formData.set("reviewNotes", replyText.trim());

      const result = await replySuggestion({}, formData);
      if (result.message && !result.success) {
        setError(result.message);
      } else {
        setShowReply(false);
        setReplyText("");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setPending(null);
    }
  }

  // ------------------------------------------
  // Render
  // ------------------------------------------

  const status = suggestion.status;
  const statusColor = STATUS_COLORS[status] || "bg-gray-100 text-gray-600";
  const statusLabel = STATUS_LABELS[status] || status;
  const severityColor = SEVERITY_COLORS[suggestion.severity] || "bg-gray-100 text-gray-600";
  const severityLabel = SEVERITY_LABELS[suggestion.severity] || suggestion.severity;
  const categoryLabel = CATEGORY_LABELS[suggestion.category] || suggestion.category;
  const userName = suggestion.user?.name || "Anonymous";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header row: user, time, badges */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-900">{userName}</span>
        <span className="text-xs text-gray-400">{relativeTime(suggestion.createdAt)}</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
        >
          {statusLabel}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityColor}`}
        >
          {severityLabel}
        </span>
      </div>

      {/* Category label */}
      <div className="mb-2">
        <span className="text-xs font-medium text-gray-500">{categoryLabel}</span>
      </div>

      {/* Comment body */}
      {suggestion.comment && (
        <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{suggestion.comment}</p>
      )}

      {/* Suggested content (if provided) */}
      {suggestion.suggestedContent && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Suggested content:</p>
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 font-mono whitespace-pre-wrap">
            {suggestion.suggestedContent}
          </div>
        </div>
      )}

      {/* Author reply (if reviewNotes exists) */}
      {suggestion.reviewNotes && (
        <div className="mb-3 rounded-md bg-blue-50 border border-blue-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-blue-700">
              Reply from {suggestion.reviewer?.name || "Author"}
            </span>
            {suggestion.reviewedAt && (
              <span className="text-xs text-blue-500">{formatDate(suggestion.reviewedAt)}</span>
            )}
          </div>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{suggestion.reviewNotes}</p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Author actions */}
      {isAuthor && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {/* Pending status actions */}
          {status === "pending" && (
            <>
              <button
                onClick={() => handleStatusUpdate("accepted")}
                disabled={pending !== null}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending === "accepted" ? "Accepting..." : "Accept"}
              </button>
              <button
                onClick={() => handleStatusUpdate("dismissed")}
                disabled={pending !== null}
                className="rounded-md bg-gray-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending === "dismissed" ? "Dismissing..." : "Dismiss"}
              </button>
              <button
                onClick={() => setShowReply(!showReply)}
                disabled={pending !== null}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reply
              </button>
            </>
          )}

          {/* Accepted status actions */}
          {status === "accepted" && (
            <>
              <button
                onClick={() => handleStatusUpdate("implemented")}
                disabled={pending !== null}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending === "implemented" ? "Marking..." : "Mark Implemented"}
              </button>
              <button
                onClick={() => handleStatusUpdate("dismissed")}
                disabled={pending !== null}
                className="rounded-md bg-gray-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending === "dismissed" ? "Dismissing..." : "Dismiss"}
              </button>
              <button
                onClick={() => setShowReply(!showReply)}
                disabled={pending !== null}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reply
              </button>
            </>
          )}

          {/* Dismissed status actions */}
          {status === "dismissed" && (
            <button
              onClick={() => handleStatusUpdate("pending")}
              disabled={pending !== null}
              className="rounded-md bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending === "pending" ? "Reopening..." : "Reopen"}
            </button>
          )}

          {/* Implemented -- no further actions, but allow reply */}
          {status === "implemented" && (
            <button
              onClick={() => setShowReply(!showReply)}
              disabled={pending !== null}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reply
            </button>
          )}
        </div>
      )}

      {/* Reply textarea (collapsible) */}
      {showReply && (
        <div className="mt-3 space-y-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleReply}
              disabled={pending !== null || !replyText.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending === "reply" ? "Sending..." : "Send Reply"}
            </button>
            <button
              onClick={() => {
                setShowReply(false);
                setReplyText("");
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
