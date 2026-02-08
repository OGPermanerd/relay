import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { TenantBranding } from "@/components/tenant-branding";
import { NavLink } from "@/components/nav-link";
import { GreetingArea } from "@/components/greeting-area";
import { isAdmin } from "@/lib/admin";
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
            <div className="relative">
              <NotificationBell
                initialCount={unreadCount}
                initialNotifications={serializedNotifications}
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
