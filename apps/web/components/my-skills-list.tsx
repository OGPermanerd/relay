"use client";

import Link from "next/link";
import { DeleteSkillButton } from "./delete-skill-button";
import { RelativeTime } from "@/components/relative-time";

const CATEGORY_COLORS: Record<string, string> = {
  prompt: "bg-blue-100 text-blue-700",
  workflow: "bg-purple-100 text-purple-700",
  agent: "bg-green-100 text-green-700",
  mcp: "bg-orange-100 text-orange-700",
};

export interface MySkillItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  totalUses: number;
  averageRating: number | null;
  createdAt: string;
  forkCount: number;
}

interface MySkillsListProps {
  skills: MySkillItem[];
}

export function MySkillsList({ skills }: MySkillsListProps) {
  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <div
          key={skill.id}
          className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Link
                href={`/skills/${skill.slug}`}
                className="text-base font-medium text-gray-900 hover:text-blue-600 truncate"
              >
                {skill.name}
              </Link>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[skill.category] || "bg-gray-100 text-gray-700"}`}
              >
                {skill.category}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
              <span>
                {skill.totalUses} use{skill.totalUses !== 1 ? "s" : ""}
              </span>
              <span>
                {skill.averageRating !== null
                  ? `${(skill.averageRating / 100).toFixed(1)} stars`
                  : "No ratings"}
              </span>
              <RelativeTime date={skill.createdAt} />
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <DeleteSkillButton
              skillId={skill.id}
              skillName={skill.name}
              totalUses={skill.totalUses}
              forkCount={skill.forkCount}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
