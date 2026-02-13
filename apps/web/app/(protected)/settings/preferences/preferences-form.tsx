"use client";

import { useActionState, useState } from "react";
import {
  saveMyUserPreferences,
  type SaveUserPreferencesResult,
} from "@/app/actions/user-preferences";

interface PreferencesFormProps {
  initialPreferences: {
    preferredCategories: string[];
    defaultSort: string;
    claudeMdWorkflowNotes: string;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  prompt: "Prompts",
  workflow: "Workflows",
  agent: "Agents",
  mcp: "MCP",
};

const SORT_LABELS: Record<string, string> = {
  uses: "Most Used",
  quality: "Highest Quality",
  rating: "Best Rated",
  days_saved: "Most Time Saved",
};

export function PreferencesForm({ initialPreferences }: PreferencesFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: SaveUserPreferencesResult, formData: FormData) => {
      return saveMyUserPreferences(formData);
    },
    {} as SaveUserPreferencesResult
  );

  const [notesLength, setNotesLength] = useState(initialPreferences.claudeMdWorkflowNotes.length);

  return (
    <form action={formAction}>
      <div className="rounded-lg bg-white shadow-sm">
        {/* Section 1: Preferred Skill Categories */}
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-base font-medium text-gray-900">Preferred Categories</h2>
          <p className="mt-1 text-sm text-gray-500">Select the skill types you work with most</p>
          <div className="mt-4 space-y-3">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name={`cat_${value}`}
                  defaultChecked={initialPreferences.preferredCategories.includes(value)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Section 2: Default Sort Order */}
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-base font-medium text-gray-900">Default Sort</h2>
          <p className="mt-1 text-sm text-gray-500">
            How skills are sorted by default in browse views
          </p>
          <div className="mt-4">
            <label className="block text-sm text-gray-700">
              Sort order
              <select
                name="defaultSort"
                defaultValue={initialPreferences.defaultSort}
                className="ml-3 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Section 3: Workflow Notes for AI Export */}
        <div className="p-6">
          <h2 className="text-base font-medium text-gray-900">Workflow Notes</h2>
          <p className="mt-1 text-sm text-gray-500">
            Personal notes about your workflow preferences (included in CLAUDE.md export)
          </p>
          <div className="mt-4">
            <textarea
              name="claudeMdWorkflowNotes"
              defaultValue={initialPreferences.claudeMdWorkflowNotes}
              maxLength={2000}
              rows={4}
              onChange={(e) => setNotesLength(e.target.value.length)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="E.g., I prefer concise prompts with examples..."
            />
            <p className="mt-1 text-xs text-gray-400">{notesLength}/2000 characters</p>
          </div>
        </div>
      </div>

      {/* Feedback messages */}
      {state?.success && (
        <div className="mt-4 rounded-md bg-green-50 p-3">
          <p className="text-sm text-green-700">Preferences saved successfully.</p>
        </div>
      )}
      {state?.error && (
        <div className="mt-4 rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {/* Save button */}
      <div className="mt-6">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isPending ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </form>
  );
}
