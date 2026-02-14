import Link from "next/link";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_STYLES,
} from "@/lib/categories";

interface CategoryTilesProps {
  counts: Record<string, number>;
}

export function CategoryTiles({ counts }: CategoryTilesProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {CATEGORIES.map((key) => {
        const count = counts[key] ?? 0;
        const style = CATEGORY_STYLES[key];
        return (
          <Link
            key={key}
            href={`/skills?type=${key}`}
            className={`group rounded-xl border ${style.borderColor} ${style.bgColor} p-5 shadow-sm transition hover:shadow-md ${style.hoverBorder}`}
          >
            <div className="flex items-center gap-3">
              <svg
                className={`h-8 w-8 ${style.iconColor}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={style.iconPath} />
              </svg>
              <div>
                <h3 className={`font-semibold ${style.textColor}`}>{CATEGORY_LABELS[key]}</h3>
                <p className="text-xs text-gray-500">
                  {count} {count === 1 ? "skill" : "skills"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">{CATEGORY_DESCRIPTIONS[key]}</p>
          </Link>
        );
      })}
    </div>
  );
}
