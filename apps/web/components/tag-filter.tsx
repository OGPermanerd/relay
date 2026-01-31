"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface TagFilterProps {
  availableTags: string[];
}

/**
 * Tag filter chips
 *
 * Updates URL ?tags= parameter (comma-separated) when user selects tags.
 * Shows available tags based on current skills in the system.
 */
export function TagFilter({ availableTags }: TagFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTags = searchParams.get("tags")?.split(",").filter(Boolean) || [];

  const handleTagToggle = (tag: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentTags = params.get("tags")?.split(",").filter(Boolean) || [];

    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];

    if (newTags.length > 0) {
      params.set("tags", newTags.join(","));
    } else {
      params.delete("tags");
    }

    router.push(`/skills?${params.toString()}`);
  };

  if (availableTags.length === 0) {
    return null;
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">Filter by tags</label>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => handleTagToggle(tag)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
