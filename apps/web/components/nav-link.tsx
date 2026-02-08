"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition ${
        isActive
          ? "border-blue-500 text-blue-600"
          : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
      }`}
    >
      {children}
    </Link>
  );
}
