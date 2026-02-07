"use client";

import { useState, useActionState } from "react";
import { deleteSkillAction, type DeleteSkillState } from "@/app/actions/delete-skill";

interface DeleteSkillButtonProps {
  skillId: string;
  skillName: string;
  totalUses: number;
  forkCount: number;
}

const initialState: DeleteSkillState = {};

export function DeleteSkillButton({
  skillId,
  skillName,
  totalUses,
  forkCount,
}: DeleteSkillButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [state, action, isPending] = useActionState(deleteSkillAction, initialState);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
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
            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
          />
        </svg>
        Delete
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !isPending && setShowModal(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">Delete skill</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete &ldquo;{skillName}&rdquo;? This action cannot be
              undone.
            </p>

            {totalUses > 0 && (
              <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded-md p-3">
                This skill has been used {totalUses} time{totalUses !== 1 ? "s" : ""}.
              </p>
            )}

            {forkCount > 0 && (
              <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded-md p-3">
                This skill has {forkCount} fork{forkCount !== 1 ? "s" : ""} that will be detached.
              </p>
            )}

            {state.error && (
              <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <form action={action}>
                <input type="hidden" name="skillId" value={skillId} />
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300"
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
                      Deleting...
                    </>
                  ) : (
                    "Delete"
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
