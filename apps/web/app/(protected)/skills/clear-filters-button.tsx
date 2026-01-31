"use client";

import { useRouter } from "next/navigation";

/**
 * Client component to clear all search filters
 *
 * Navigates to /skills without any query parameters
 */
export function ClearFiltersButton() {
  const router = useRouter();

  const handleClear = () => {
    router.push("/skills");
  };

  return (
    <div className="mt-4 text-center">
      <button
        onClick={handleClear}
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
      >
        Clear all filters
      </button>
    </div>
  );
}
