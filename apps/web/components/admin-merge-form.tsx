"use client";

import { useState, useActionState, useRef, useEffect, useCallback } from "react";
import {
  mergeSkillsAction,
  searchSkillsForMerge,
  type MergeSkillsState,
  type MergeSearchResult,
} from "@/app/actions/merge-skills";

const initialState: MergeSkillsState = {};

export function AdminMergeForm() {
  const [state, action, isPending] = useActionState(mergeSkillsAction, initialState);

  const [sourceQuery, setSourceQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [sourceResults, setSourceResults] = useState<MergeSearchResult[]>([]);
  const [targetResults, setTargetResults] = useState<MergeSearchResult[]>([]);
  const [selectedSource, setSelectedSource] = useState<MergeSearchResult | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<MergeSearchResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const sourceTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const targetTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const searchSource = useCallback((query: string) => {
    setSourceQuery(query);
    setSelectedSource(null);
    if (sourceTimer.current) clearTimeout(sourceTimer.current);
    if (!query.trim()) {
      setSourceResults([]);
      return;
    }
    sourceTimer.current = setTimeout(async () => {
      const results = await searchSkillsForMerge(query);
      setSourceResults(results);
    }, 300);
  }, []);

  const searchTarget = useCallback((query: string) => {
    setTargetQuery(query);
    setSelectedTarget(null);
    if (targetTimer.current) clearTimeout(targetTimer.current);
    if (!query.trim()) {
      setTargetResults([]);
      return;
    }
    targetTimer.current = setTimeout(async () => {
      const results = await searchSkillsForMerge(query);
      setTargetResults(results);
    }, 300);
  }, []);

  useEffect(() => {
    if (state.success) {
      setSelectedSource(null);
      setSelectedTarget(null);
      setSourceQuery("");
      setTargetQuery("");
      setShowConfirm(false);
    }
  }, [state.success]);

  return (
    <div className="space-y-6">
      {/* Source skill */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Source skill (will be deleted)
        </label>
        <input
          type="text"
          value={sourceQuery}
          onChange={(e) => searchSource(e.target.value)}
          placeholder="Search by name..."
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        {sourceResults.length > 0 && !selectedSource && (
          <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            {sourceResults.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSource(s);
                    setSourceQuery(s.name);
                    setSourceResults([]);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-gray-500">
                    {s.totalUses} uses &middot; {s.authorName || "Unknown"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedSource && (
          <div className="mt-2 rounded-md bg-red-50 p-3 text-sm">
            <span className="font-medium text-red-800">{selectedSource.name}</span>
            <span className="ml-2 text-red-600">
              {selectedSource.totalUses} uses &middot; {selectedSource.authorName || "Unknown"}
            </span>
          </div>
        )}
      </div>

      {/* Target skill */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Target skill (will receive merged data)
        </label>
        <input
          type="text"
          value={targetQuery}
          onChange={(e) => searchTarget(e.target.value)}
          placeholder="Search by name..."
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        {targetResults.length > 0 && !selectedTarget && (
          <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            {targetResults.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTarget(s);
                    setTargetQuery(s.name);
                    setTargetResults([]);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-gray-500">
                    {s.totalUses} uses &middot; {s.authorName || "Unknown"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedTarget && (
          <div className="mt-2 rounded-md bg-green-50 p-3 text-sm">
            <span className="font-medium text-green-800">{selectedTarget.name}</span>
            <span className="ml-2 text-green-600">
              {selectedTarget.totalUses} uses &middot; {selectedTarget.authorName || "Unknown"}
            </span>
          </div>
        )}
      </div>

      {/* Status messages */}
      {state.success && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          Skills merged successfully.
        </p>
      )}
      {state.error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
      )}

      {/* Merge button */}
      {selectedSource && selectedTarget && !showConfirm && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Merge Source into Target
        </button>
      )}

      {showConfirm && selectedSource && selectedTarget && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            This will delete &ldquo;{selectedSource.name}&rdquo; and move all its usage, ratings,
            and forks to &ldquo;{selectedTarget.name}&rdquo;. This cannot be undone.
          </p>
          <div className="mt-3 flex gap-3">
            <form action={action}>
              <input type="hidden" name="sourceId" value={selectedSource.id} />
              <input type="hidden" name="targetId" value={selectedTarget.id} />
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300"
              >
                {isPending ? "Merging..." : "Confirm Merge"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
