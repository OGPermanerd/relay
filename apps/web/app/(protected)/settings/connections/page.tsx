import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasActiveGmailConnection, getSiteSettings } from "@everyskill/db";
import { GmailConnectionCard } from "./gmail-connection-card";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "OAuth state mismatch. Please try again.",
  gmail_scope_denied:
    "Gmail access was not granted. Please allow the Gmail permission to continue.",
  token_exchange_failed: "Failed to connect Gmail. Please try again.",
  feature_disabled: "Gmail integration is not enabled for your organization.",
  no_code: "Authorization was cancelled.",
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    redirect("/login");
  }

  const settings = await getSiteSettings(session.user.tenantId);
  const featureEnabled = settings?.gmailDiagnosticEnabled ?? false;

  let connected = false;
  if (featureEnabled) {
    connected = await hasActiveGmailConnection(session.user.id);
  }

  const params = await searchParams;
  const successParam = typeof params.connected === "string" ? params.connected : undefined;
  const errorParam = typeof params.error === "string" ? params.error : undefined;

  const successMessage = successParam === "true" ? "Gmail connected successfully" : undefined;
  const errorMessage = errorParam
    ? (ERROR_MESSAGES[errorParam] ?? "An unexpected error occurred. Please try again.")
    : undefined;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Connected Accounts</h2>
      <p className="mt-1 text-sm text-gray-600">Manage your external service connections</p>
      <div className="mt-6">
        <GmailConnectionCard
          enabled={featureEnabled}
          connected={connected}
          successMessage={successMessage}
          errorMessage={errorMessage}
        />
      </div>
    </div>
  );
}
