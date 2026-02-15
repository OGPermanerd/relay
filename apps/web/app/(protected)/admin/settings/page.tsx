import { auth } from "@/auth";
import { db, tenants, getSiteSettings } from "@everyskill/db";
import { eq } from "drizzle-orm";
import { AdminSettingsForm } from "@/components/admin-settings-form";
import { TenantSettingsForm } from "@/components/admin-settings-form";

export default async function AdminSettingsPage() {
  const session = await auth();

  const settings = await getSiteSettings(session?.user?.tenantId);

  // Query current tenant data
  const tenantRows =
    session?.user?.tenantId && db
      ? await db.select().from(tenants).where(eq(tenants.id, session.user.tenantId)).limit(1)
      : [];
  const tenant = tenantRows.length > 0 ? tenantRows[0] : null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
      <p className="mt-1 text-sm text-gray-600">Configure tenant and site-wide features</p>

      {/* Tenant Settings */}
      {tenant && (
        <div className="mt-8">
          <TenantSettingsForm
            initialTenant={{
              name: tenant.name,
              domain: tenant.domain,
              logo: tenant.logo,
            }}
          />
        </div>
      )}

      {/* Ollama / Similarity Settings */}
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
                  allowSkillDownload: settings.allowSkillDownload,
                  gmailDiagnosticEnabled: settings.gmailDiagnosticEnabled,
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
