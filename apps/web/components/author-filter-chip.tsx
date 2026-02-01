"use client";

import { useAuthorFilter } from "@/hooks/use-author-filter";

interface AuthorFilterChipProps {
  authorName: string;
}

export function AuthorFilterChip({ authorName }: AuthorFilterChipProps) {
  const { author, clearAuthor, isPending } = useAuthorFilter();

  if (!author) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
      Author: {authorName}
      <button
        onClick={clearAuthor}
        disabled={isPending}
        className="ml-1 rounded-full p-0.5 hover:bg-blue-200 transition-colors"
        aria-label="Clear author filter"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
