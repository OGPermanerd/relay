"use client";

import { useState, useTransition } from "react";
import { updateSkillSummary } from "@/app/actions/skills";

interface SkillSummaryCardsProps {
  skillId: string;
  inputs: string[];
  outputs: string[];
  activitiesSaved: string[];
  isAuthor: boolean;
}

function SummaryCard({
  title,
  icon,
  items,
  color,
  isAuthor,
  onSave,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  color: string;
  isAuthor: boolean;
  onSave: (items: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(items.join("\n"));

  const handleSave = () => {
    const newItems = editValue
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave(newItems);
    setEditing(false);
  };

  const hasItems = items.length > 0;

  return (
    <div className={`rounded-xl border ${color} p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        {isAuthor && !editing && (
          <button
            onClick={() => {
              setEditValue(items.join("\n"));
              setEditing(true);
            }}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label={`Edit ${title}`}
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
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="One item per line"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : hasItems ? (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-gray-400">
          {isAuthor ? "Click the pencil to add items" : "Not yet analyzed"}
        </p>
      )}
    </div>
  );
}

export function SkillSummaryCards({
  skillId,
  inputs: initialInputs,
  outputs: initialOutputs,
  activitiesSaved: initialActivities,
  isAuthor,
}: SkillSummaryCardsProps) {
  const [inputs, setInputs] = useState(initialInputs);
  const [outputs, setOutputs] = useState(initialOutputs);
  const [activitiesSaved, setActivitiesSaved] = useState(initialActivities);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (field: "inputs" | "outputs" | "activitiesSaved", newItems: string[]) => {
    const updated = {
      skillId,
      inputs: field === "inputs" ? newItems : inputs,
      outputs: field === "outputs" ? newItems : outputs,
      activitiesSaved: field === "activitiesSaved" ? newItems : activitiesSaved,
    };

    if (field === "inputs") setInputs(newItems);
    if (field === "outputs") setOutputs(newItems);
    if (field === "activitiesSaved") setActivitiesSaved(newItems);

    startTransition(async () => {
      const result = await updateSkillSummary(updated);
      if (!result.success) {
        setError(result.error || "Failed to save");
      } else {
        setError(null);
      }
    });
  };

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Inputs"
          color="border-blue-200 bg-blue-50/50"
          items={inputs}
          isAuthor={isAuthor}
          onSave={(items) => save("inputs", items)}
          icon={
            <svg
              className="h-5 w-5 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          }
        />
        <SummaryCard
          title="Outputs"
          color="border-emerald-200 bg-emerald-50/50"
          items={outputs}
          isAuthor={isAuthor}
          onSave={(items) => save("outputs", items)}
          icon={
            <svg
              className="h-5 w-5 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
          }
        />
        <SummaryCard
          title="Activities Saved"
          color="border-amber-200 bg-amber-50/50"
          items={activitiesSaved}
          isAuthor={isAuthor}
          onSave={(items) => save("activitiesSaved", items)}
          icon={
            <svg
              className="h-5 w-5 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>
    </div>
  );
}
