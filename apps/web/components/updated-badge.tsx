interface UpdatedBadgeProps {
  size?: "sm" | "md";
}

/**
 * Updated badge with arrow-path (refresh) icon.
 * Shows when a skill has been modified since the user's last view.
 *
 * - sm: Icon only with tooltip (for table rows)
 * - md: Icon + "Updated" text (for detail pages)
 */
export function UpdatedBadge({ size = "sm" }: UpdatedBadgeProps) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  const iconSize = size === "sm" ? 12 : 16;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 font-medium text-amber-700 ${sizeClasses}`}
      title="Updated since your last visit"
    >
      <svg
        className="shrink-0"
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
      </svg>
      {size === "md" && <span>Updated</span>}
    </span>
  );
}
