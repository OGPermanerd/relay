"use client";

import { useState, useActionState } from "react";
import { forkSkill, type ForkSkillState } from "@/app/actions/fork-skill";

interface ForkButtonProps {
  skillId: string;
  skillName: string;
  forkCount: number;
  isAuthor?: boolean;
}

const initialState: ForkSkillState = {};

export function ForkButton({ skillId, skillName, forkCount, isAuthor }: ForkButtonProps) {
  const [showModal, setShowModal] = useState<"fork" | "improve" | null>(null);
  const [state, action, isPending] = useActionState(forkSkill, initialState);

  return (
    <>
      {/* Primary: Fork & Improve with AI (non-authors only) */}
      {!isAuthor && (
        <button
          type="button"
          onClick={() => setShowModal("improve")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
            />
          </svg>
          Fork &amp; Improve
        </button>
      )}

      {/* Secondary: Plain Fork */}
      <button
        type="button"
        onClick={() => setShowModal("fork")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Zm0 12.814a2.25 2.25 0 1 0 3.933 2.185 2.25 2.25 0 0 0-3.933-2.185Z"
          />
        </svg>
        Fork{forkCount > 0 ? ` (${forkCount})` : ""}
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !isPending && setShowModal(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">
              {showModal === "improve" ? "Fork & improve with AI" : "Fork skill"}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {showModal === "improve" ? (
                <>
                  Fork &ldquo;{skillName}&rdquo;? You&apos;ll get your own copy with AI-powered
                  improvements.
                </>
              ) : (
                <>
                  Fork &ldquo;{skillName}&rdquo;? You&apos;ll get a copy to customize and publish as
                  your own.
                </>
              )}
            </p>

            {state.error && (
              <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
                {state.error}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(null)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <form action={action}>
                <input type="hidden" name="skillId" value={skillId} />
                {showModal === "improve" && <input type="hidden" name="improve" value="1" />}
                <button
                  type="submit"
                  disabled={isPending}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300 ${
                    showModal === "improve"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isPending ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Forking...
                    </>
                  ) : showModal === "improve" ? (
                    "Fork & Improve"
                  ) : (
                    "Fork"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
