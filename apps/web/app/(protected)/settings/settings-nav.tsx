"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Preferences", href: "/settings/preferences" },
  { label: "Connections", href: "/settings/connections" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Export", href: "/settings/export" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isActive
                ? "rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
