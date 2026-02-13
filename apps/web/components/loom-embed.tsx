interface LoomEmbedProps {
  videoId: string;
  title?: string;
  duration?: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function LoomEmbed({ videoId, title, duration }: LoomEmbedProps) {
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
