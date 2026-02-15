"use client";

import { useActionState } from "react";
import {
  saveSettingsAction,
  testConnectionAction,
  backfillEmbeddingsAction,
} from "@/app/actions/admin-settings";
import type {
  SaveSettingsState,
  TestConnectionState,
  BackfillState,
} from "@/app/actions/admin-settings";
import { updateTenantSettingsAction, type TenantSettingsState } from "@/app/actions/admin-tenant";
import { RelativeTime } from "@/components/relative-time";

interface AdminSettingsFormProps {
  initialSettings: {
    semanticSimilarityEnabled: boolean;
    ollamaUrl: string;
    ollamaModel: string;
    embeddingDimensions: number;
    lastSuccessfulConnection: string | null;
    allowSkillDownload: boolean;
    gmailDiagnosticEnabled: boolean;
    trainingDataCaptureEnabled: boolean;
  } | null;
}

export function AdminSettingsForm({ initialSettings }: AdminSettingsFormProps) {
  const [saveState, saveAction, savePending] = useActionState<SaveSettingsState, FormData>(
    saveSettingsAction,
    {}
  );

  const [testState, testAction, testPending] = useActionState<TestConnectionState, FormData>(
    testConnectionAction,
    {}
  );

  const [backfillState, backfillAction, backfillPending] = useActionState<BackfillState, FormData>(
    backfillEmbeddingsAction,
    {}
  );

  const defaults = initialSettings ?? {
    semanticSimilarityEnabled: false,
    ollamaUrl: "http://localhost:11434",
    ollamaModel: "nomic-embed-text",
    embeddingDimensions: 768,
    lastSuccessfulConnection: null,
    allowSkillDownload: true,
    gmailDiagnosticEnabled: false,
    trainingDataCaptureEnabled: false,
  };

  return (
    <div className="space-y-8">
      {/* Semantic Similarity Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Semantic Similarity (Ollama)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enable AI-powered duplicate detection using a local Ollama server. When disabled, ILIKE
          text matching is used instead.
        </p>

        <form
          action={saveAction}
          className="mt-6 space-y-4"
          key={`${defaults.semanticSimilarityEnabled}-${defaults.ollamaUrl}-${defaults.ollamaModel}-${defaults.embeddingDimensions}`}
        >
          {/* Preserve other settings as hidden fields */}
          <input
            type="hidden"
            name="allowSkillDownload"
            value={defaults.allowSkillDownload ? "on" : ""}
          />
          <input
            type="hidden"
            name="gmailDiagnosticEnabled"
            value={defaults.gmailDiagnosticEnabled ? "on" : ""}
          />
          <input
            type="hidden"
            name="trainingDataCaptureEnabled"
            value={defaults.trainingDataCaptureEnabled ? "on" : ""}
          />

          {/* Enable toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="semanticSimilarityEnabled"
              name="semanticSimilarityEnabled"
              defaultChecked={defaults.semanticSimilarityEnabled}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="semanticSimilarityEnabled"
              className="text-sm font-medium text-gray-700"
            >
              Enable semantic similarity
            </label>
          </div>

          {/* Ollama URL */}
          <div>
            <label htmlFor="ollamaUrl" className="block text-sm font-medium text-gray-700">
              Ollama URL
            </label>
            <input
              type="text"
              id="ollamaUrl"
              name="ollamaUrl"
              defaultValue={defaults.ollamaUrl}
              placeholder="http://localhost:11434"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Model name */}
          <div>
            <label htmlFor="ollamaModel" className="block text-sm font-medium text-gray-700">
              Embedding Model
            </label>
            <input
              type="text"
              id="ollamaModel"
              name="ollamaModel"
              defaultValue={defaults.ollamaModel}
              placeholder="nomic-embed-text"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Dimensions */}
          <div>
            <label
              htmlFor="embeddingDimensions"
              className="block text-sm font-medium text-gray-700"
            >
              Embedding Dimensions
            </label>
            <input
              type="number"
              id="embeddingDimensions"
              name="embeddingDimensions"
              defaultValue={defaults.embeddingDimensions}
              min={1}
              max={4096}
              className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savePending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {savePending ? "Saving..." : "Save Settings"}
            </button>
            {saveState.success && <span className="text-sm text-green-600">Settings saved</span>}
            {saveState.error && <span className="text-sm text-red-600">{saveState.error}</span>}
          </div>
        </form>

        {/* Test Connection — separate form */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-900">Test Connection</h3>
          <form action={testAction} className="mt-3">
            {/* Pass ollamaUrl so we can read it in the action */}
            <input type="hidden" name="ollamaUrl" value={defaults.ollamaUrl} />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={testPending}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {testPending ? "Testing..." : "Test Connection"}
              </button>
              {testState.success && <span className="text-sm text-green-600">Connected</span>}
              {testState.error && <span className="text-sm text-red-600">{testState.error}</span>}
            </div>
          </form>

          {testState.models && testState.models.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700">Available models:</p>
              <ul className="mt-1 list-inside list-disc text-sm text-gray-600">
                {testState.models.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {defaults.lastSuccessfulConnection && (
            <p className="mt-3 text-xs text-gray-500">
              Last successful connection: <RelativeTime date={defaults.lastSuccessfulConnection} />
            </p>
          )}
        </div>

        {/* Backfill Embeddings */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-900">Backfill Embeddings</h3>
          <p className="mt-1 text-sm text-gray-600">
            Generate embeddings for existing skills that don&apos;t have one yet.
          </p>
          <form action={backfillAction} className="mt-3">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={backfillPending}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {backfillPending ? "Generating..." : "Backfill Embeddings"}
              </button>
              {backfillState.success && (
                <span className="text-sm text-green-600">
                  Generated {backfillState.generated} of {backfillState.total} embeddings
                </span>
              )}
              {backfillState.error && (
                <span className="text-sm text-red-600">{backfillState.error}</span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Skill Downloads Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Skill Downloads</h2>
        <p className="mt-1 text-sm text-gray-600">
          Control whether users can download skill files directly. When disabled, users can still
          install skills via MCP or the Claude deep link.
        </p>

        <form action={saveAction} className="mt-6">
          {/* Preserve other settings as hidden fields */}
          <input
            type="hidden"
            name="semanticSimilarityEnabled"
            value={defaults.semanticSimilarityEnabled ? "on" : ""}
          />
          <input type="hidden" name="ollamaUrl" value={defaults.ollamaUrl} />
          <input type="hidden" name="ollamaModel" value={defaults.ollamaModel} />
          <input type="hidden" name="embeddingDimensions" value={defaults.embeddingDimensions} />
          <input
            type="hidden"
            name="gmailDiagnosticEnabled"
            value={defaults.gmailDiagnosticEnabled ? "on" : ""}
          />
          <input
            type="hidden"
            name="trainingDataCaptureEnabled"
            value={defaults.trainingDataCaptureEnabled ? "on" : ""}
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allowSkillDownload"
              name="allowSkillDownload"
              defaultChecked={defaults.allowSkillDownload}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="allowSkillDownload" className="text-sm font-medium text-gray-700">
              Allow skill file downloads
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={savePending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {savePending ? "Saving..." : "Save"}
            </button>
            {saveState.success && <span className="text-sm text-green-600">Settings saved</span>}
            {saveState.error && <span className="text-sm text-red-600">{saveState.error}</span>}
          </div>
        </form>
      </div>

      {/* Gmail Diagnostics Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Gmail Diagnostics</h2>
        <p className="mt-1 text-sm text-gray-600">
          Allow users to connect their Gmail and receive personalized skill recommendations based on
          email patterns.
        </p>

        <form action={saveAction} className="mt-6">
          {/* Preserve other settings as hidden fields */}
          <input
            type="hidden"
            name="semanticSimilarityEnabled"
            value={defaults.semanticSimilarityEnabled ? "on" : ""}
          />
          <input type="hidden" name="ollamaUrl" value={defaults.ollamaUrl} />
          <input type="hidden" name="ollamaModel" value={defaults.ollamaModel} />
          <input type="hidden" name="embeddingDimensions" value={defaults.embeddingDimensions} />
          <input
            type="hidden"
            name="allowSkillDownload"
            value={defaults.allowSkillDownload ? "on" : ""}
          />
          <input
            type="hidden"
            name="trainingDataCaptureEnabled"
            value={defaults.trainingDataCaptureEnabled ? "on" : ""}
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="gmailDiagnosticEnabled"
              name="gmailDiagnosticEnabled"
              defaultChecked={defaults.gmailDiagnosticEnabled}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="gmailDiagnosticEnabled" className="text-sm font-medium text-gray-700">
              Enable Gmail diagnostic feature
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={savePending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {savePending ? "Saving..." : "Save"}
            </button>
            {saveState.success && <span className="text-sm text-green-600">Settings saved</span>}
            {saveState.error && <span className="text-sm text-red-600">{saveState.error}</span>}
          </div>
        </form>
      </div>

      {/* Training Data Capture Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Training Data Capture</h2>
        <p className="mt-1 text-sm text-gray-600">
          Allow capturing real skill usage as training examples. Users must also opt in individually
          via their preferences.
        </p>

        <form action={saveAction} className="mt-6">
          {/* Preserve other settings as hidden fields */}
          <input
            type="hidden"
            name="semanticSimilarityEnabled"
            value={defaults.semanticSimilarityEnabled ? "on" : ""}
          />
          <input type="hidden" name="ollamaUrl" value={defaults.ollamaUrl} />
          <input type="hidden" name="ollamaModel" value={defaults.ollamaModel} />
          <input type="hidden" name="embeddingDimensions" value={defaults.embeddingDimensions} />
          <input
            type="hidden"
            name="allowSkillDownload"
            value={defaults.allowSkillDownload ? "on" : ""}
          />
          <input
            type="hidden"
            name="gmailDiagnosticEnabled"
            value={defaults.gmailDiagnosticEnabled ? "on" : ""}
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="trainingDataCaptureEnabled"
              name="trainingDataCaptureEnabled"
              defaultChecked={defaults.trainingDataCaptureEnabled}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="trainingDataCaptureEnabled"
              className="text-sm font-medium text-gray-700"
            >
              Enable training data capture
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={savePending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {savePending ? "Saving..." : "Save"}
            </button>
            {saveState.success && <span className="text-sm text-green-600">Settings saved</span>}
            {saveState.error && <span className="text-sm text-red-600">{saveState.error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}

interface TenantSettingsFormProps {
  initialTenant: {
    name: string;
    domain: string | null;
    logo: string | null;
  };
}

export function TenantSettingsForm({ initialTenant }: TenantSettingsFormProps) {
  const [state, action, pending] = useActionState<TenantSettingsState, FormData>(
    updateTenantSettingsAction,
    {}
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Tenant Settings</h2>
      <p className="mt-1 text-sm text-gray-600">
        Configure your organization name, domain, and logo.
      </p>

      <form
        action={action}
        className="mt-6 space-y-4"
        key={`${initialTenant.name}-${initialTenant.domain}-${initialTenant.logo}`}
      >
        {/* Tenant Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Organization Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            defaultValue={initialTenant.name}
            required
            maxLength={100}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Domain */}
        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700">
            Email Domain
          </label>
          <input
            type="text"
            id="domain"
            name="domain"
            defaultValue={initialTenant.domain ?? ""}
            placeholder="company.com"
            maxLength={100}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Used for automatic tenant matching during sign-in
          </p>
        </div>

        {/* Logo URL */}
        <div>
          <label htmlFor="logo" className="block text-sm font-medium text-gray-700">
            Logo URL
          </label>
          <input
            type="text"
            id="logo"
            name="logo"
            defaultValue={initialTenant.logo ?? ""}
            placeholder="https://example.com/logo.png"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save Tenant Settings"}
          </button>
          {state.success && <span className="text-sm text-green-600">Tenant settings saved</span>}
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
