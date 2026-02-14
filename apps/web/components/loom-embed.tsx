"use client";

import { useState } from "react";

interface LoomEmbedProps {
  videoId: string;
  title?: string;
  duration?: number;
  mode?: "thumbnail" | "full";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function LoomEmbed({ videoId, title, duration, mode = "thumbnail" }: LoomEmbedProps) {
  const [expanded, setExpanded] = useState(mode === "full");

  if (expanded) {
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        {/* Responsive 16:10 container (Loom aspect ratio) */}
        <div className="relative" style={{ paddingBottom: "62.5%" }}>
          <iframe
            src={`https://www.loom.com/embed/${videoId}`}
            allowFullScreen
            allow="encrypted-media *;"
            className="absolute inset-0 h-full w-full rounded-lg"
            frameBorder="0"
          />
        </div>
        {/* Metadata: title and duration */}
        {(title || duration != null) && (
          <div className="mt-3 flex items-center gap-2">
            {title && <p className="text-sm text-gray-500">{title}</p>}
            {duration != null && (
              <span className="text-xs text-gray-400">
                {title && <span className="mr-2">|</span>}
                {formatDuration(duration)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Thumbnail mode — static image with play button overlay
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(true)}
        className="group relative block w-full cursor-pointer"
        aria-label="Play demo video"
      >
        {/* Loom thumbnail image */}
        <img
          src={`https://cdn.loom.com/sessions/thumbnails/${videoId}-with-play.gif`}
          alt={title || "Demo video thumbnail"}
          className="w-full object-cover"
          loading="lazy"
        />
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition group-hover:scale-110">
            <svg className="ml-1 h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>
      {/* Metadata below thumbnail */}
      {(title || duration != null) && (
        <div className="flex items-center gap-2 px-4 py-2">
          {title && <p className="text-sm text-gray-600">{title}</p>}
          {duration != null && (
            <span className="text-xs text-gray-400">
              {title && <span className="mr-2">|</span>}
              {formatDuration(duration)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
