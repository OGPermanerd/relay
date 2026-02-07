"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsString } from "nuqs";
import { quickSearch, type QuickSearchResult } from "@/app/actions/search";

interface SearchWithDropdownProps {
  mode: "navigate" | "filter";
  initialQuery?: string;
}

export function SearchWithDropdown({ mode, initialQuery = "" }: SearchWithDropdownProps) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<QuickSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const urlDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // nuqs URL sync for filter mode
  const [, setQuery] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: false })
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    try {
      const data = await quickSearch(query);
      setResults(data);
      setIsOpen(data.length > 0);
      setHighlightIndex(-1);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Debounced search for dropdown
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(value);
    }, 300);

    // In filter mode, also debounce URL sync
    if (mode === "filter") {
      if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
      urlDebounceRef.current = setTimeout(() => {
        startTransition(() => {
          setQuery(value || null);
        });
      }, 300);
    }
  };

  const navigateToResult = useCallback(
    (slug: string) => {
      setIsOpen(false);
      router.push(`/skills/${slug}`);
    },
    [router]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);

    if (highlightIndex >= 0 && highlightIndex < results.length) {
      navigateToResult(results[highlightIndex].slug);
      return;
    }

    if (mode === "navigate") {
      if (inputValue.trim()) {
        router.push(`/skills?q=${encodeURIComponent(inputValue.trim())}`);
      } else {
        router.push("/skills");
      }
    }
    // In filter mode, Enter just closes the dropdown (URL already synced)
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          type="search"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Search skills..."
          className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoComplete="off"
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
        {(isSearching || isPending) && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          </div>
        )}
      </form>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {results.map((result, index) => (
            <button
              key={result.id}
              type="button"
              className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition ${
                index === highlightIndex ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
              onMouseEnter={() => setHighlightIndex(index)}
              onClick={() => navigateToResult(result.slug)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{result.name}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500">{result.description}</p>
              </div>
              <span className="mt-0.5 shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                {result.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
