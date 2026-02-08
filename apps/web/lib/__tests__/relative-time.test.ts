import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeTime } from "../relative-time";

describe("formatRelativeTime", () => {
  const NOW = new Date("2026-02-08T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for 0 seconds ago", () => {
    const date = new Date(NOW);
    expect(formatRelativeTime(date)).toBe("just now");
  });

  it("returns 'just now' for 30 seconds ago (sub-minute granularity)", () => {
    const date = new Date(NOW - 30 * 1000);
    expect(formatRelativeTime(date)).toBe("just now");
  });

  it("returns 'just now' for 59 seconds ago", () => {
    const date = new Date(NOW - 59 * 1000);
    expect(formatRelativeTime(date)).toBe("just now");
  });

  it("returns '1min ago' for exactly 1 minute ago", () => {
    const date = new Date(NOW - 60 * 1000);
    expect(formatRelativeTime(date)).toBe("1min ago");
  });

  it("returns '5min ago' for 5 minutes ago", () => {
    const date = new Date(NOW - 5 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("5min ago");
  });

  it("returns '59min ago' for 59 minutes ago", () => {
    const date = new Date(NOW - 59 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("59min ago");
  });

  it("returns '1h 0min ago' for exactly 1 hour ago", () => {
    const date = new Date(NOW - 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("1h 0min ago");
  });

  it("returns '2h 15min ago' for 2 hours 15 minutes ago", () => {
    const date = new Date(NOW - (2 * 60 + 15) * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("2h 15min ago");
  });

  it("returns '1d 3h ago' for 1 day 3 hours ago", () => {
    const date = new Date(NOW - (24 + 3) * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("1d 3h ago");
  });

  it("returns '7d ago' for exactly 7 days (omits hours when days >= 7 and hours == 0)", () => {
    const date = new Date(NOW - 7 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("7d ago");
  });

  it("returns '30d 5h ago' for 30 days 5 hours ago", () => {
    const date = new Date(NOW - (30 * 24 + 5) * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("30d 5h ago");
  });

  it("returns '1y ago' for exactly 365 days ago", () => {
    const date = new Date(NOW - 365 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("1y ago");
  });

  it("returns '1y 35d ago' for 400 days ago", () => {
    const date = new Date(NOW - 400 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("1y 35d ago");
  });

  it("returns 'just now' for a future date", () => {
    const date = new Date(NOW + 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("just now");
  });

  it("accepts a string ISO date input", () => {
    const isoString = new Date(NOW - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString)).toBe("5min ago");
  });

  it("returns '2y 0d ago' for exactly 730 days ago", () => {
    const date = new Date(NOW - 730 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("2y ago");
  });

  it("returns '6d 12h ago' for 6 days 12 hours (under 7 days shows hours)", () => {
    const date = new Date(NOW - (6 * 24 + 12) * 60 * 60 * 1000);
    expect(formatRelativeTime(date)).toBe("6d 12h ago");
  });
});
