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
    <NotificationPreferencesForm
      initialPreferences={
        preferences ?? {
          groupingProposalEmail: true,
          groupingProposalInApp: true,
          trendingDigest: "weekly" as const,
          platformUpdatesEmail: true,
          platformUpdatesInApp: true,
          reviewNotificationsEmail: true,
          reviewNotificationsInApp: true,
        }
      }
    />
  );
}
