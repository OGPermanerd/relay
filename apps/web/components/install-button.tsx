"use client";

interface InstallButtonProps {
  skillName: string;
  isCopied: boolean;
  onCopy: () => void;
  variant?: "full" | "icon";
}

/**
 * Install button with copy-to-clipboard functionality
 *
 * Variants:
 * - "full": Rounded button with text "Install" / "Copied!"
 * - "icon": Compact download icon for table rows
 *
 * Uses stopPropagation on icon variant to prevent row expansion
 */
export function InstallButton({
  skillName,
  isCopied,
  onCopy,
  variant = "full",
}: InstallButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (variant === "icon") {
      e.stopPropagation();
    }
    onCopy();
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        className="rounded p-1 transition-colors hover:bg-gray-100"
        title={isCopied ? "Copied!" : `Install ${skillName}`}
        aria-label={isCopied ? "Copied to clipboard" : `Install ${skillName}`}
      >
        {isCopied ? (
          <svg
            className="h-5 w-5 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg
            className="h-5 w-5 text-gray-400 hover:text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
        )}
      </button>
    );
  }

  // Full variant
  return (
    <button
      onClick={handleClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        isCopied ? "bg-green-100 text-green-800" : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
      aria-label={isCopied ? "Copied to clipboard" : `Install ${skillName}`}
    >
      {isCopied ? "Copied!" : "Install"}
    </button>
  );
}
