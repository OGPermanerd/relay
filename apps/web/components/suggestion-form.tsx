"use client";

import { useState, useActionState } from "react";
import { submitSuggestion } from "@/app/actions/skill-feedback";

type SuggestionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

interface SuggestionFormProps {
  skillId: string;
  skillSlug: string;
}

const initialState: SuggestionState = {};

const CATEGORIES = [
  { value: "", label: "Select a category..." },
  { value: "output_quality", label: "Output Quality" },
  { value: "missing_feature", label: "Missing Feature" },
  { value: "error", label: "Error" },
  { value: "performance", label: "Performance" },
  { value: "other", label: "Other" },
];

const SEVERITIES = [
  { value: "", label: "Select severity..." },
  { value: "nice_to_have", label: "Nice to Have" },
  { value: "important", label: "Important" },
  { value: "critical", label: "Critical" },
];

export function SuggestionForm({ skillId, skillSlug }: SuggestionFormProps) {
  const [state, formAction, isPending] = useActionState(submitSuggestion, initialState);
  const [commentLength, setCommentLength] = useState(0);

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden fields */}
      <input type="hidden" name="skillId" value={skillId} />
      <input type="hidden" name="skillSlug" value={skillSlug} />

      <h3 className="text-lg font-semibold text-gray-900">Submit a Suggestion</h3>

      {/* Error message */}
      {state.message && !state.success && (
        <div className="rounded-md bg-red-50 p-4 text-red-700">{state.message}</div>
      )}

      {/* Success message */}
      {state.success && (
        <div className="rounded-md bg-green-50 p-4 text-green-700">{state.message}</div>
      )}

      {/* Category select */}
      <div>
        <label htmlFor="suggestion-category" className="block text-sm font-medium text-gray-700">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          id="suggestion-category"
          name="category"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        {state.errors?.category && (
          <p className="mt-1 text-sm text-red-600">{state.errors.category[0]}</p>
        )}
      </div>

      {/* Severity select */}
      <div>
        <label htmlFor="suggestion-severity" className="block text-sm font-medium text-gray-700">
          Severity <span className="text-red-500">*</span>
        </label>
        <select
          id="suggestion-severity"
          name="severity"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        >
          {SEVERITIES.map((sev) => (
            <option key={sev.value} value={sev.value}>
              {sev.label}
            </option>
          ))}
        </select>
        {state.errors?.severity && (
          <p className="mt-1 text-sm text-red-600">{state.errors.severity[0]}</p>
        )}
      </div>

      {/* Description textarea */}
      <div>
        <label htmlFor="suggestion-comment" className="block text-sm font-medium text-gray-700">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="suggestion-comment"
          name="comment"
          rows={4}
          required
          minLength={10}
          maxLength={2000}
          disabled={isPending}
          placeholder="Describe your suggestion in detail..."
          onChange={(e) => setCommentLength(e.target.value.length)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <div className="mt-1 flex justify-between">
          {state.errors?.comment ? (
            <p className="text-sm text-red-600">{state.errors.comment[0]}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-gray-400">{commentLength}/2000</span>
        </div>
      </div>

      {/* Suggested content textarea (optional) */}
      <div>
        <label
          htmlFor="suggestion-suggested-content"
          className="block text-sm font-medium text-gray-700"
        >
          Suggested Content (optional)
        </label>
        <textarea
          id="suggestion-suggested-content"
          name="suggestedContent"
          rows={3}
          maxLength={5000}
          disabled={isPending}
          placeholder="Optionally provide specific content or wording changes..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        {state.errors?.suggestedContent && (
          <p className="mt-1 text-sm text-red-600">{state.errors.suggestedContent[0]}</p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        {isPending ? "Submitting..." : "Submit Suggestion"}
      </button>
    </form>
  );
}
