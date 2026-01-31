"use client";

import { Sparklines, SparklinesLine } from "react-sparklines";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * Sparkline chart for visualizing usage trends
 *
 * Default sizing optimized for skill cards (60x20px)
 * Uses blue color to match the app theme
 */
export function Sparkline({ data, width = 60, height = 20, color = "#3b82f6" }: SparklineProps) {
  // Handle empty data - show flat line
  if (!data || data.length === 0) {
    return (
      <Sparklines data={[0, 0, 0, 0, 0]} width={width} height={height}>
        <SparklinesLine color="#9ca3af" />
      </Sparklines>
    );
  }

  return (
    <Sparklines data={data} width={width} height={height}>
      <SparklinesLine color={color} />
    </Sparklines>
  );
}
