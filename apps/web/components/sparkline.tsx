"use client";

import { useState, useEffect } from "react";
import { Sparklines, SparklinesLine } from "react-sparklines";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * Sparkline chart for visualizing days saved trends
 *
 * Default sizing optimized for skill cards (60x20px)
 * Uses blue color to match the app theme
 * Client-only rendering to avoid hydration mismatches
 * Wrapped in fixed-size container because react-sparklines doesn't set SVG dimensions
 */
export function Sparkline({ data, width = 60, height = 20, color = "#3b82f6" }: SparklineProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return <div style={{ width, height }} />;
  }

  // Handle empty data or all zeros - show flat gray line
  const hasData = data && data.length > 0 && data.some((v) => v > 0);

  // Wrap in container with explicit dimensions since react-sparklines
  // doesn't set width/height attributes on the SVG element
  return (
    <div style={{ width, height }} className="[&_svg]:w-full [&_svg]:h-full">
      {hasData ? (
        <Sparklines data={data} width={width} height={height}>
          <SparklinesLine color={color} />
        </Sparklines>
      ) : (
        <Sparklines data={[0, 0, 0, 0, 0]} width={width} height={height}>
          <SparklinesLine color="#9ca3af" />
        </Sparklines>
      )}
    </div>
  );
}
