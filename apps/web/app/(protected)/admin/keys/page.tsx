import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { listAllApiKeysAction } from "@/app/actions/api-keys";
import { db, users } from "@everyskill/db";
import { AdminKeyManager } from "@/components/admin-key-manager";

export default async function AdminKeysPage() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    redirect("/");
  }

  const keysResult = await listAllApiKeysAction();
  const keys = keysResult.keys || [];

  const userList = db
    ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">API Key Management</h1>
      <p className="mt-1 text-sm text-gray-600">Generate and manage API keys for all employees</p>
      <div className="mt-8">
        <AdminKeyManager initialKeys={keys} users={userList} />
      </div>
    </div>
  );
}
