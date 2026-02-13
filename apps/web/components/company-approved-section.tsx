"use client";

import Link from "next/link";
import type { CompanyApprovedSkill } from "@/lib/company-approved";
import { CompanyApprovedBadge } from "./company-approved-badge";

interface CompanyApprovedSectionProps {
  skills: CompanyApprovedSkill[];
}

export function CompanyApprovedSection({ skills }: CompanyApprovedSectionProps) {
  if (skills.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-indigo-900">
        <svg
          className="h-5 w-5 text-indigo-600"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
            clipRule="evenodd"
          />
        </svg>
        Company Recommended
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {skills.map((skill) => (
          <Link
            key={skill.id}
            href={`/skills/${skill.slug}`}
            className="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 group-hover:text-indigo-600">
                  {skill.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{skill.description}</p>
              </div>
              <div className="ml-3 flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  {skill.category}
                </span>
                <CompanyApprovedBadge size="sm" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              {skill.authorName && <span>by {skill.authorName}</span>}
              <span>{skill.totalUses.toLocaleString()} uses</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
