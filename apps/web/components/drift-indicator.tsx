import Link from "next/link";

interface DriftIndicatorProps {
  driftStatus: "diverged" | "current" | "unknown";
  compareSlug?: string;
}

export function DriftIndicator({ driftStatus, compareSlug }: DriftIndicatorProps) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium";

  if (driftStatus === "current") {
    return <span className={`${base} bg-green-100 text-green-700`}>In sync with parent</span>;
  }

  if (driftStatus === "diverged") {
    return (
      <span className={`${base} bg-amber-100 text-amber-700`}>
        Diverged from parent
        {compareSlug && (
          <>
            {" "}
            <Link
              href={`/skills/${compareSlug}/compare`}
              className="underline hover:text-amber-900"
            >
              Compare
            </Link>
          </>
        )}
      </span>
    );
  }

  // unknown
  return <span className={`${base} bg-gray-100 text-gray-600`}>Drift status unknown</span>;
}
