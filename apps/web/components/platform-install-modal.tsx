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
import { getSkillContent } from "@/app/actions/get-skill-content";
import type { SkillInfo } from "./install-button";

interface PlatformInstallModalProps {
  onClose: () => void;
  skill?: SkillInfo;
  allowDownload?: boolean;
}

export const MCP_SETUP_KEY = "everyskill-mcp-setup-done";

export const platforms: {
  id: Platform;
  name: string;
  description: string;
  icon: "desktop" | "terminal" | "code" | "server";
}[] = [
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    description: "Desktop app",
    icon: "desktop",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    description: "CLI tool",
    icon: "terminal",
  },
  {
    id: "other-ide",
    name: "Other IDE",
    description: "Cursor, VS Code, etc.",
    icon: "code",
  },
  {
    id: "other-systems",
    name: "Other Systems",
    description: "Any MCP client",
    icon: "server",
  },
];

export function PlatformIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "desktop":
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z"
          />
        </svg>
      );
    case "terminal":
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
      );
    case "code":
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
          />
        </svg>
      );
    case "server":
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 17.25v-.228a4.5 4.5 0 0 0-.12-1.03l-2.268-9.64a3.375 3.375 0 0 0-3.285-2.602H7.923a3.375 3.375 0 0 0-3.285 2.602l-2.268 9.64a4.5 4.5 0 0 0-.12 1.03v.228m19.5 0a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3m19.5 0a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3m16.5 0h.008v.008h-.008v-.008Zm-3 0h.008v.008h-.008v-.008Z"
          />
        </svg>
      );
    default:
      return null;
  }
}

const osLabels: Record<DetectedOS, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
};

export function PlatformInstallModal({
  onClose,
  skill,
  allowDownload = true,
}: PlatformInstallModalProps) {
  const [mcpExpanded, setMcpExpanded] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [detectedOS, setDetectedOS] = useState<DetectedOS>("macos");
  const [mounted, setMounted] = useState(false);
  const [showRunInstructions, setShowRunInstructions] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { copyToClipboard, isCopied } = useClipboardCopy();

  useEffect(() => {
    const os = detectOS();
    setDetectedOS(os);
    setSelectedPlatform("claude-desktop");
    // If MCP setup was never completed, expand by default
    const mcpDone = localStorage.getItem(MCP_SETUP_KEY);
    if (!mcpDone && !skill) {
      setMcpExpanded(true);
    }
    setMounted(true);
  }, [skill]);

  const configJson = selectedPlatform
    ? generatePlatformConfig(
        selectedPlatform,
        typeof window !== "undefined" ? window.location.origin : ""
      )
    : "";

  const handleDownloadScript = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { content, filename } = generateInstallScript(detectedOS, window.location.origin);
    downloadScript(content, filename);
    setShowRunInstructions(true);
    localStorage.setItem(MCP_SETUP_KEY, "true");
  };

  const handleCopyConfig = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard("platform-config", configJson);
    localStorage.setItem(MCP_SETUP_KEY, "true");
  };

  const promptText = skill
    ? `Install the "${skill.name}" skill from EverySkill (skill ID: ${skill.id})`
    : "List all available skills from EverySkill";

  const handleDownloadSkill = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!skill) return;
      setDownloading(true);
      try {
        const result = await getSkillContent(skill.id);
        if (!result) return;

        const blob = new Blob([result.content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${result.slug}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } finally {
        setDownloading(false);
      }
    },
    [skill]
  );

  // Skill-aware modal layout
  if (skill) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Install {skill.name}</h3>
              <span className="mt-1 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {skill.category}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Copy prompt section */}
          <div className="mt-4">
            <p className="text-sm text-gray-600">Copy this and paste it into Claude:</p>
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="flex-1 text-sm font-mono text-gray-800">{promptText}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard("install-prompt", promptText);
                }}
                className={`shrink-0 rounded p-1.5 transition-colors ${
                  isCopied("install-prompt")
                    ? "text-green-600"
                    : "text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                }`}
                title={isCopied("install-prompt") ? "Copied!" : "Copy prompt"}
              >
                {isCopied("install-prompt") ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
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
            <p className="mt-2 text-xs text-gray-500">
              This will save the skill to your local environment with automatic usage tracking.
            </p>

            {/* Open in Claude deep link */}
            <div className="mt-3 flex items-center gap-3">
              <a
                href={`claude://new?prompt=${encodeURIComponent(promptText)}`}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
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
                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                Open in Claude
              </a>
              <p className="text-xs text-gray-400">Requires Claude Desktop app</p>
            </div>
          </div>

          {/* Download fallback */}
          {allowDownload && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleDownloadSkill}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 underline decoration-gray-300 hover:text-blue-600 hover:decoration-blue-300 disabled:opacity-50"
              >
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
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                {downloading ? "Downloading..." : `Or download ${skill.slug}.md directly`}
              </button>
            </div>
          )}

          {/* Collapsible MCP setup section */}
          <div className="mt-5 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMcpExpanded(!mcpExpanded);
              }}
              className="flex w-full items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <svg
                className={`h-4 w-4 transition-transform ${mcpExpanded ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              First time? Set up EverySkill MCP server
            </button>

            {mcpExpanded && mounted && (
              <div className="mt-3">
                {/* Platform cards grid */}
                <div className="grid grid-cols-2 gap-2">
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlatform(platform.id);
                        setShowRunInstructions(false);
                      }}
                      className={`rounded-lg border-2 p-3 text-left transition-colors ${
                        selectedPlatform === platform.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <PlatformIcon type={platform.icon} className="mb-1 h-5 w-5 text-gray-600" />
                      <div className="text-xs font-medium text-gray-900">{platform.name}</div>
                      <div className="text-xs text-gray-500">{platform.description}</div>
                    </button>
                  ))}
                </div>

                {/* Config section */}
                {selectedPlatform && (
                  <div className="mt-3">
                    <p className="text-xs font-mono text-gray-400">
                      {getConfigFilePath(selectedPlatform, detectedOS)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {getConfigInstructions(selectedPlatform)}
                    </p>

                    <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs font-mono text-gray-800">
                      {configJson}
                    </pre>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyConfig}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          isCopied("platform-config")
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {isCopied("platform-config") ? "Copied!" : "Copy Config"}
                      </button>

                      {selectedPlatform === "claude-desktop" && (
                        <button
                          type="button"
                          onClick={handleDownloadScript}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          Download Install Script
                        </button>
                      )}
                    </div>

                    {showRunInstructions && selectedPlatform === "claude-desktop" && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">Run the downloaded script:</p>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700">
                            {getRunInstructions(detectedOS)}
                          </code>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard("run-instructions", getRunInstructions(detectedOS));
                            }}
                            className={`rounded p-1 transition-colors ${
                              isCopied("run-instructions")
                                ? "text-green-600"
                                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            }`}
                            title={isCopied("run-instructions") ? "Copied!" : "Copy command"}
                          >
                            {isCopied("run-instructions") ? (
                              <svg
                                className="h-3.5 w-3.5"
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
                                className="h-3.5 w-3.5"
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

                <p className="mt-3 text-xs italic text-gray-400">
                  After installing, restart your app and check for EverySkill in your MCP servers.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback: generic MCP setup modal (no skill context)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Install EverySkill MCP Server</h3>
            {mounted && (
              <p className="mt-0.5 text-sm text-gray-500">Detected: {osLabels[detectedOS]}</p>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Platform cards grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {platforms.map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
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
            <p className="text-xs font-mono text-gray-400">
              {getConfigFilePath(selectedPlatform, detectedOS)}
            </p>
            <p className="mt-1 text-sm text-gray-600">{getConfigInstructions(selectedPlatform)}</p>

            <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 p-4 text-sm font-mono text-gray-800">
              {configJson}
            </pre>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyConfig}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isCopied("platform-config")
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isCopied("platform-config") ? (
                  <>
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
                    Copied!
                  </>
                ) : (
                  <>
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
                    Copy Config
                  </>
                )}
              </button>

              {selectedPlatform === "claude-desktop" && (
                <button
                  type="button"
                  onClick={handleDownloadScript}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
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
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  Download Install Script
                </button>
              )}
            </div>

            {showRunInstructions && selectedPlatform === "claude-desktop" && (
              <div className="mt-3">
                <p className="text-xs text-gray-500">Run the downloaded script:</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded bg-gray-100 px-3 py-1.5 text-xs font-mono text-gray-700">
                    {getRunInstructions(detectedOS)}
                  </code>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard("run-instructions", getRunInstructions(detectedOS));
                    }}
                    className={`rounded p-1.5 transition-colors ${
                      isCopied("run-instructions")
                        ? "text-green-600"
                        : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    }`}
                    title={isCopied("run-instructions") ? "Copied!" : "Copy command"}
                  >
                    {isCopied("run-instructions") ? (
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

            <p className="mt-4 text-xs italic text-gray-400">
              After installing, restart your app and check for EverySkill in your MCP servers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
