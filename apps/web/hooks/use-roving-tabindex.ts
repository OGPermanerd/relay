"use client";

import { useState, useCallback, useRef, KeyboardEvent } from "react";

interface UseRovingTabindexOptions {
  rowCount: number;
  colCount: number;
  onFocusChange?: (rowIndex: number, colIndex: number) => void;
  wrap?: boolean;
}

interface UseRovingTabindexReturn {
  activeRow: number;
  activeCol: number;
  getTabIndex: (row: number, col: number) => 0 | -1;
  handleKeyDown: (e: KeyboardEvent) => void;
  registerCell: (row: number, col: number, element: HTMLElement | null) => void;
  setActiveCell: (row: number, col: number) => void;
}

export function useRovingTabindex({
  rowCount,
  colCount,
  onFocusChange,
  wrap = false,
}: UseRovingTabindexOptions): UseRovingTabindexReturn {
  const [activeRow, setActiveRow] = useState(0);
  const [activeCol, setActiveCol] = useState(0);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());

  const focusCell = useCallback((row: number, col: number) => {
    const key = `${row}-${col}`;
    const element = cellRefs.current.get(key);
    if (element) {
      element.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      let newRow = activeRow;
      let newCol = activeCol;
      let handled = true;

      switch (e.key) {
        case "ArrowDown":
          newRow = wrap
            ? (activeRow + 1) % rowCount
            : Math.min(activeRow + 1, rowCount - 1);
          break;
        case "ArrowUp":
          newRow = wrap
            ? (activeRow - 1 + rowCount) % rowCount
            : Math.max(activeRow - 1, 0);
          break;
        case "ArrowRight":
          newCol = wrap
            ? (activeCol + 1) % colCount
            : Math.min(activeCol + 1, colCount - 1);
          break;
        case "ArrowLeft":
          newCol = wrap
            ? (activeCol - 1 + colCount) % colCount
            : Math.max(activeCol - 1, 0);
          break;
        case "Home":
          if (e.ctrlKey) {
            newRow = 0;
            newCol = 0;
          } else {
            newCol = 0;
          }
          break;
        case "End":
          if (e.ctrlKey) {
            newRow = rowCount - 1;
            newCol = colCount - 1;
          } else {
            newCol = colCount - 1;
          }
          break;
        default:
          handled = false;
      }

      if (handled) {
        e.preventDefault();
        setActiveRow(newRow);
        setActiveCol(newCol);
        focusCell(newRow, newCol);
        onFocusChange?.(newRow, newCol);
      }
    },
    [activeRow, activeCol, rowCount, colCount, wrap, focusCell, onFocusChange]
  );

  const getTabIndex = useCallback(
    (row: number, col: number): 0 | -1 =>
      row === activeRow && col === activeCol ? 0 : -1,
    [activeRow, activeCol]
  );

  const registerCell = useCallback(
    (row: number, col: number, element: HTMLElement | null) => {
      const key = `${row}-${col}`;
      if (element) {
        cellRefs.current.set(key, element);
      } else {
        cellRefs.current.delete(key);
      }
    },
    []
  );

  const setActiveCell = useCallback((row: number, col: number) => {
    setActiveRow(row);
    setActiveCol(col);
  }, []);

  return {
    activeRow,
    activeCol,
    getTabIndex,
    handleKeyDown,
    registerCell,
    setActiveCell,
  };
}
