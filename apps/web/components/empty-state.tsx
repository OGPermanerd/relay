import Link from "next/link";

type EmptyStateType = "no-results" | "no-skills" | "empty-category";

interface EmptyStateProps {
  type: EmptyStateType;
  query?: string;
  category?: string;
  onClearFilters?: () => void;
}

const CONTENT: Record<
  EmptyStateType,
  {
    title: string;
    getDescription: (props: EmptyStateProps) => string;
    suggestions: string[] | null;
    action: { label: string; href?: string } | null;
  }
> = {
  "no-results": {
    title: "No skills found",
    getDescription: (props) =>
      props.query
        ? `We couldn't find any skills matching "${props.query}"`
        : "Try adjusting your filters",
    suggestions: ["Try different keywords", "Browse by category", "Check spelling"],
    action: null, // Clear filters action handled by prop
  },
  "no-skills": {
    title: "No skills yet",
    getDescription: () => "Be the first to share a skill with your team",
    suggestions: null,
    action: { label: "Share a skill", href: "/skills/new" },
  },
  "empty-category": {
    title: "No skills in this category",
    getDescription: (props) => `There are no ${props.category || "matching"} skills yet`,
    suggestions: ["Try another category", "Search for related skills"],
    action: { label: "Share a skill", href: "/skills/new" },
  },
};

/**
 * Empty state component with contextual guidance
 *
 * Provides helpful next steps when:
 * - Search returns no results
 * - No skills exist in the system
 * - A category has no skills
 */
export function EmptyState({ type, query, category, onClearFilters }: EmptyStateProps) {
  const content = CONTENT[type];
  const description = content.getDescription({ type, query, category });

  return (
    <div className="flex flex-col items-center py-12 text-center">
      {/* Search icon */}
      <div className="rounded-full bg-gray-100 p-4">
        <svg
          className="h-8 w-8 text-gray-400"
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

      {/* Title and description */}
      <h2 className="mt-4 text-lg font-semibold text-gray-900">{content.title}</h2>
      <p className="mt-2 max-w-sm text-gray-600">{description}</p>

      {/* Action button */}
      {type === "no-results" && onClearFilters ? (
        <button
          onClick={onClearFilters}
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Clear filters
        </button>
      ) : content.action?.href ? (
        <Link
          href={content.action.href}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {content.action.label}
        </Link>
      ) : null}

      {/* Suggestions */}
      {content.suggestions && (
        <ul className="mt-6 space-y-1 text-sm text-gray-500">
          {content.suggestions.map((suggestion, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-gray-300">•</span>
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
