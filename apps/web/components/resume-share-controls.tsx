"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createResumeShare, revokeResumeShare } from "@/app/actions/resume-share";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResumeShareControlsProps {
  initialShare: {
    token: string;
    includeCompanySkills: boolean;
    url: string;
  } | null;
  includeCompany: boolean;
  onToggleCompanySkills?: (include: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResumeShareControls({
  initialShare,
  includeCompany,
  onToggleCompanySkills,
}: ResumeShareControlsProps) {
  const router = useRouter();
  const [share, setShare] = useState(initialShare);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  // Handle toggle change
  const handleToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      if (onToggleCompanySkills) {
        onToggleCompanySkills(checked);
      }
      // Navigate with search param to trigger server re-fetch
      if (checked) {
        router.push("/portfolio/resume?include=company");
      } else {
        router.push("/portfolio/resume");
      }
    },
    [onToggleCompanySkills, router]
  );

  // Generate share link
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await createResumeShare(includeCompany);
      if ("error" in result) {
        alert(result.error);
        return;
      }
      setShare({ token: result.token, includeCompanySkills: includeCompany, url: result.url });
    } catch (err) {
      console.error("Failed to generate share link:", err);
      alert("Failed to generate share link. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [includeCompany]);

  // Copy share URL
  const handleCopy = useCallback(async () => {
    if (!share) return;
    const fullUrl = window.location.origin + share.url;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback: select input text
      const input = document.querySelector<HTMLInputElement>("input[data-share-url]");
      if (input) {
        input.select();
        document.execCommand("copy");
      }
    }
  }, [share]);

  // Revoke share link
  const handleRevoke = useCallback(async () => {
    setIsRevoking(true);
    try {
      const result = await revokeResumeShare();
      if ("error" in result) {
        alert(result.error);
        return;
      }
      setShare(null);
    } catch (err) {
      console.error("Failed to revoke share link:", err);
      alert("Failed to revoke share link. Please try again.");
    } finally {
      setIsRevoking(false);
    }
  }, []);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Toggle */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeCompany}
            onChange={handleToggle}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-medium text-gray-700">Include company skills</span>
          <span className="text-gray-400">(portable skills only by default)</span>
        </label>

        {/* Share controls */}
        <div className="flex items-center gap-2">
          {share ? (
            <>
              <input
                type="text"
                readOnly
                data-share-url
                value={
                  typeof window !== "undefined" ? window.location.origin + share.url : share.url
                }
                className="w-64 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-600"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                {isCopied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={isRevoking}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {isRevoking ? "Revoking..." : "Revoke"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate Share Link"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
