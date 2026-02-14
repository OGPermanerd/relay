/**
 * Single source of truth for skill categories.
 *
 * Every component, action, and validation schema should import from here
 * rather than defining its own category list.
 */

export const CATEGORIES = ["productivity", "wiring", "doc-production", "data-viz", "code"] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  productivity: "Productivity",
  wiring: "Wiring",
  "doc-production": "Doc Production",
  "data-viz": "Data & Viz",
  code: "Code",
};

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  productivity: "Save time on everyday tasks",
  wiring: "Connect tools and automate flows",
  "doc-production": "Generate docs and reports",
  "data-viz": "Analyze data and create visuals",
  code: "Write, review, and ship code",
};

/** Tile styling for homepage category tiles */
export const CATEGORY_STYLES: Record<
  Category,
  {
    bgColor: string;
    borderColor: string;
    iconColor: string;
    textColor: string;
    hoverBorder: string;
    iconPath: string;
  }
> = {
  productivity: {
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    iconColor: "text-blue-600",
    textColor: "text-blue-700",
    hoverBorder: "hover:border-blue-400",
    // Clock icon
    iconPath: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  wiring: {
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    iconColor: "text-purple-600",
    textColor: "text-purple-700",
    hoverBorder: "hover:border-purple-400",
    // Link/chain icon (Heroicons v2 outline)
    iconPath:
      "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
  },
  "doc-production": {
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    iconColor: "text-emerald-600",
    textColor: "text-emerald-700",
    hoverBorder: "hover:border-emerald-400",
    // Document icon
    iconPath:
      "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  },
  "data-viz": {
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    iconColor: "text-amber-600",
    textColor: "text-amber-700",
    hoverBorder: "hover:border-amber-400",
    // Chart bar icon
    iconPath:
      "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  },
  code: {
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    iconColor: "text-rose-600",
    textColor: "text-rose-700",
    hoverBorder: "hover:border-rose-400",
    // Code bracket icon
    iconPath: "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5",
  },
};

/** Active (selected) button colors for filter buttons */
export const CATEGORY_ACTIVE_COLORS: Record<Category, string> = {
  productivity: "bg-blue-600 text-white",
  wiring: "bg-purple-600 text-white",
  "doc-production": "bg-emerald-600 text-white",
  "data-viz": "bg-amber-600 text-white",
  code: "bg-rose-600 text-white",
};

/** Inactive (unselected) button colors for filter buttons */
export const CATEGORY_INACTIVE_COLORS: Record<Category, string> = {
  productivity: "bg-blue-50 text-blue-700 hover:bg-blue-100",
  wiring: "bg-purple-50 text-purple-700 hover:bg-purple-100",
  "doc-production": "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  "data-viz": "bg-amber-50 text-amber-700 hover:bg-amber-100",
  code: "bg-rose-50 text-rose-700 hover:bg-rose-100",
};

/** Badge colors for discovery results and other contexts */
export const CATEGORY_BADGE_COLORS: Record<Category, string> = {
  productivity: "bg-blue-100 text-blue-700",
  wiring: "bg-purple-100 text-purple-700",
  "doc-production": "bg-emerald-100 text-emerald-700",
  "data-viz": "bg-amber-100 text-amber-700",
  code: "bg-rose-100 text-rose-700",
};
