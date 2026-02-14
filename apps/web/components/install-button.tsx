"use client";

import { useState } from "react";
import { PlatformInstallModal } from "./platform-install-modal";

export interface SkillInfo {
  id: string;
  name: string;
  slug: string;
  category: string;
}

interface InstallButtonProps {
  variant?: "full" | "icon";
  skill?: SkillInfo;
  allowDownload?: boolean;
}

/**
 * Install button that opens the platform selection modal
 *
 * Variants:
 * - "full": Rounded button with text "Install"
 * - "icon": Compact download icon for table rows
 *
 * Self-contained: manages its own modal state internally.
 * Uses stopPropagation on all variants to prevent row navigation and event bubbling.
 */
export function InstallButton({ variant = "full", skill, allowDownload }: InstallButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={handleClick}
          className="rounded p-1 transition-colors hover:bg-gray-100"
          title="Install skill"
          aria-label="Install skill"
        >
          <svg
            className="h-5 w-5 text-gray-400 hover:text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
        </button>
      ) : (
        <button
          onClick={handleClick}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          aria-label="Install skill"
        >
          Install
        </button>
      )}

      {showModal && (
        <PlatformInstallModal
          onClose={() => setShowModal(false)}
          skill={skill}
          allowDownload={allowDownload}
        />
      )}
    </>
  );
}
