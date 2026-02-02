interface TwoPanelLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}

/**
 * Two-panel responsive grid layout for browse page redesign
 *
 * Desktop: 5/6 left panel + 1/6 right panel
 * Mobile: Stacked with left on top
 */
export function TwoPanelLayout({ left, right, className = "" }: TwoPanelLayoutProps) {
  return (
    <div className={`mx-auto max-w-7xl px-4 ${className}`}>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-6">
        {/* Left panel - 5/6 width on desktop */}
        <div className="lg:col-span-5">{left}</div>

        {/* Right panel - 1/6 width on desktop */}
        <div className="lg:col-span-1">{right}</div>
      </div>
    </div>
  );
}
