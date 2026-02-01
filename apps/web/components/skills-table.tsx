import Link from "next/link";
import { Sparkline } from "./sparkline";

export interface SkillTableRow {
  id: string;
  name: string;
  slug: string;
  totalUses: number;
  hoursSaved: number | null;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
  } | null;
}

export interface SkillsTableProps {
  skills: SkillTableRow[];
  usageTrends: Map<string, number[]>;
}

/**
 * Skills table with 6-column structure for two-panel layout
 *
 * Columns:
 * 1. Skill Name - left aligned
 * 2. Days Saved - right aligned (totalUses * hoursSaved / 8)
 * 3. Installs - right aligned (totalUses)
 * 4. Date Added - right aligned (MMM D, YYYY format)
 * 5. Author - left aligned
 * 6. Sparkline - center aligned
 *
 * Server Component - no interactivity (sorting added in Phase 13)
 */
export function SkillsTable({ skills, usageTrends }: SkillsTableProps) {
  if (skills.length === 0) {
    return <p className="text-gray-500">No skills found.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Skill Name
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Days Saved
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Installs
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Date Added
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Author
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Sparkline
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {skills.map((skill, index) => {
            // Calculate FTE Days Saved: (totalUses * hoursSaved) / 8
            const daysSaved = ((skill.totalUses * (skill.hoursSaved ?? 1)) / 8).toFixed(1);

            // Format date as "MMM D, YYYY" (e.g., "Jan 15, 2026")
            const dateAdded = skill.createdAt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            // Get usage trend for sparkline
            const trend = usageTrends.get(skill.id) || [];

            return (
              <tr
                key={skill.id}
                className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} transition-colors hover:bg-blue-50`}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={`/skills/${skill.slug}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600"
                  >
                    {skill.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
                  {daysSaved}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
                  {skill.totalUses.toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
                  {dateAdded}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {skill.author?.name || "Anonymous"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <div className="inline-block">
                    <Sparkline data={trend} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
