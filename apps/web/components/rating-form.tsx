"use client";

import { useActionState } from "react";
import { submitRating, RatingState } from "@/app/actions/ratings";
import { StarRatingInput } from "./star-rating-input";
import { ThankYouButton } from "./thank-you-button";

interface RatingFormProps {
  skillId: string;
  skillSlug: string;
  existingRating?: {
    rating: number;
    comment: string | null;
    hoursSavedEstimate: number | null;
  };
  author?: {
    id: string;
    name: string | null;
  };
}

const initialState: RatingState = {};

export function RatingForm({ skillId, skillSlug, existingRating, author }: RatingFormProps) {
  const [state, formAction, isPending] = useActionState(submitRating, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden fields */}
      <input type="hidden" name="skillId" value={skillId} />
      <input type="hidden" name="skillSlug" value={skillSlug} />

      {/* Thank the author */}
      {author && (
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
          <span className="text-sm text-gray-600">
            Show appreciation to {author.name?.split(" ")[0] || "the author"}
          </span>
          <ThankYouButton userId={author.id} userName={author.name || "the author"} />
        </div>
      )}

      {/* Error message */}
      {state.message && !state.success && (
        <div className="rounded-md bg-red-50 p-4 text-red-700">{state.message}</div>
      )}

      {/* Success message */}
      {state.success && (
        <div className="rounded-md bg-green-50 p-4 text-green-700">{state.message}</div>
      )}

      {/* Star rating section */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Your Rating <span className="text-red-500">*</span>
        </label>
        <div className="mt-1">
          <StarRatingInput
            name="rating"
            defaultValue={existingRating?.rating}
            disabled={isPending}
          />
        </div>
        {state.errors?.rating && (
          <p className="mt-1 text-sm text-red-600">{state.errors.rating[0]}</p>
        )}
      </div>

      {/* Comment textarea */}
      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
          Comment (optional)
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={3}
          disabled={isPending}
          defaultValue={existingRating?.comment ?? ""}
          placeholder="Share your experience with this skill..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        {state.errors?.comment && (
          <p className="mt-1 text-sm text-red-600">{state.errors.comment[0]}</p>
        )}
      </div>

      {/* Hours saved estimate */}
      <div>
        <label htmlFor="hoursSavedEstimate" className="block text-sm font-medium text-gray-700">
          Hours Saved (optional)
        </label>
        <input
          type="number"
          id="hoursSavedEstimate"
          name="hoursSavedEstimate"
          min={0}
          max={1000}
          step={1}
          disabled={isPending}
          defaultValue={existingRating?.hoursSavedEstimate ?? ""}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <p className="mt-1 text-sm text-gray-500">
          Your estimate helps calculate accurate time savings
        </p>
        {state.errors?.hoursSavedEstimate && (
          <p className="mt-1 text-sm text-red-600">{state.errors.hoursSavedEstimate[0]}</p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        {isPending ? "Submitting..." : existingRating ? "Update Rating" : "Submit Rating"}
      </button>
    </form>
  );
}
