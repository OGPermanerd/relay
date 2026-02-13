import Link from "next/link";

interface CategoryConfig {
  key: string;
  label: string;
  description: string;
  iconPath: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
  hoverBorder: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: "prompt",
    label: "Prompts",
    description: "Ready-to-use AI prompts",
    iconPath:
      "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    iconColor: "text-blue-600",
    textColor: "text-blue-700",
    hoverBorder: "hover:border-blue-400",
  },
  {
    key: "workflow",
    label: "Workflows",
    description: "Multi-step processes",
    iconPath:
      "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    iconColor: "text-purple-600",
    textColor: "text-purple-700",
    hoverBorder: "hover:border-purple-400",
  },
  {
    key: "agent",
    label: "Agents",
    description: "Autonomous AI agents",
    iconPath:
      "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    iconColor: "text-green-600",
    textColor: "text-green-700",
    hoverBorder: "hover:border-green-400",
  },
  {
    key: "mcp",
    label: "MCP Tools",
    description: "Tool integrations",
    iconPath:
      "M11.42 15.17l-5.1-5.1a1.5 1.5 0 010-2.12l.71-.71a1.5 1.5 0 012.12 0l3.57 3.57 7.07-7.07a1.5 1.5 0 012.12 0l.71.71a1.5 1.5 0 010 2.12l-8.49 8.49a1.5 1.5 0 01-2.12 0z",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    iconColor: "text-orange-600",
    textColor: "text-orange-700",
    hoverBorder: "hover:border-orange-400",
  },
];

interface CategoryTilesProps {
  counts: Record<string, number>;
}

export function CategoryTiles({ counts }: CategoryTilesProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CATEGORIES.map((cat) => {
        const count = counts[cat.key] ?? 0;
        return (
          <Link
            key={cat.key}
            href={`/skills?category=${cat.key}`}
            className={`group rounded-xl border ${cat.borderColor} ${cat.bgColor} p-5 shadow-sm transition hover:shadow-md ${cat.hoverBorder}`}
          >
            <div className="flex items-center gap-3">
              <svg
                className={`h-8 w-8 ${cat.iconColor}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={cat.iconPath} />
              </svg>
              <div>
                <h3 className={`font-semibold ${cat.textColor}`}>{cat.label}</h3>
                <p className="text-xs text-gray-500">
                  {count} {count === 1 ? "skill" : "skills"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">{cat.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
