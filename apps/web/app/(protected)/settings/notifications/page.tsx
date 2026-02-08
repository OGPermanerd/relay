import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMyPreferences } from "@/app/actions/notification-preferences";
import { NotificationPreferencesForm } from "./notification-preferences-form";

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const preferences = await getMyPreferences();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
      <p className="mt-1 text-sm text-gray-600">
        Choose how and when you want to be notified about activity in your organization.
      </p>

      <div className="mt-8">
        <NotificationPreferencesForm
          initialPreferences={
            preferences ?? {
              groupingProposalEmail: true,
              groupingProposalInApp: true,
              trendingDigest: "weekly" as const,
              platformUpdatesEmail: true,
              platformUpdatesInApp: true,
            }
          }
        />
      </div>
    </div>
  );
}
