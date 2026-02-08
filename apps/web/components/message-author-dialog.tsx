"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { sendGroupingProposal, type MessageState } from "@/app/actions/skill-messages";
import type { SimilarSkillResult } from "@/lib/similar-skills";

interface MessageAuthorDialogProps {
  skill: SimilarSkillResult;
  onClose: () => void;
}

const MAX_MESSAGE_LENGTH = 1000;

export function MessageAuthorDialog({ skill, onClose }: MessageAuthorDialogProps) {
  const [state, formAction, isPending] = useActionState<MessageState, FormData>(
    sendGroupingProposal,
    {}
  );
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const closingRef = useRef(false);

  // On success, show brief confirmation then close
  useEffect(() => {
    if (state.success && !closingRef.current) {
      setShowSuccess(true);
      closingRef.current = true;
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  const charsRemaining = MAX_MESSAGE_LENGTH - message.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Propose Grouping</h2>
          <p className="mt-1 text-sm text-gray-500">
            Suggest that your skill could be grouped under &ldquo;{skill.skillName}&rdquo; by the
            original author.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {showSuccess ? (
            <div className="rounded-md bg-green-50 p-4 text-center text-green-700">
              Message sent!
            </div>
          ) : (
            <form action={formAction}>
              {/* Hidden fields */}
              <input type="hidden" name="toUserId" value={skill.authorId || ""} />
              <input type="hidden" name="subjectSkillId" value={skill.skillId} />
              <input type="hidden" name="proposedParentSkillId" value={skill.skillId} />

              {/* Error display */}
              {state.error && (
                <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {state.error}
                </div>
              )}

              {/* No authorId warning */}
              {!skill.authorId && (
                <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
                  This skill has no identified author. The message cannot be delivered.
                </div>
              )}

              {/* Message textarea */}
              <div>
                <label
                  htmlFor="proposal-message"
                  className="block text-sm font-medium text-gray-700"
                >
                  Message
                </label>
                <textarea
                  id="proposal-message"
                  name="message"
                  rows={4}
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={isPending || !skill.authorId}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  placeholder="Explain why your skill would be a good fit under this existing skill..."
                />
                <p
                  className={`mt-1 text-xs ${charsRemaining < 100 ? "text-amber-600" : "text-gray-400"}`}
                >
                  {charsRemaining} characters remaining
                </p>
              </div>

              {/* Actions */}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !skill.authorId || !message.trim()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {isPending ? "Sending..." : "Send Proposal"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
