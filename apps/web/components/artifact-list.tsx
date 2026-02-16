"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWorkArtifact, deleteWorkArtifact } from "@/app/actions/work-artifacts";
import type { WorkArtifactEntry } from "@/lib/portfolio-queries";

// ---------------------------------------------------------------------------
// UTC-safe date formatting (no toLocaleDateString — hydration risk)
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
}

function toInputDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Category badge colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  document: "bg-blue-100 text-blue-700",
  email: "bg-purple-100 text-purple-700",
  template: "bg-green-100 text-green-700",
  script: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

const CATEGORIES = ["document", "email", "template", "script", "other"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ArtifactListProps {
  artifacts: WorkArtifactEntry[];
}

export function ArtifactList({ artifacts }: ArtifactListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!window.confirm("Delete this artifact? This cannot be undone.")) return;

    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const result = await deleteWorkArtifact(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleEditSave(form: HTMLFormElement) {
    setError(null);
    const fd = new FormData(form);

    startTransition(async () => {
      const result = await updateWorkArtifact(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        setEditingId(null);
        router.refresh();
      }
    });
  }

  if (artifacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-gray-500">
          No pre-platform artifacts yet. Upload historical work to showcase your experience.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {artifacts.map((artifact) => {
        const isEditing = editingId === artifact.id;
        const categoryColor = CATEGORY_COLORS[artifact.category] || CATEGORY_COLORS.other;

        if (isEditing) {
          return (
            <EditRow
              key={artifact.id}
              artifact={artifact}
              isPending={isPending}
              onSave={handleEditSave}
              onCancel={() => setEditingId(null)}
            />
          );
        }

        return (
          <div
            key={artifact.id}
            className="flex items-start justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{artifact.title}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${categoryColor}`}
                >
                  {artifact.category}
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Pre-platform
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>{formatDate(artifact.artifactDate)}</span>
                {artifact.estimatedHoursSaved != null && (
                  <span>{artifact.estimatedHoursSaved}h saved</span>
                )}
                {artifact.fileName && <span className="text-gray-400">{artifact.fileName}</span>}
              </div>
              {artifact.description && (
                <p className="mt-1 text-sm text-gray-600">
                  {artifact.description.length > 100
                    ? artifact.description.slice(0, 100) + "..."
                    : artifact.description}
                </p>
              )}
            </div>

            <div className="ml-4 flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingId(artifact.id)}
                disabled={isPending}
                className="text-sm text-gray-500 hover:text-indigo-600 disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(artifact.id)}
                disabled={isPending}
                className="text-sm text-gray-500 hover:text-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Edit Row
// ---------------------------------------------------------------------------

interface EditRowProps {
  artifact: WorkArtifactEntry;
  isPending: boolean;
  onSave: (form: HTMLFormElement) => void;
  onCancel: () => void;
}

function EditRow({ artifact, isPending, onSave, onCancel }: EditRowProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(e.currentTarget);
      }}
      className="rounded-lg border border-indigo-200 bg-indigo-50/30 px-4 py-3"
    >
      <input type="hidden" name="id" value={artifact.id} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2">
          <input
            name="title"
            type="text"
            required
            maxLength={200}
            defaultValue={artifact.title}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Category */}
        <div>
          <select
            name="category"
            defaultValue={artifact.category}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <input
            name="artifactDate"
            type="date"
            required
            defaultValue={toInputDate(artifact.artifactDate)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Hours */}
        <div>
          <input
            name="estimatedHoursSaved"
            type="number"
            min={0}
            max={10000}
            step="0.5"
            placeholder="Est. hours saved"
            defaultValue={artifact.estimatedHoursSaved ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <textarea
            name="description"
            rows={2}
            maxLength={2000}
            defaultValue={artifact.description ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
