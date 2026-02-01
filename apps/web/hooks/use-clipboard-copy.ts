"use client";

import { useState, useCallback } from "react";

export function useClipboardCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
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
