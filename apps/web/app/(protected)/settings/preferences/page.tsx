import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMyUserPreferences } from "@/app/actions/user-preferences";
import { PreferencesForm } from "./preferences-form";
import { PREFERENCES_DEFAULTS } from "@/lib/preferences-defaults";

export default async function UserPreferencesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const preferences = await getMyUserPreferences();

  return (
    <PreferencesForm
      initialPreferences={
        preferences ?? {
          preferredCategories: PREFERENCES_DEFAULTS.preferredCategories,
          defaultSort: PREFERENCES_DEFAULTS.defaultSort,
          claudeMdWorkflowNotes: PREFERENCES_DEFAULTS.claudeMdWorkflowNotes,
        }
      }
    />
  );
}
