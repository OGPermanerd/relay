import Image from "next/image";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;

  // Placeholder statistics (to be populated from database in later phases)
  const stats = [
    { label: "Skills Shared", value: "0", description: "Skills you've contributed" },
    { label: "Total Uses", value: "0", description: "Times your skills were used" },
    { label: "Avg Rating", value: "-", description: "Average rating received" },
    { label: "FTE Days Saved", value: "0", description: "Days saved for the org" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Profile Header */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center gap-6">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || "Profile picture"}
              width={96}
              height={96}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200 text-3xl font-medium text-gray-600">
              {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Contribution Statistics */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Contribution Statistics</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm font-medium text-gray-700">{stat.label}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Account Info */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Account Information</h2>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-gray-900">{user.name || "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-gray-900">{user.email || "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Sign-in Provider</dt>
              <dd className="mt-1 text-gray-900">Google</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
