"use client";

import { useActionState } from "react";
import { submitTrainingExample } from "@/app/actions/skill-feedback";

type TrainingExampleFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

interface TrainingExampleFormProps {
  skillId: string;
  skillSlug: string;
}

const initialState: TrainingExampleFormState = {};

export function TrainingExampleForm({ skillId, skillSlug }: TrainingExampleFormProps) {
  const [state, formAction, isPending] = useActionState(submitTrainingExample, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden fields */}
      <input type="hidden" name="skillId" value={skillId} />
      <input type="hidden" name="skillSlug" value={skillSlug} />

      <h3 className="text-lg font-semibold text-gray-900">Add Golden Example</h3>

      {/* Error message */}
      {state.message && !state.success && (
        <div className="rounded-md bg-red-50 p-4 text-red-700">{state.message}</div>
      )}

      {/* Success message */}
      {state.success && (
        <div className="rounded-md bg-green-50 p-4 text-green-700">{state.message}</div>
      )}

      {/* Example Input textarea */}
      <div>
        <label htmlFor="training-example-input" className="block text-sm font-medium text-gray-700">
          Example Input <span className="text-red-500">*</span>
        </label>
        <textarea
          id="training-example-input"
          name="exampleInput"
          rows={4}
          required
          minLength={1}
          maxLength={5000}
          disabled={isPending}
          placeholder="The input or prompt given to the skill..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        {state.errors?.exampleInput && (
          <p className="mt-1 text-sm text-red-600">{state.errors.exampleInput[0]}</p>
        )}
      </div>

      {/* Expected Output textarea */}
      <div>
        <label
          htmlFor="training-example-output"
          className="block text-sm font-medium text-gray-700"
        >
          Expected Output <span className="text-red-500">*</span>
        </label>
        <textarea
          id="training-example-output"
          name="exampleOutput"
          rows={4}
          required
          minLength={1}
          maxLength={5000}
          disabled={isPending}
          placeholder="The ideal output the skill should produce..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        {state.errors?.exampleOutput && (
          <p className="mt-1 text-sm text-red-600">{state.errors.exampleOutput[0]}</p>
        )}
      </div>

      {/* Optional quality score */}
      <div>
        <label htmlFor="training-quality-score" className="block text-sm font-medium text-gray-700">
          Quality Score (optional, 1-10)
        </label>
        <input
          type="number"
          id="training-quality-score"
          name="qualityScore"
          min={1}
          max={10}
          disabled={isPending}
          className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        {state.errors?.qualityScore && (
          <p className="mt-1 text-sm text-red-600">{state.errors.qualityScore[0]}</p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        {isPending ? "Adding..." : "Add Training Example"}
      </button>
    </form>
  );
}
