"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { discoverSkills, type DiscoveryResult } from "@/app/actions/discover";

import { CATEGORY_BADGE_COLORS, CATEGORY_LABELS, type Category } from "@/lib/categories";

const CATEGORY_COLORS = CATEGORY_BADGE_COLORS as Record<string, string>;

const MATCH_DOT_COLORS: Record<string, string> = {
  keyword: "bg-blue-500",
  semantic: "bg-purple-500",
  both: "bg-gradient-to-r from-blue-500 to-purple-500",
};

function StarSvg() {
  return (
    <svg className="inline-block h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function SkeletonCards() {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-3 h-5 w-3/4 rounded bg-gray-200" />
            <div className="mb-2 h-3 w-full rounded bg-gray-200" />
            <div className="mb-3 h-3 w-2/3 rounded bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 rounded-full bg-gray-200" />
              <div className="h-2 w-2 rounded-full bg-gray-200" />
            </div>
            <div className="mt-2 h-3 w-5/6 rounded bg-gray-100" />
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-gray-400">Searching...</p>
    </div>
  );
}

function ResultCard({ result }: { result: DiscoveryResult }) {
  const badgeColor = CATEGORY_COLORS[result.category] || "bg-gray-100 text-gray-700";
  const dotColor = MATCH_DOT_COLORS[result.matchType] || "bg-gray-400";
  const truncatedDesc =
    result.description.length > 120 ? result.description.slice(0, 120) + "..." : result.description;

  return (
    <Link
      href={`/skills/${result.slug}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <h3 className="truncate text-base font-semibold text-gray-900">{result.name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">{truncatedDesc}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>
          {CATEGORY_LABELS[result.category as Category] || result.category}
        </span>
        {result.isBoosted && (
          <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600">
            <StarSvg />
            Recommended
          </span>
        )}
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`}
          title={`Match type: ${result.matchType}`}
        />
      </div>
      <p className="mt-2 text-xs italic text-gray-500">{result.matchRationale}</p>
    </Link>
  );
}

export function DiscoverySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const data = await discoverSkills(trimmed);
      setResults(data);
      setHasSearched(true);
    });
  };

  return (
    <div>
      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you need..."
            className="block w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-base text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoComplete="off"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
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
        </div>
        <button
          type="submit"
          disabled={isPending || !query.trim()}
          className="shrink-0 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Searching..." : "Discover"}
        </button>
      </form>

      {/* Loading skeleton */}
      {isPending && (
        <div className="mt-6">
          <SkeletonCards />
        </div>
      )}

      {/* Results */}
      {!isPending && hasSearched && results.length > 0 && (
        <div className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link
              href={`/skills?q=${encodeURIComponent(query.trim())}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              View all results for &ldquo;{query.trim()}&rdquo;
            </Link>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isPending && hasSearched && results.length === 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">
            No skills found matching your description. Try different terms or{" "}
            <Link
              href="/skills"
              className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              browse all skills
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
