"use client";

import { useQueryState, parseAsString } from "nuqs";
import { useTransition, useRef, useEffect } from "react";

/**
 * Search input with URL synchronization
 *
 * Uses nuqs to sync search query to URL 'q' parameter.
 * Debounces input to prevent excessive URL updates.
 * Uses startTransition for non-blocking updates.
 */
export function SearchInput() {
  const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce URL update (300ms)
    timeoutRef.current = setTimeout(() => {
      startTransition(() => {
        setQuery(value || null); // null removes param from URL
      });
    }, 300);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        placeholder="Search skills..."
        defaultValue={query}
        onChange={handleChange}
        className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg
          className="h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
      {isPending && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}
    </div>
  );
}
