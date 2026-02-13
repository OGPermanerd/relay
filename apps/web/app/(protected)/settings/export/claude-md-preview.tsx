"use client";

import { useState, useCallback } from "react";

interface ClaudeMdPreviewProps {
  markdown: string;
}

export function ClaudeMdPreview({ markdown }: ClaudeMdPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdown]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "CLAUDE.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown]);

  return (
    <div>
      <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        This file can be placed in any project as CLAUDE.md to give AI assistants context about your
        skills and preferences.
      </div>

      <textarea
        readOnly
        value={markdown}
        rows={20}
        className="w-full rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-sm text-gray-800 focus:outline-none"
      />

      <div className="mt-4 flex gap-3">
        <button
          onClick={handleCopy}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>
        <button
          onClick={handleDownload}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Download CLAUDE.md
        </button>
      </div>
    </div>
  );
}
