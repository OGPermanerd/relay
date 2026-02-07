import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getSiteSettings } from "@everyskill/db";
import { AdminSettingsForm } from "@/components/admin-settings-form";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.email)) {
    redirect("/");
  }

  const settings = await getSiteSettings();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
      <p className="mt-1 text-sm text-gray-600">Configure site-wide features and integrations</p>

      <div className="mt-8">
        <AdminSettingsForm
          initialSettings={
            settings
              ? {
                  semanticSimilarityEnabled: settings.semanticSimilarityEnabled,
                  ollamaUrl: settings.ollamaUrl,
                  ollamaModel: settings.ollamaModel,
                  embeddingDimensions: settings.embeddingDimensions,
                  lastSuccessfulConnection:
                    settings.lastSuccessfulConnection?.toISOString() ?? null,
                }
              : null
          }
        />
      </div>

      <div className="mt-8 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900">Duplicate Skill Merge</h2>
        <p className="mt-1 text-sm text-gray-600">
          Merge duplicate skills, transferring usage, ratings, and forks to a target skill.
        </p>
        <a
          href="/admin/merge"
          className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Go to Skill Merge &rarr;
        </a>
      </div>

      <div className="mt-8 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900">API Key Management</h2>
        <p className="mt-1 text-sm text-gray-600">Manage API keys for MCP tool access.</p>
        <a
          href="/admin/keys"
          className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Go to API Key Management &rarr;
        </a>
      </div>
    </div>
  );
}
