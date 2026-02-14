"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GmailConnectionCardProps {
  enabled: boolean;
  connected: boolean;
  successMessage?: string;
  errorMessage?: string;
}

export function GmailConnectionCard({
  enabled,
  connected,
  successMessage,
  errorMessage,
}: GmailConnectionCardProps) {
  const [disconnecting, setDisconnecting] = useState(false);
  const router = useRouter();

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/gmail/disconnect", { method: "POST" });
      router.refresh();
    } catch {
      // Refresh regardless to reflect actual state
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <path
              d="M20 18H18V8.25L12 13L6 8.25V18H4V6H5.2L12 11.25L18.8 6H20V18Z"
              fill="#EA4335"
            />
            <path
              d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z"
              fill="none"
              stroke="#EA4335"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">Gmail</h3>
          <p className="text-xs text-gray-500">
            Connect your Gmail to analyze email patterns and get personalized skill recommendations
          </p>
        </div>
        {enabled && connected && (
          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Connected
          </span>
        )}
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mt-4 rounded-md bg-green-50 p-3">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="mt-4 rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* State-specific content */}
      <div className="mt-4">
        {!enabled ? (
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-sm text-gray-500">
              Gmail diagnostics is not enabled for your organization. Contact your admin to enable
              this feature.
            </p>
          </div>
        ) : connected ? (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          <a
            href="/api/gmail/connect"
            className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Connect Gmail
          </a>
        )}
      </div>
    </div>
  );
}
