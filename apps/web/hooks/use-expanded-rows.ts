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

  const expandRow = useCallback((skillId: string) => {
    setExpandedIds((prev) => {
      if (prev.has(skillId)) {
        return prev; // No-op if already expanded
      }
      const next = new Set(prev);
      next.add(skillId);
      return next;
    });
  }, []);

  const collapseRow = useCallback((skillId: string) => {
    setExpandedIds((prev) => {
      if (!prev.has(skillId)) {
        return prev; // No-op if already collapsed
      }
      const next = new Set(prev);
      next.delete(skillId);
      return next;
    });
  }, []);

  const isExpanded = useCallback((skillId: string) => expandedIds.has(skillId), [expandedIds]);

  return { toggleRow, expandRow, collapseRow, isExpanded };
}
