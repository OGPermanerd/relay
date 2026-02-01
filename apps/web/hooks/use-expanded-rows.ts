"use client";

import { useState, useCallback } from "react";

export function useExpandedRows() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((skillId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  }, []);

  const isExpanded = useCallback((skillId: string) => expandedIds.has(skillId), [expandedIds]);

  return { toggleRow, isExpanded };
}
