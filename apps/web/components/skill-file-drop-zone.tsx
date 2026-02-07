"use client";

import { useCallback, useRef, useState } from "react";
import { parseSkillFile, type ParsedSkillData } from "@/lib/skill-file-parser";

interface SkillFileDropZoneProps {
  onFileParsed: (data: ParsedSkillData) => void;
  disabled?: boolean;
}

type DropState = "idle" | "dragging" | "processing" | "success" | "error";

const ACCEPT = ".md,.json,.zip";

export function SkillFileDropZone({ onFileParsed, disabled }: SkillFileDropZoneProps) {
  const [state, setState] = useState<DropState>("idle");
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setState("processing");
      setMessage("");

      try {
        const result = await parseSkillFile(file);

        if (result.content || result.name) {
          setState("success");
          setMessage(result.parseMessage || `Imported "${file.name}".`);
          onFileParsed(result);
        } else {
          setState("error");
          setMessage(result.parseMessage || "Could not parse file.");
        }
      } catch {
        setState("error");
        setMessage("An unexpected error occurred while parsing the file.");
      }
    },
    [onFileParsed]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setState("dragging");
    },
    [disabled]
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState((s) => (s === "dragging" ? "idle" : s));
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [handleFile]
  );

  const borderColor =
    state === "dragging"
      ? "border-blue-500 bg-blue-50"
      : state === "success"
        ? "border-green-400 bg-green-50"
        : state === "error"
          ? "border-red-400 bg-red-50"
          : "border-gray-300";

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
        className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${borderColor} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-blue-400 hover:bg-blue-50/50"}`}
      >
        {state === "processing" ? <Spinner /> : <UploadIcon />}

        <p className="mt-2 text-sm font-medium text-gray-700">
          {state === "processing"
            ? "Processing file..."
            : "Drop a skill file here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-gray-500">Supports .md, .json, .mcp.json, and .zip files</p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onInputChange}
          className="hidden"
          disabled={disabled}
          aria-label="Browse for skill file"
        />
      </div>

      {message && (
        <div
          className={`mt-2 flex items-center justify-between rounded-md px-3 py-2 text-sm ${
            state === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setState("idle");
              setMessage("");
            }}
            className="ml-2 text-lg leading-none opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-8 w-8 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
