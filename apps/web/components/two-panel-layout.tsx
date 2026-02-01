interface TwoPanelLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}

/**
 * Two-panel responsive grid layout for browse page redesign
 *
 * Desktop: 2/3 left panel + 1/3 right panel
 * Mobile: Stacked with left on top
 */
export function TwoPanelLayout({ left, right, className = "" }: TwoPanelLayoutProps) {
  return (
    <div className={`mx-auto max-w-6xl px-4 ${className}`}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left panel - 2/3 width on desktop */}
        <div className="lg:col-span-2">{left}</div>

        {/* Right panel - 1/3 width on desktop */}
        <div className="lg:col-span-1">{right}</div>
      </div>
    </div>
  );
}
