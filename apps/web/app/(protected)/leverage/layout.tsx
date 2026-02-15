import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { LeverageNav } from "./leverage-nav";

export default async function LeverageLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect("/login");

  const admin = isAdmin(session);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leverage</h1>
        <p className="mt-1 text-sm text-gray-500">Track your impact and org-wide usage trends</p>
      </div>
      <div className="mb-6">
        <LeverageNav isAdmin={admin} />
      </div>
      {children}
    </div>
  );
}
