"use client";

import { useState, useEffect, useCallback } from "react";
import { useClipboardCopy } from "@/hooks/use-clipboard-copy";
import { detectOS, type DetectedOS } from "@/lib/os-detection";
import {
  generatePlatformConfig,
  getConfigFilePath,
  getConfigInstructions,
  type Platform,
} from "@/lib/mcp-config";
import { generateInstallScript, downloadScript, getRunInstructions } from "@/lib/install-script";
import { generateApiKey, listApiKeysAction } from "@/app/actions/api-keys";
import { ApiKeyManager } from "@/components/api-key-manager";
import { platforms, PlatformIcon, MCP_SETUP_KEY } from "@/components/platform-install-modal";
import { RelativeTime } from "@/components/relative-time";

interface ApiKeyData {
  id: string;
  keyPrefix: string;
  name: string;
  lastUsedAt: string | Date | null;
  createdAt: string | Date;
  revokedAt: string | Date | null;
  expiresAt: string | Date | null;
}

interface SetupWizardProps {
  initialKeys: ApiKeyData[];
}

type WizardStep = 1 | 2 | 3;

export function SetupWizard({ initialKeys }: SetupWizardProps) {
  const [keys, setKeys] = useState<ApiKeyData[]>(initialKeys);
  const [step, setStep] = useState<WizardStep>(1);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [detectedOS, setDetectedOS] = useState<DetectedOS>("macos");
  const [mounted, setMounted] = useState(false);
  const [showRunInstructions, setShowRunInstructions] = useState(false);
  const [showManageKeys, setShowManageKeys] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const { copyToClipboard, isCopied } = useClipboardCopy();

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const hasActiveKeys = activeKeys.length > 0;

  useEffect(() => {
    const os = detectOS();
    setDetectedOS(os);
    setSelectedPlatform("claude-desktop");
    setMounted(true);
  }, []);

  const refreshKeys = useCallback(async () => {
    const result = await listApiKeysAction();
    if (result.keys) {
      setKeys(result.keys);
    }
  }, []);

  const handleGenerateKey = useCallback(async () => {
    setError(null);
    setIsGenerating(true);

    const formData = new FormData();
    formData.set("name", "Default Key");

    const result = await generateApiKey(formData);

    if (result.error) {
      setError(result.error);
      setIsGenerating(false);
      return;
    }

    if (result.key) {
      setGeneratedKey(result.key);
      await refreshKeys();
    }

    setIsGenerating(false);
  }, [refreshKeys]);

  const handleCopyKey = useCallback(async () => {
    if (generatedKey) {
      await copyToClipboard("wizard-key", generatedKey);
    }
  }, [generatedKey, copyToClipboard]);

  const handleDismissKey = useCallback(() => {
    setGeneratedKey(null);
    setStep(2);
  }, []);

  const configJson = selectedPlatform
    ? generatePlatformConfig(
        selectedPlatform,
        typeof window !== "undefined" ? window.location.origin : ""
      )
    : "";

  const handleCopyConfig = useCallback(() => {
    copyToClipboard("wizard-config", configJson);
    localStorage.setItem(MCP_SETUP_KEY, "true");
  }, [copyToClipboard, configJson]);

  const handleDownloadScript = useCallback(() => {
    const { content, filename } = generateInstallScript(
      detectedOS,
      typeof window !== "undefined" ? window.location.origin : ""
    );
    downloadScript(content, filename);
    setShowRunInstructions(true);
    localStorage.setItem(MCP_SETUP_KEY, "true");
  }, [detectedOS]);

  // Compact "Connected" card for users who already have keys
  if (hasActiveKeys && !showWizard && !showManageKeys) {
    const mostRecentKey = activeKeys.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    return (
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Integration Setup</h2>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
              </span>
              <span className="text-sm font-medium text-green-700">Connected</span>
              <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">
                {mostRecentKey.keyPrefix}...
              </code>
              <span className="text-xs text-gray-500">
                Last used:{" "}
                {mostRecentKey.lastUsedAt ? (
                  <RelativeTime date={mostRecentKey.lastUsedAt} />
                ) : (
                  "Never"
                )}
              </span>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setShowManageKeys(true)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Manage Keys
            </button>
            <button
              type="button"
              onClick={() => {
                setShowWizard(true);
                setStep(2);
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reconfigure
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded ApiKeyManager view
  if (showManageKeys) {
    return (
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Integration Setup</h2>
          <button
            type="button"
            onClick={() => setShowManageKeys(false)}
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            Back to overview
          </button>
        </div>
        <ApiKeyManager initialKeys={keys} />
      </div>
    );
  }

  // Wizard mode (new user or reconfigure)
  return (
    <div className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Integration Setup</h2>
      <div className="rounded-lg bg-white p-6 shadow-sm">
        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  s < step
                    ? "bg-green-100 text-green-700"
                    : s === step
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {s < step ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  s
                )}
              </div>
              {s < 3 && (
                <div className={`h-0.5 w-8 ${s < step ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Generate connection key */}
        {step === 1 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Connect to Claude</h3>
            <p className="mt-1 text-sm text-gray-600">Set up your integration in 2 minutes</p>

            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            {generatedKey ? (
              <div className="mt-4">
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-amber-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                      />
                    </svg>
                    <p className="text-sm font-semibold text-amber-800">
                      Copy this key now. You will not be able to see it again.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-white px-3 py-2 font-mono text-sm text-gray-900">
                      {generatedKey}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium ${
                        isCopied("wizard-key")
                          ? "bg-green-600 text-white"
                          : "bg-amber-600 text-white hover:bg-amber-700"
                      }`}
                    >
                      {isCopied("wizard-key") ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDismissKey}
                  className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Next: Configure your AI tool
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateKey}
                disabled={isGenerating}
                className="mt-6 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isGenerating ? "Generating..." : "Generate Connection Key"}
              </button>
            )}
          </div>
        )}

        {/* Step 2: Configure your AI tool */}
        {step === 2 && mounted && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Configure your AI tool</h3>
            <p className="mt-1 text-sm text-gray-600">
              Choose your platform and add the EverySkill MCP server
            </p>

            {/* Platform cards */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlatform(platform.id);
                    setShowRunInstructions(false);
                  }}
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${
                    selectedPlatform === platform.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <PlatformIcon type={platform.icon} className="mb-2 h-6 w-6 text-gray-600" />
                  <div className="text-sm font-medium text-gray-900">{platform.name}</div>
                  <div className="text-xs text-gray-500">{platform.description}</div>
                </button>
              ))}
            </div>

            {/* Config section */}
            {selectedPlatform && (
              <div className="mt-4">
                <p className="font-mono text-xs text-gray-400">
                  {getConfigFilePath(selectedPlatform, detectedOS)}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {getConfigInstructions(selectedPlatform)}
                </p>

                <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 p-4 font-mono text-sm text-gray-800">
                  {configJson}
                </pre>

                <p className="mt-2 text-xs text-amber-700">
                  Set <code className="font-mono">EVERYSKILL_API_KEY</code> to the connection key
                  you generated in step 1.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyConfig}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isCopied("wizard-config")
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isCopied("wizard-config") ? "Copied!" : "Copy Config"}
                  </button>

                  {selectedPlatform === "claude-desktop" && (
                    <button
                      type="button"
                      onClick={handleDownloadScript}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Download Install Script
                    </button>
                  )}
                </div>

                {showRunInstructions && selectedPlatform === "claude-desktop" && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500">Run the downloaded script:</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded bg-gray-100 px-3 py-1.5 font-mono text-xs text-gray-700">
                        {getRunInstructions(detectedOS)}
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard("wizard-run", getRunInstructions(detectedOS))
                        }
                        className={`rounded p-1.5 transition-colors ${
                          isCopied("wizard-run")
                            ? "text-green-600"
                            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        }`}
                        title={isCopied("wizard-run") ? "Copied!" : "Copy command"}
                      >
                        {isCopied("wizard-run") ? (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              {!hasActiveKeys && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Next: Finish setup
              </button>
            </div>
          </div>
        )}

        {/* Step 3: You're connected! */}
        {step === 3 && (
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">You&apos;re connected!</h3>
                <p className="text-sm text-gray-600">
                  EverySkill is ready to use with your AI tool
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">Next steps:</p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-blue-800">
                <li>Restart your AI tool to load the new config</li>
                <li>Try asking: &quot;List all available skills from EverySkill&quot;</li>
              </ol>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowManageKeys(true);
                  setShowWizard(false);
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Manage connection keys
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Reconfigure platform
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
