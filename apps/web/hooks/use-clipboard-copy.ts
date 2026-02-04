"use client";

import { useState, useCallback } from "react";

export function useClipboardCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (id: string, text: string) => {
    try {
      if (!navigator.clipboard) {
        // Fallback for non-HTTPS contexts (e.g., localhost)
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      return true;
    } catch (err) {
      console.error("Failed to copy:", err);
      return false;
    }
  }, []);

  const isCopied = useCallback((id: string) => copiedId === id, [copiedId]);

  return { copyToClipboard, isCopied };
}
