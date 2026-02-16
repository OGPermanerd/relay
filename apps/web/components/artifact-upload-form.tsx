"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkArtifact } from "@/app/actions/work-artifacts";
import { parseArtifactFile } from "@/lib/artifact-parser";

const CATEGORIES = [
  { value: "document", label: "Document" },
  { value: "email", label: "Email" },
  { value: "template", label: "Template" },
  { value: "script", label: "Script" },
  { value: "other", label: "Other" },
] as const;

export function ArtifactUploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    const file = fileInput?.files?.[0];

    startTransition(async () => {
      try {
        // If file attached, extract text client-side
        if (file) {
          const parsed = await parseArtifactFile(file);
          formData.set("fileName", file.name);
          formData.set("fileType", parsed.fileType);
          if (parsed.text) {
            formData.set("extractedText", parsed.text);
          }
        }

        // Remove the file input from FormData (server doesn't accept File objects)
        formData.delete("file");

        const result = await createWorkArtifact(formData);

        if ("error" in result) {
          setError(result.error);
          return;
        }

        // Success: reset form, collapse, refresh page data
        formRef.current?.reset();
        setIsOpen(false);
        router.refresh();
      } catch {
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Pre-Platform Work
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Add Pre-Platform Work</h3>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setError(null);
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2">
          <label htmlFor="artifact-title" className="mb-1 block text-sm font-medium text-gray-700">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="artifact-title"
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="e.g., Weekly Status Report Template"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Category */}
        <div>
          <label
            htmlFor="artifact-category"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="artifact-category"
            name="category"
            required
            defaultValue="document"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label htmlFor="artifact-date" className="mb-1 block text-sm font-medium text-gray-700">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            id="artifact-date"
            name="artifactDate"
            type="date"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Estimated Hours Saved */}
        <div>
          <label htmlFor="artifact-hours" className="mb-1 block text-sm font-medium text-gray-700">
            Est. Hours Saved
          </label>
          <input
            id="artifact-hours"
            name="estimatedHoursSaved"
            type="number"
            min={0}
            max={10000}
            step="0.5"
            placeholder="e.g., 2"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* File */}
        <div>
          <label htmlFor="artifact-file" className="mb-1 block text-sm font-medium text-gray-700">
            Attach File
          </label>
          <input
            id="artifact-file"
            name="file"
            type="file"
            accept=".txt,.md,.json,.eml,.pdf,.doc,.docx,.xls,.xlsx"
            className="w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          <p className="mt-1 text-xs text-gray-400">
            Text extracted from .txt, .md, .json, .eml (max 5MB)
          </p>
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label
            htmlFor="artifact-description"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Description
          </label>
          <textarea
            id="artifact-description"
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="Brief description of this work artifact..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Artifact"}
        </button>
      </div>
    </form>
  );
}
