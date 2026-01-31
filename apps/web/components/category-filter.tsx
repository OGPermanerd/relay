"use client";

import { useRouter, useSearchParams } from "next/navigation";

const CATEGORIES = ["prompt", "workflow", "agent", "mcp"] as const;

/**
 * Category filter tabs
 *
 * Updates URL ?category= parameter when user selects a category.
 * Shows "All" option to clear category filter.
 */
export function CategoryFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category");

  const handleCategoryChange = (category: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (category) {
      params.set("category", category);
    } else {
      params.delete("category");
    }

    router.push(`/skills?${params.toString()}`);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      <button
        onClick={() => handleCategoryChange(null)}
        className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
          !currentCategory
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        All
      </button>
      {CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => handleCategoryChange(category)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
            currentCategory === category
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
