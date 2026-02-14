"use client";

import { useQueryState, parseAsStringEnum } from "nuqs";
import { useTransition } from "react";

import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/categories";

/**
 * Category filter tabs with URL synchronization
 *
 * Shows "All" plus each category as clickable tabs.
 * Uses nuqs to sync to URL 'category' parameter.
 */
export function CategoryFilter() {
  const [category, setCategory] = useQueryState(
    "category",
    parseAsStringEnum(CATEGORIES as unknown as string[]).withDefault(null as unknown as Category)
  );
  const [isPending, startTransition] = useTransition();

  const handleSelect = (value: Category | null) => {
    startTransition(() => {
      setCategory(value);
    });
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      <button
        onClick={() => handleSelect(null)}
        className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
          category === null
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
        disabled={isPending}
      >
        All
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => handleSelect(cat)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
            category === cat
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          disabled={isPending}
        >
          {CATEGORY_LABELS[cat]}
        </button>
      ))}
    </div>
  );
}
