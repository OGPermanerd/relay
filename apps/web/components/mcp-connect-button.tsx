"use client";

import { useState, useCallback } from "react";

interface McpConnectButtonProps {
  serverUrl: string;
}

export function McpConnectButton({ serverUrl }: McpConnectButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(serverUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = serverUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [serverUrl]);

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">Connect to Claude.ai</h3>
      <p className="mt-1 text-sm text-gray-600">
        Use this URL to connect your EverySkill account to Claude.ai as an MCP connector.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800">
          {serverUrl}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            copied ? "bg-green-100 text-green-700" : "bg-indigo-600 text-white hover:bg-indigo-500"
          }`}
        >
          {copied ? "Copied!" : "Copy URL"}
        </button>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-700">Setup instructions:</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-600">
          <li>Open Claude.ai Settings &gt; Connectors</li>
          <li>Add a new MCP connector</li>
          <li>Paste this URL as the server URL</li>
          <li>Enter your API key as the bearer token</li>
        </ol>
      </div>
    </div>
  );
}
