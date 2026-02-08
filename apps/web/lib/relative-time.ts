/**
 * Format a date as a human-readable relative time string.
 *
 * Examples: "just now", "5min ago", "2h 15min ago", "1d 3h ago", "1y 35d ago"
 *
 * IMPORTANT: This is a pure function with no locale-dependent formatting.
 * Never use toLocaleDateString() or toLocaleString() -- causes hydration mismatches.
 */
export function formatRelativeTime(date: Date | string): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - target.getTime();

  // Future dates or zero diff
  if (diffMs < 0) {
    return "just now";
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const totalYears = Math.floor(totalDays / 365);

  // Less than 1 minute
  if (totalMinutes < 1) {
    return "just now";
  }

  // Less than 1 hour: show minutes
  if (totalHours < 1) {
    return `${totalMinutes}min ago`;
  }

  // Less than 1 day: show hours and minutes
  if (totalDays < 1) {
    const hours = totalHours;
    const minutes = totalMinutes - hours * 60;
    return `${hours}h ${minutes}min ago`;
  }

  // Less than 1 year: show days and optionally hours
  if (totalYears < 1) {
    const days = totalDays;
    const hours = totalHours - days * 24;
    if (hours === 0) {
      return `${days}d ago`;
    }
    return `${days}d ${hours}h ago`;
  }

  // 1+ years: show years and optionally remaining days
  const years = totalYears;
  const remainingDays = totalDays - years * 365;
  if (remainingDays === 0) {
    return `${years}y ago`;
  }
  return `${years}y ${remainingDays}d ago`;
}
