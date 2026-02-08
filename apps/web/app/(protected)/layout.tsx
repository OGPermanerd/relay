import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { TenantBranding } from "@/components/tenant-branding";
import { NavLink } from "@/components/nav-link";
import { GreetingArea } from "@/components/greeting-area";
import { isAdmin } from "@/lib/admin";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            <TenantBranding />
            <nav className="hidden sm:flex sm:gap-6">
              <NavLink href="/">Home</NavLink>
              <NavLink href="/skills">Skills</NavLink>
              <NavLink href="/analytics">Analytics</NavLink>
              <NavLink href="/profile">Profile</NavLink>
              {isAdmin(session) && <NavLink href="/admin/settings">Admin</NavLink>}
            </nav>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <GreetingArea userId={user.id!} userName={user.name || "User"} />
            <Link href="/profile" className="flex items-center transition hover:opacity-80">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name || "User avatar"}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                  {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                </div>
              )}
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
