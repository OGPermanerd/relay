"use client";

import { useState, useEffect } from "react";
import { formatRelativeTime } from "@/lib/relative-time";

const REFRESH_INTERVAL_MS = 60_000;

interface RelativeTimeProps {
  date: Date | string;
  className?: string;
}

/**
 * Hydration-safe relative time component.
 *
 * Renders empty on server, then populates on client mount.
 * Auto-refreshes every 60 seconds to keep the display current.
 *
 * IMPORTANT: Uses useState("") + useEffect to avoid hydration mismatches.
 * Never uses toLocaleDateString() or toLocaleString().
 */
export function RelativeTime({ date, className }: RelativeTimeProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    const update = () => setText(formatRelativeTime(date));

    // Set immediately on mount
    update();

    // Refresh every 60 seconds
    const interval = setInterval(update, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [date]);

  return <span className={className}>{text}</span>;
}
