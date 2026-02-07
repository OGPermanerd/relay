import Link from "next/link";
import type { ForkInfo } from "@everyskill/db/services";

interface ForksSectionProps {
  forks: ForkInfo[];
  totalForkCount: number;
  parentSlug: string;
}

export function ForksSection({ forks, totalForkCount }: ForksSectionProps) {
  if (forks.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Forks ({totalForkCount})</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {forks.map((fork) => (
          <Link
            key={fork.id}
            href={`/skills/${fork.slug}`}
            className="flex flex-col gap-1 rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 truncate">{fork.name}</span>
              {fork.averageRating != null && (
                <span className="ml-2 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {(fork.averageRating / 100).toFixed(1)} stars
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 line-clamp-2">{fork.description}</p>
            {fork.author && (
              <p className="text-xs text-gray-400">by {fork.author.name || "Anonymous"}</p>
            )}
          </Link>
        ))}
      </div>
      {totalForkCount > forks.length && (
        <p className="mt-3 text-sm text-gray-500">
          Showing top {forks.length} of {totalForkCount} forks
        </p>
      )}
    </section>
  );
}
