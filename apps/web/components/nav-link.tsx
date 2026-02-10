"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  theme?: "light" | "dark";
}

export function NavLink({ href, children, theme = "light" }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  const dark = theme === "dark";

  return (
    <Link
      href={href}
      className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition ${
        isActive
          ? dark
            ? "border-[#9fc5ff] text-[#dbe9f6]"
            : "border-blue-500 text-blue-600"
          : dark
            ? "border-transparent text-[#7a9ab4] hover:border-[#7a9ab4] hover:text-[#dbe9f6]"
            : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
      }`}
    >
      {children}
    </Link>
  );
}
