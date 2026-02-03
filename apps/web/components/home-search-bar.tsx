"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function HomeSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      startTransition(() => {
        router.push(`/skills?q=${encodeURIComponent(query.trim())}`);
      });
    } else {
      startTransition(() => {
        router.push("/skills");
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search skills..."
        className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
    </form>
  );
}
