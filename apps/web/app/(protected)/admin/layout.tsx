import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";

const adminNavItems = [
  { label: "Settings", href: "/admin/settings" },
  { label: "Skills", href: "/admin/skills" },
  { label: "Merge", href: "/admin/merge" },
  { label: "API Keys", href: "/admin/keys" },
  { label: "Compliance", href: "/admin/compliance" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!isAdmin(session)) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
      <nav className="mt-4 flex gap-4 border-b border-gray-200 pb-3">
        {adminNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
