"use client";

import { useActionState, useState } from "react";
import { RelativeTime } from "@/components/relative-time";
import {
  deleteSkillAdminAction,
  bulkMergeSkillsAction,
  type AdminSkill,
  type DeleteSkillState,
  type BulkMergeState,
} from "@/app/actions/admin-skills";

interface AdminSkillsTableProps {
  skills: AdminSkill[];
}

export function AdminSkillsTable({ skills }: AdminSkillsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [confirmMerge, setConfirmMerge] = useState(false);

  const [deleteState, deleteAction, deletePending] = useActionState<DeleteSkillState, FormData>(
    deleteSkillAdminAction,
    {}
  );

  const [mergeState, mergeAction, mergePending] = useActionState<BulkMergeState, FormData>(
    bulkMergeSkillsAction,
    {}
  );

  const allSelected = skills.length > 0 && selected.size === skills.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(skills.map((s) => s.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Skills available as merge targets (must be in selected set)
  const selectedSkills = skills.filter((s) => selected.has(s.id));
  const showMerge = selectedSkills.length >= 2;

  if (skills.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">No skills found in this tenant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Delete error/success feedback */}
      {deleteState.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{deleteState.error}</div>
      )}
      {deleteState.success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          Skill deleted successfully.
        </div>
      )}

      {/* Merge section */}
      {showMerge && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900">
            Bulk Merge ({selectedSkills.length} skills selected)
          </h3>
          <p className="mt-1 text-xs text-blue-700">
            All selected source skills will be merged into the target. Usage events, ratings, and
            forks will be transferred. Source skills will be deleted.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="mergeTarget" className="block text-xs font-medium text-blue-800">
                Merge target (keep this skill)
              </label>
              <select
                id="mergeTarget"
                value={mergeTargetId}
                onChange={(e) => {
                  setMergeTargetId(e.target.value);
                  setConfirmMerge(false);
                }}
                className="mt-1 block w-64 rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select target...</option>
                {selectedSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.totalUses} uses)
                  </option>
                ))}
              </select>
            </div>

            {mergeTargetId && (
              <label className="flex items-center gap-2 text-xs text-blue-800">
                <input
                  type="checkbox"
                  checked={confirmMerge}
                  onChange={(e) => setConfirmMerge(e.target.checked)}
                  className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                I understand this will delete{" "}
                {selectedSkills.filter((s) => s.id !== mergeTargetId).length} skill(s)
              </label>
            )}

            {mergeTargetId && confirmMerge && (
              <form action={mergeAction}>
                <input type="hidden" name="targetId" value={mergeTargetId} />
                <input type="hidden" name="skillIds" value={Array.from(selected).join(",")} />
                <button
                  type="submit"
                  disabled={mergePending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {mergePending ? "Merging..." : "Merge Skills"}
                </button>
              </form>
            )}
          </div>

          {/* Merge result feedback */}
          {mergeState.success && (
            <div className="mt-3 rounded-md bg-green-50 p-2 text-sm text-green-700">
              Successfully merged {mergeState.merged} skill(s).
            </div>
          )}
          {mergeState.errors && mergeState.errors.length > 0 && (
            <div className="mt-3 space-y-1">
              {mergeState.errors.map((err, i) => (
                <div key={i} className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                  {err}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Select all skills"
                />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Author
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Uses
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Created
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {skills.map((skill) => (
              <tr key={skill.id} className="hover:bg-gray-50">
                <td className="w-10 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selected.has(skill.id)}
                    onChange={() => toggleOne(skill.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label={`Select ${skill.name}`}
                  />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {skill.name}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {skill.authorName || "Unknown"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {skill.totalUses}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  <RelativeTime date={skill.createdAt} />
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <form action={deleteAction}>
                    <input type="hidden" name="skillId" value={skill.id} />
                    <button
                      type="submit"
                      disabled={deletePending}
                      className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      onClick={(e) => {
                        if (!confirm(`Delete "${skill.name}"? This cannot be undone.`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
