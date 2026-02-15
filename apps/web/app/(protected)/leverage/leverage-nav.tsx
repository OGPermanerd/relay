"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface LeverageNavProps {
  isAdmin: boolean;
}

const tabs = [
  { label: "Me", href: "/leverage", adminOnly: false },
  { label: "My Company", href: "/leverage/company", adminOnly: false },
  { label: "Employees", href: "/leverage/employees", adminOnly: true },
  { label: "Skills", href: "/leverage/skills", adminOnly: true },
];

export function LeverageNav({ isAdmin }: LeverageNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2">
      {tabs
        .filter((tab) => !tab.adminOnly || isAdmin)
        .map((tab) => {
          const isActive =
            tab.href === "/leverage" ? pathname === "/leverage" : pathname.startsWith(tab.href);
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
