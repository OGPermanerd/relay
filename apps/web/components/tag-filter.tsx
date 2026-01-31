"use client";

import { useQueryState, parseAsArrayOf, parseAsString } from "nuqs";
import { useTransition } from "react";

interface TagFilterProps {
  availableTags: string[];
}

/**
 * Tag filter chips with URL synchronization
 *
 * Shows available tags as toggleable chips.
 * Uses nuqs to sync selected tags to URL 'tags' parameter as comma-separated values.
 */
export function TagFilter({ availableTags }: TagFilterProps) {
  const [selectedTags, setSelectedTags] = useQueryState(
    "tags",
    parseAsArrayOf(parseAsString, ",").withDefault([])
  );
  const [isPending, startTransition] = useTransition();

  const toggleTag = (tag: string) => {
    startTransition(() => {
      const newTags = selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag];

      setSelectedTags(newTags.length > 0 ? newTags : null);
    });
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
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              disabled={isPending}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
