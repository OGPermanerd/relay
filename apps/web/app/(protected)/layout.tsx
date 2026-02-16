import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { TenantBranding } from "@/components/tenant-branding";
import { NavLink } from "@/components/nav-link";
import { GreetingArea } from "@/components/greeting-area";
import { isAdmin } from "@/lib/admin";
import { HEADER_THEME } from "@/lib/header-theme";
import {
  getUnreadNotificationCount,
  getUserNotifications,
} from "@everyskill/db/services/notifications";
import { NotificationBell } from "@/components/notification-bell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;
  const dark = HEADER_THEME === "dark";

  // Fetch notification data for the bell component
  const [unreadCount, recentNotifications] = await Promise.all([
    getUnreadNotificationCount(user.id!),
    getUserNotifications(user.id!, 20),
  ]);

  const serializedNotifications = recentNotifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    actionUrl: n.actionUrl,
    isRead: n.isRead,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
    readAt: n.readAt instanceof Date ? n.readAt.toISOString() : (n.readAt ?? null),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        className={
          dark ? "border-b border-[#1a3050] bg-[#0b1624]" : "border-b border-gray-200 bg-white"
        }
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/">
              <TenantBranding theme={HEADER_THEME} />
            </Link>
            <nav className="hidden sm:flex sm:gap-6">
              <NavLink href="/" theme={HEADER_THEME}>
                Home
              </NavLink>
              <NavLink href="/skills" theme={HEADER_THEME}>
                Skills
              </NavLink>
              <NavLink href="/leverage" theme={HEADER_THEME}>
                Leverage
              </NavLink>
              <NavLink href="/portfolio" theme={HEADER_THEME}>
                Portfolio
              </NavLink>
              <NavLink href="/profile" theme={HEADER_THEME}>
                Profile
              </NavLink>
              {isAdmin(session) && (
                <NavLink href="/admin/settings" theme={HEADER_THEME}>
                  Admin
                </NavLink>
              )}
            </nav>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <GreetingArea userId={user.id!} userName={user.name || "User"} theme={HEADER_THEME} />
            <div className="relative">
              <NotificationBell
                initialCount={unreadCount}
                initialNotifications={serializedNotifications}
                theme={HEADER_THEME}
              />
            </div>
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
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    dark ? "bg-[#1a3050] text-[#9fc5ff]" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                </div>
              )}
            </Link>
            <SignOutButton theme={HEADER_THEME} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
